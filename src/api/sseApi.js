import { EventSourcePolyfill } from 'event-source-polyfill'
import { apiPath } from '@/utils/backendUrl'

const SSE_OPTIONS = {
  heartbeatTimeout: 3600000,
}

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ACCESS_TOKEN') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const isFatalError = (eventSource) => eventSource.readyState === EventSourcePolyfill.CLOSED

const connectNotificationSse = ({ onNotification, onNewMessage, onError } = {}) => {
  const eventSource = new EventSourcePolyfill(apiPath('/sse/connect'), {
    headers: getAuthHeaders(),
    withCredentials: true,
    ...SSE_OPTIONS,
  })

  eventSource.addEventListener('notification', (e) => {
    try {
      const payload = JSON.parse(e.data)
      if (onNotification) onNotification(payload)
    } catch (err) {
      console.error('[SSE:notification] 이벤트 파싱 오류:', err)
    }
  })

  eventSource.addEventListener('new-message', (e) => {
    try {
      const payload = JSON.parse(e.data)
      if (onNewMessage) onNewMessage(payload)
    } catch (err) {
      console.error('[SSE:new-message] 이벤트 파싱 오류:', err)
    }
  })

  eventSource.addEventListener('title-updated', (e) => {
    try {
      const payload = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent('sse-title-updated', { detail: payload }))
    } catch (err) {
      console.error('[SSE:title-updated] 이벤트 파싱 오류:', err)
    }
  })

  eventSource.addEventListener('role-changed', (e) => {
    try {
      const payload = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent('sse-role-changed', { detail: payload }))
    } catch (err) {
      console.error('[SSE:role-changed] 이벤트 파싱 오류:', err)
    }
  })

  eventSource.onerror = (error) => {
    if (!isFatalError(eventSource)) return
    console.error('[SSE] 연결 오류 (fatal):', error)
    eventSource.close()
    if (onError) onError(error)
  }

  return eventSource
}

const connectWorkspaceSse = ({ userId, onConnect, onTitleUpdated, onError } = {}) => {
  const eventSource = new EventSourcePolyfill(apiPath('/sse/connect'), {
    headers: getAuthHeaders(),
    withCredentials: true,
    ...SSE_OPTIONS,
  })

  eventSource.onopen = (event) => {
    console.log('[SSE] 워크스페이스 연결 성공 (userId:', userId, ')')
    if (onConnect) onConnect(event)
  }

  eventSource.addEventListener('title-updated', (event) => {
    try {
      const updatedData = JSON.parse(event.data)
      window.dispatchEvent(new CustomEvent('sse-title-updated', { detail: updatedData }))
      if (onTitleUpdated) onTitleUpdated(updatedData)
    } catch (e) {
      console.error('[SSE:title-updated] 이벤트 파싱 오류:', e)
    }
  })

  eventSource.addEventListener('role-changed', (e) => {
    try {
      const payload = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent('sse-role-changed', { detail: payload }))
    } catch (err) {
      console.error('[SSE:role-changed] 이벤트 파싱 오류:', err)
    }
  })

  eventSource.onerror = (error) => {
    if (!isFatalError(eventSource)) return
    console.error('[SSE] 워크스페이스 연결 오류 (fatal):', error)
    eventSource.close()
    if (onError) onError(error)
  }

  return eventSource
}

const closeSse = (eventSource) => {
  if (eventSource && typeof eventSource.close === 'function') {
    eventSource.close()
    console.log('[SSE] 연결을 정상적으로 종료했습니다.')
  }
}

export default {
  connectNotificationSse,
  connectWorkspaceSse,
  closeSse,
}
