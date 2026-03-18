import api from '@/plugins/axiosinterceptor'

const VAPID_PUBLIC_KEY =
  'BLHgfPga02L2u89uc4xjhbUFTy_U04rQCjGq7o24oxtqfVmAPHTxOmp6xndSHZtGQpmt7gqTFdMXco2gRNP7_p8'

// ─────────────────────────────────────────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────────────────────────────────────────

/**
 * VAPID 공개키를 Uint8Array로 변환합니다.
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

/**
 * BaseResponse 구조에서 실제 데이터를 꺼냅니다.
 *
 * 백엔드 성공 응답 형태:
 * {
 *   success: true,
 *   code: 2000,
 *   message: "요청이 성공했습니다.",
 *   result: { body: <실제 데이터> }
 * }
 */
const extractBody = (baseResponse) => {
  if (!baseResponse) return null
  // BaseResponse.success(ResponseEntity.ok(result)) 구조
  if (baseResponse?.result?.body !== undefined) return baseResponse.result.body
  // 그 외 중첩 구조 방어
  if (baseResponse?.data?.result?.body !== undefined) return baseResponse.data.result.body
  if (baseResponse?.data !== undefined) return baseResponse.data
  return baseResponse
}

/**
 * API 호출을 공통으로 처리합니다.
 *  - 성공(success: true)  → extractBody() 결과를 반환합니다.
 *  - 실패(success: false) → 콘솔에 [code] message 형태로 출력한 뒤 예외를 던집니다.
 *  - HTTP/네트워크 오류   → 콘솔에 상세 오류를 출력한 뒤 예외를 다시 던집니다.
 *
 * @param {string}   label   - 콘솔 출력에 쓸 기능명 (예: 'savePost')
 * @param {Function} request - api.get / api.post 등을 실행하는 async 함수
 * @param {*}        [fallback=null] - 실패 시 반환할 기본값 (throw 대신 기본값 반환이 필요할 때)
 */
const apiCall = async (label, request, fallback = undefined) => {
  try {
    const response = await request()
    const baseResponse = response.data

    // 백엔드가 success: false 를 내려보낸 경우 (HTTP 200 이지만 비즈니스 오류)
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
    // 이미 위에서 만든 비즈니스 오류는 그대로 재던짐
    if (error.baseResponse) throw error

    // HTTP 오류 또는 네트워크 오류
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

/**
 * 웹 푸시 알림을 구독합니다.
 * 브라우저가 지원하지 않거나 권한이 거부된 경우 null을 반환합니다.
 */
const subscribeWebPush = async () => {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
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

    const { endpoint, keys } = subscription.toJSON()
    return await apiCall('subscribeWebPush', () =>
      api.post('/notification/subscribe', { endpoint, keys }),
    )
  } catch (error) {
    console.error('[subscribeWebPush] 알림 구독 실패:', error)
    throw error
  }
}

/**
 * 알림 목록을 조회합니다.
 * @returns {Array} 알림 목록
 */
const getNotifications = async () =>
  apiCall('getNotifications', () => api.get('/notification/list'))

/**
 * 알림을 읽음 처리합니다.
 * @param {{ id?: number|null, uuid?: string|null }} param
 */
const markNotificationAsRead = async ({ id = null, uuid = null } = {}) =>
  apiCall('markNotificationAsRead', () => api.patch('/notification/read', { id, uuid }))

/**
 * 알림을 삭제합니다.
 * @param {{ id?: number|null, uuid?: string|null }} param
 */
const deleteNotification = async ({ id = null, uuid = null } = {}) =>
  apiCall('deleteNotification', () =>
    api.delete('/notification', { data: { id, uuid } }),
  )

// ─────────────────────────────────────────────────────────────────────────────
// 워크스페이스 CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 워크스페이스를 저장(생성 또는 수정)합니다.
 * @param {{ idx?: number, title: string, contents: string }} formData
 * @returns {PostDto.ResPost}
 */
const savePost = async (formData) =>
  apiCall('savePost', () => api.post('/workspace/save', formData))

/**
 * 워크스페이스를 단건 조회합니다.
 * @param {number} idx
 * @returns {PostDto.ResPost}
 */
const getPost = async (idx) =>
  apiCall('getPost', () => api.get(`/workspace/read/${idx}`))

/**
 * 내 워크스페이스 전체 목록을 조회합니다.
 * @returns {PostDto.ResList[]}
 */
const allPosts = async () =>
  apiCall('allPosts', () => api.get('/workspace/list'))

/**
 * 워크스페이스를 삭제합니다 (ADMIN 전용).
 * @param {number} idx
 * @returns {BaseResponseStatus}
 */
const deletePost = async (idx) =>
  apiCall('deletePost', () => api.post(`/workspace/delete/${idx}`))

/**
 * 내 목록에서 워크스페이스를 제거합니다 (관계만 삭제).
 * @param {number} idx
 * @returns {BaseResponseStatus}
 */
const list_delete = async (idx) =>
  apiCall('list_delete', () => api.post(`/workspace/delete/list/${idx}`))

// ─────────────────────────────────────────────────────────────────────────────
// 공유 / 초대
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 사용자를 워크스페이스에 초대합니다.
 * @param {{ uuid: string, type?: string, email?: string }} inviteData
 * @returns {BaseResponseStatus}
 */
const inviteUser = async (inviteData) =>
  apiCall(
    'inviteUser',
    () =>
      api.post('/workspace/invite', null, {
        params: {
          uuid: inviteData.uuid,
          type: inviteData.type,
          email: inviteData.email,
        },
        timeout: 15000,
      }),
  )

/**
 * UUID로 워크스페이스를 조회하고, Public인 경우 자동 참여합니다.
 * @param {string} uuid
 * @returns {PostDto.ResUuidLookup}
 */
const getPostByUuid = async (uuid) =>
  apiCall('getPostByUuid', () => api.get(`/workspace/by-uuid/${uuid}`))

/**
 * 이메일 초대 링크를 수락하거나 거절합니다.
 * @param {string} uuid  - 초대 토큰
 * @param {'accept'|'reject'} type
 * @returns {BaseResponseStatus}
 */
const verifyEmail = async (uuid, type) =>
  apiCall('verifyEmail', () =>
    api.get('/workspace/verify', { params: { uuid, type } }),
  )

/**
 * 워크스페이스 공유 상태를 변경합니다.
 * @param {number} idx
 * @param {'Private'|'Public'|'Shared'} status
 * @returns {BaseResponseStatus}
 */
const updateShareStatus = async (idx, status) =>
  apiCall('updateShareStatus', () =>
    api.post(`/workspace/isShared/${idx}`, {
      type: status !== 'Private',
      status,
    }),
  )

// ─────────────────────────────────────────────────────────────────────────────
// 권한
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 워크스페이스 참여자 권한 목록을 조회합니다 (ADMIN 전용).
 * @param {number} idx
 * @returns {UserPostDto.ResRole[]}
 */
const loadRole = async (idx) =>
  apiCall('loadRole', () => api.get(`/workspace/loadRole/${idx}`))

/**
 * 워크스페이스 참여자 권한을 저장합니다 (ADMIN 전용).
 * @param {number} idx
 * @param {Record<number, AccessRole>} roleData  - { userId: 'READ' | 'WRITE' | ... }
 * @returns {BaseResponseStatus}
 */
const saveRole = async (idx, roleData) =>
  apiCall('saveRole', () => api.post(`/workspace/saveRole/${idx}`, roleData))

// ─────────────────────────────────────────────────────────────────────────────
// 첨부 파일(에셋)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 워크스페이스 에셋 목록을 조회합니다.
 * @param {number} workspaceId
 * @returns {Asset[]}
 */
const getWorkspaceAssets = async (workspaceId) =>
  apiCall(
    'getWorkspaceAssets',
    () => api.get(`/workspace/${workspaceId}/assets`),
    [], // 실패 시 빈 배열 반환
  )

/**
 * 워크스페이스에 파일을 업로드합니다.
 * @param {number}    workspaceId
 * @param {FileList|File[]} files
 * @returns {Asset[]}
 */
const uploadWorkspaceAssets = async (workspaceId, files) => {
  const formData = new FormData()
  Array.from(files || []).forEach((file) => formData.append('files', file))

  return apiCall(
    'uploadWorkspaceAssets',
    () => api.post(`/workspace/${workspaceId}/assets`, formData, { timeout: 600000 }),
    [],
  )
}

/**
 * 워크스페이스 에셋을 삭제합니다.
 * @param {number} workspaceId
 * @param {number} assetId
 */
const deleteWorkspaceAsset = async (workspaceId, assetId) =>
  apiCall('deleteWorkspaceAsset', () =>
    api.delete(`/workspace/${workspaceId}/assets/${assetId}`),
  )

// ─────────────────────────────────────────────────────────────────────────────

export default {
  subscribeWebPush,
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
  getWorkspaceAssets,
  uploadWorkspaceAssets,
  deleteWorkspaceAsset,
}