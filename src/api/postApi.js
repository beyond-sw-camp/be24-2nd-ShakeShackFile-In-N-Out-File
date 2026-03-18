import api from '@/plugins/axiosinterceptor'

const VAPID_PUBLIC_KEY = 'BLHgfPga02L2u89uc4xjhbUFTy_U04rQCjGq7o24oxtqfVmAPHTxOmp6xndSHZtGQpmt7gqTFdMXco2gRNP7_p8'

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

const extractBody = (responseData) => {
  if (!responseData) return null
  if (responseData?.result?.body !== undefined) return responseData.result.body
  if (responseData?.data?.result?.body !== undefined) return responseData.data.result.body
  if (responseData?.data !== undefined) return responseData.data
  return responseData
}

const subscribeWebPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return null
    }

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
    const response = await api.delete('/notification', {
      data: { id, uuid },
    })
    return response.data
  } catch (error) {
    console.error('알림 삭제 실패:', error)
    throw error
  }
}

const savePost = async (formData) => {
  try {
    const response = await api.post('/workspace/save', formData)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const getPost = async (idx) => {
  try {
    const response = await api.get(`/workspace/read/${idx}`)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const allPosts = async () => {
  try {
    const response = await api.get('/workspace/list')
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const deletePost = async (idx) => {
  try {
    const response = await api.post(`/workspace/delete/${idx}`)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const list_delete = async (idx) => {
  try {
    const response = await api.post(`/workspace/delete/list/${idx}`)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const inviteUser = async (inviteData) => {
  try {
    const response = await api.post('/workspace/invite', null, {
      params: {
        uuid: inviteData.uuid,
        type: inviteData.type,
        email: inviteData.email,
      },
      timeout: 15000,
    })

    return response.data
  } catch (error) {
    console.error('API Error (inviteUser):', error)
    throw error
  }
}

const updateShareStatus = async (idx, status) => {
  try {
    const requestBody = {
      type: status !== 'Private',
      status,
    }

    const response = await api.post(`/workspace/isShared/${idx}`, requestBody)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const loadRole = async (idx) => {
  try {
    const response = await api.get(`/workspace/loadRole/${idx}`)
    console.log(response)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const saveRole = async (idx, roleData) => {
  try {
    const response = await api.post(`/workspace/saveRole/${idx}`, roleData)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const verifyEmail = async (uuid, type) => {
  try {
    const response = await api.get('/workspace/verify', {
      params: {
        uuid,
        type,
      },
    })

    return response.data
  } catch (error) {
    console.error('Verify Email Error:', error)
    throw error
  }
}

const getPostByUuid = async (uuid) => {
  try {
    const response = await api.get(`/workspace/by-uuid/${uuid}`)
    return response.data
  } catch (error) {
    console.error(error)
    throw error
  }
}

const getWorkspaceAssets = async (workspaceId) => {
  try {
    const response = await api.get(`/workspace/${workspaceId}/assets`)
    return extractBody(response.data) || []
  } catch (error) {
    console.error('Workspace assets load error:', error)
    throw error
  }
}

const uploadWorkspaceAssets = async (workspaceId, files) => {
  try {
    const formData = new FormData()
    Array.from(files || []).forEach((file) => {
      formData.append('files', file)
    })

    const response = await api.post(`/workspace/${workspaceId}/assets`, formData, {
      timeout: 600000,
    })

    return extractBody(response.data) || []
  } catch (error) {
    console.error('Workspace assets upload error:', error)
    throw error
  }
}

const deleteWorkspaceAsset = async (workspaceId, assetId) => {
  try {
    const response = await api.delete(`/workspace/${workspaceId}/assets/${assetId}`)
    return extractBody(response.data)
  } catch (error) {
    console.error('Workspace asset delete error:', error)
    throw error
  }
}

export default {
  subscribeWebPush,
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  savePost,
  getPost,
  allPosts,
  deletePost,
  inviteUser,
  updateShareStatus,
  loadRole,
  saveRole,
  verifyEmail,
  getPostByUuid,
  list_delete,
  getWorkspaceAssets,
  uploadWorkspaceAssets,
  deleteWorkspaceAsset,
}
