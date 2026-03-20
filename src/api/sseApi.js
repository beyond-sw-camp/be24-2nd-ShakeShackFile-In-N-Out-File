// ─────────────────────────────────────────────────────────────────────────────
// SSE (Server-Sent Events) 연결 및 관리
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSE 연결을 설정하고 EventSource 인스턴스를 반환합니다.
 * @param {Object} params - 연결에 필요한 파라미터
 * @param {number|string} params.userId - 구독할 사용자 ID
 * @param {Function} params.onConnect - 연결 성공 시 콜백
 * @param {Function} params.onTitleUpdated - 타이틀 갱신 이벤트 수신 시 콜백
 * @param {Function} params.onError - 에러 발생 시 콜백
 * @returns {EventSource} 생성된 EventSource 객체
 */
const connectWorkspaceSse = ({ userId, onConnect, onTitleUpdated, onError }) => {
  // EventSource는 기본적으로 커스텀 헤더(Authorization 등)를 지원하지 않습니다.
  // 따라서 access token을 쿼리로 전달하고, 백엔드에서 이를 인증에 사용하도록 매핑합니다.
  const token = typeof window !== 'undefined' ? localStorage.getItem('ACCESS_TOKEN') : null
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : ''

  // 프론트엔드(Vite)에는 proxy 설정이 없으므로 백엔드 주소를 명시합니다.
  const url = `http://localhost:8080/api/sse/connect${tokenQuery}`
  const eventSource = new EventSource(url)

  // 1. 초기 연결 성공 이벤트 (EventSource는 onopen을 주로 사용)
  eventSource.onopen = (event) => {
    console.log('[SSE] 연결 성공 (userId:', userId, ')')
    if (onConnect) onConnect(event)
  }

  // 2. 타이틀 업데이트 이벤트 수신
  eventSource.addEventListener('title-updated', (event) => {
    try {
      const updatedData = JSON.parse(event.data) // { postId: 1, title: '새 제목' }
      console.log('[SSE] 타이틀 업데이트 수신:', updatedData)
      if (onTitleUpdated) onTitleUpdated(updatedData)
    } catch (e) {
      console.error('[SSE] 데이터 파싱 오류:', e)
    }
  })

  // 3. 에러 핸들링
  eventSource.onerror = (error) => {
    console.error('[SSE] 통신 오류 발생:', error)
    if (onError) onError(error)
    
    // 에러 발생 시 무한 재연결을 막거나 초기화하기 위해 연결을 닫는 것을 권장합니다.
    eventSource.close()
  }

  return eventSource
}

/**
 * SSE 연결을 안전하게 종료합니다.
 * @param {EventSource} eventSource - 종료할 EventSource 인스턴스
 */
const closeSse = (eventSource) => {
  if (eventSource && typeof eventSource.close === 'function') {
    eventSource.close()
    console.log('[SSE] 연결이 정상적으로 종료되었습니다.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default {
  connectWorkspaceSse,
  closeSse,
}