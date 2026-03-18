import postApi from '@/api/postApi'

export const registerPushNotification = async () => {
  try {
    await postApi.subscribeWebPush()
    console.log('푸시 알림 등록 성공')
  } catch (error) {
    console.error('푸시 알림 등록 실패:', error)
    throw error
  }
}
