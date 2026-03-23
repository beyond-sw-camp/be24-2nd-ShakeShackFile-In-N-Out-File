import api from '@/plugins/axiosinterceptor'

const VAPID_PUBLIC_KEY =
  'BLHgfPga02L2u89uc4xjhbUFTy_U04rQCjGq7o24oxtqfVmAPHTxOmp6xndSHZtGQpmt7gqTFdMXco2gRNP7_p8'

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

const extractBody = (baseResponse) => {
  if (!baseResponse) return null
  if (baseResponse?.result?.body !== undefined) return baseResponse.result.body
  if (baseResponse?.data?.result?.body !== undefined) return baseResponse.data.result.body
  if (baseResponse?.data !== undefined) return baseResponse.data
  return baseResponse
}

const apiCall = async (label, request, fallback = undefined) => {
  try {
    const response = await request()
    const baseResponse = response.data

    if (baseResponse?.success === false) {
      const code = baseResponse?.code ?? 'UNKNOWN'
      const message = baseResponse?.message ?? '알 수 없는 오류가 발생했습니다.'
      console.error(`[${label}] 실패 — [${code}] ${message}`)
      const error = new Error(message)
      error.code = code
      error.baseResponse = baseResponse
      throw error
    }

    return extractBody(baseResponse)
  } catch (error) {
    if (error.baseResponse) throw error

    const serverData = error.response?.data
    if (serverData?.success === false) {
      const code = serverData?.code ?? error.response?.status ?? 'NETWORK'
      const message = serverData?.message ?? error.message
      console.error(`[${label}] 실패 — [${code}] ${message}`)
      const wrappedError = new Error(message)
      wrappedError.code = code
      wrappedError.baseResponse = serverData
      throw wrappedError
    }

    console.error(`[${label}] 오류 —`, error)
    if (fallback !== undefined) return fallback
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 알림
// ─────────────────────────────────────────────────────────────────────────────

const subscribeWebPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null
  }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null
    const registration = await navigator.serviceWorker.register('/sw.js')
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    const subscriptionJson = subscription.toJSON()
    const response = await api.post('/notification/subscribe', {
      endpoint: subscriptionJson.endpoint,
      keys: subscriptionJson.keys,
    })
    console.log('알림 구독 성공')
    return response.data
  } catch (error) {
    console.error('알림 구독 실패:', error)
    throw error
  }
}

const unsubscribeWebPush = async () => {
  try {
    const response = await api.post('/notification/unsubscribe')
    return response.data
  } catch (error) {
    console.error('푸시 구독 비활성화 실패:', error)
    throw error
  }
}

const getNotifications = async () => {
  try {
    const response = await api.get('/notification/list')
    return response.data
  } catch (error) {
    console.error('알림 목록 조회 실패:', error)
    throw error
  }
}

const markNotificationAsRead = async ({ id = null, uuid = null } = {}) => {
  try {
    const response = await api.patch('/notification/read', { id, uuid })
    return response.data
  } catch (error) {
    console.error('알림 읽음 처리 실패:', error)
    throw error
  }
}

const deleteNotification = async ({ id = null, uuid = null } = {}) => {
  try {
    const response = await api.delete('/notification', { data: { id, uuid } })
    return response.data
  } catch (error) {
    console.error('알림 삭제 실패:', error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 워크스페이스 CRUD
// ─────────────────────────────────────────────────────────────────────────────

const savePost = async (formData) =>
  apiCall('savePost', () => api.post('/workspace/save', formData))

const getPost = async (idx) =>
  apiCall('getPost', () => api.get(`/workspace/read/${idx}`))

const allPosts = async () =>
  apiCall('allPosts', () => api.get('/workspace/list'))

const deletePost = async (idx) =>
  apiCall('deletePost', () => api.post(`/workspace/delete/${idx}`))

const list_delete = async (idx) =>
  apiCall('list_delete', () => api.post(`/workspace/delete/list/${idx}`))

// ─────────────────────────────────────────────────────────────────────────────
// 공유 / 초대
// ─────────────────────────────────────────────────────────────────────────────

const inviteUser = async (inviteData) =>
  apiCall(
    'inviteUser',
    () => api.post('/workspace/invite', null, {
      params: { uuid: inviteData.uuid, type: inviteData.type, email: inviteData.email },
      timeout: 15000,
    }),
  )

const getPostByUuid = async (uuid) =>
  apiCall('getPostByUuid', () => api.get(`/workspace/by-uuid/${uuid}`))

const verifyEmail = async (uuid, type) =>
  apiCall('verifyEmail', () => api.get('/workspace/verify', { params: { uuid, type } }))

const updateShareStatus = async (idx, status) =>
  apiCall('updateShareStatus', () =>
    api.post(`/workspace/isShared/${idx}`, { type: status !== 'Private', status }),
  )

// ─────────────────────────────────────────────────────────────────────────────
// 권한
// ─────────────────────────────────────────────────────────────────────────────

const loadRole = async (idx) =>
  apiCall('loadRole', () => api.get(`/workspace/loadRole/${idx}`))

const saveRole = async (idx, roleData) =>
  apiCall('saveRole', () => api.post(`/workspace/saveRole/${idx}`, roleData))

// ✅ 단일 유저 역할 변경 (SSE로 해당 유저에게 알림)
const changeUserRole = async (postIdx, targetUserIdx, role) =>
  apiCall(
    'changeUserRole',
    () => api.post(`/workspace/${postIdx}/role/${targetUserIdx}`, { role }),
  )

// ✅ 유저 추방 (SSE로 해당 유저에게 알림)
const kickUser = async (postIdx, targetUserIdx) =>
  apiCall(
    'kickUser',
    () => api.delete(`/workspace/${postIdx}/member/${targetUserIdx}`, {
      headers: { 'Content-Type': undefined },
    }),
  )

// ─────────────────────────────────────────────────────────────────────────────
// 첨부 파일(에셋)
// ─────────────────────────────────────────────────────────────────────────────

const getWorkspaceAssets = async (workspaceId) =>
  apiCall('getWorkspaceAssets', () => api.get(`/workspace/${workspaceId}/assets`), [])

const uploadWorkspaceAssets = async (workspaceId, files) => {
  const formData = new FormData()
  const fileList = files instanceof File ? [files] : Array.from(files || [])
  if (fileList.length === 0) throw new Error('업로드할 파일이 없습니다.')
  fileList.forEach((file) => formData.append('files', file))
  return apiCall(
    'uploadWorkspaceAssets',
    () => api.post(`/workspace/${workspaceId}/assets`, formData, {
      timeout: 600000,
      transformRequest: [(data, headers) => { delete headers['Content-Type']; delete headers.common?.['Content-Type']; return data }],
    }),
    [],
  )
}

const deleteWorkspaceAsset = async (workspaceId, assetId) =>
  apiCall('deleteWorkspaceAsset', () => api.delete(`/workspace/${workspaceId}/assets/${assetId}`))

const deleteEditorJsImage = async (workspaceId, assetIdx) =>
  apiCall('deleteEditorJsImage', () => api.delete(`/workspace/${workspaceId}/assets/${assetIdx}/editorjs`))

const uploadEditorJsImage = async (workspaceId, file) => {
  if (!workspaceId) throw new Error('워크스페이스 ID가 없습니다. 먼저 게시물을 저장해주세요.')
  const formData = new FormData()
  formData.append('image', file)
  return apiCall(
    'uploadEditorJsImage',
    () => api.post(`/workspace/${workspaceId}/assets/editorjs`, formData, {
      timeout: 600000,
      transformRequest: [(data, headers) => { delete headers['Content-Type']; return data }],
    }),
  )
}

const saveWorkspaceAssetToDrive = async (workspaceId, assetId, parentId = null) =>
  apiCall('saveWorkspaceAssetToDrive', () =>
    api.post(`/workspace/${workspaceId}/assets/${assetId}/save-to-drive`, null, {
      params: parentId == null ? {} : { parentId },
    }),
  )

// ─────────────────────────────────────────────────────────────────────────────

export default {
  subscribeWebPush,
  unsubscribeWebPush,
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  savePost,
  getPost,
  allPosts,
  deletePost,
  list_delete,
  inviteUser,
  getPostByUuid,
  verifyEmail,
  updateShareStatus,
  loadRole,
  saveRole,
  changeUserRole,   // ✅ 추가
  kickUser,         // ✅ 추가
  getWorkspaceAssets,
  uploadWorkspaceAssets,
  deleteWorkspaceAsset,
  deleteEditorJsImage,
  uploadEditorJsImage,
  saveWorkspaceAssetToDrive,
}