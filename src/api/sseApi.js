import { EventSourcePolyfill } from 'event-source-polyfill'

const BASE_URL = 'https://api.fileinnout.kro.kr'

const SSE_OPTIONS = {
  heartbeatTimeout: 3600000,
}

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ACCESS_TOKEN') : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const isFatalError = (eventSource) => eventSource.readyState === EventSourcePolyfill.CLOSED

// ─────────────────────────────────────────────────────────────────────────────
// 헤더 알림용 SSE
// ─────────────────────────────────────────────────────────────────────────────

const connectNotificationSse = ({ onNotification, onNewMessage, onError } = {}) => {
  const eventSource = new EventSourcePolyfill(`${BASE_URL}/api/sse/connect`, {
    headers: getAuthHeaders(),
    withCredentials: true,
    ...SSE_OPTIONS,
  })

  eventSource.addEventListener('notification', (e) => {
    try {
      const payload = JSON.parse(e.data)
      if (onNotification) onNotification(payload)
    } catch (err) {
      console.error('[SSE:notification] 데이터 파싱 오류:', err)
    }
  })

  eventSource.addEventListener('new-message', (e) => {
    try {
      const payload = JSON.parse(e.data)
      if (onNewMessage) onNewMessage(payload)
    } catch (err) {
      console.error('[SSE:new-message] 데이터 파싱 오류:', err)
    }
  })

  eventSource.addEventListener('title-updated', (e) => {
    try {
      const payload = JSON.parse(e.data)
      window.dispatchEvent(new CustomEvent('sse-title-updated', { detail: payload }))
    } catch (err) {
      console.error('[SSE:title-updated] 데이터 파싱 오류:', err)
    }
  })

  // ✅ 역할 변경 / 추방 이벤트
  eventSource.addEventListener('role-changed', (e) => {
    try {
      const payload = JSON.parse(e.data) // { postIdx, newRole }
      console.log('[SSE] role-changed 수신:', payload)
      window.dispatchEvent(new CustomEvent('sse-role-changed', { detail: payload }))
    } catch (err) {
      console.error('[SSE:role-changed] 데이터 파싱 오류:', err)
    }
  })

  eventSource.onerror = (error) => {
    if (!isFatalError(eventSource)) return
    console.error('[SSE] 알림 연결 끊김 (fatal):', error)
    eventSource.close()
    if (onError) onError(error)
  }

  return eventSource
}

// ─────────────────────────────────────────────────────────────────────────────
// 워크스페이스용 SSE
// ─────────────────────────────────────────────────────────────────────────────

const connectWorkspaceSse = ({ userId, onConnect, onTitleUpdated, onError } = {}) => {
  const eventSource = new EventSourcePolyfill(`${BASE_URL}/api/sse/connect`, {
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
      console.log('[SSE] 타이틀 업데이트 수신:', updatedData)
      window.dispatchEvent(new CustomEvent('sse-title-updated', { detail: updatedData }))
      if (onTitleUpdated) onTitleUpdated(updatedData)
    } catch (e) {
      console.error('[SSE:title-updated] 데이터 파싱 오류:', e)
    }
  })

  // ✅ 역할 변경 / 추방 이벤트
  eventSource.addEventListener('role-changed', (e) => {
    try {
      const payload = JSON.parse(e.data)
      console.log('[SSE] role-changed 수신:', payload)
      window.dispatchEvent(new CustomEvent('sse-role-changed', { detail: payload }))
    } catch (err) {
      console.error('[SSE:role-changed] 데이터 파싱 오류:', err)
    }
  })

  eventSource.onerror = (error) => {
    if (!isFatalError(eventSource)) return
    console.error('[SSE] 워크스페이스 연결 끊김 (fatal):', error)
    eventSource.close()
    if (onError) onError(error)
  }

  return eventSource
}

// ─────────────────────────────────────────────────────────────────────────────

const closeSse = (eventSource) => {
  if (eventSource && typeof eventSource.close === 'function') {
    eventSource.close()
    console.log('[SSE] 연결이 정상적으로 종료되었습니다.')
  }
}

export default {
  connectNotificationSse,
  connectWorkspaceSse,
  closeSse,
}