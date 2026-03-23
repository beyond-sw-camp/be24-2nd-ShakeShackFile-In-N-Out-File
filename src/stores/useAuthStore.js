import { defineStore } from 'pinia'
import { ref } from 'vue'
import postApi from '@/api/postApi'
import sseApi from '@/api/sseApi'
import userApi from '@/api/user/index.js'

export const useAuthStore = defineStore('auth', () => {
  const isLogin = ref(false)
  const user = ref(null)
  const token = ref(null) // 필수: Access Token 저장용 상태
  const sseInstance = ref(null) // SSE 인스턴스 저장용

  // JWT Base64 페이로드 디코딩 유틸리티 함수
  const decodeToken = (tokenStr) => {
    try {
      const payload = tokenStr.split('.')[1]
      // Base64 디코딩 후 한글 깨짐 방지를 위해 decodeURIComponent 사용
      const decoded = decodeURIComponent(escape(atob(payload)))
      return JSON.parse(decoded)
    } catch (error) {
      console.error("토큰 디코딩 실패:", error)
      return null
    }
  }

  // 로그인 처리 (Login.vue에서 Access Token 문자열만 넘겨받음)
  const login = (accessToken) => {
    if (!accessToken) return

    token.value = accessToken
    localStorage.setItem('ACCESS_TOKEN', accessToken)

    // 토큰을 디코딩하여 백엔드가 심어둔 정보(idx, email, role 등)를 추출
    const userInfo = decodeToken(accessToken)
    if (userInfo) {
      user.value = userInfo
      isLogin.value = true
      // 사용자 정보도 UI 표시를 위해 로컬 스토리지에 캐싱
      localStorage.setItem('USERINFO', JSON.stringify(userInfo))

      // ✅ 로그인 성공 즉시 SSE 연결 시작 (userInfo에 담긴 고유 idx 활용)
      startSseConnection(userInfo.idx);
    }
  }

  // 인터셉터에서 토큰 재발급 시 호출할 전용 액션
  const setToken = (newAccessToken) => {
    if (!newAccessToken) return
    token.value = newAccessToken
    localStorage.setItem('ACCESS_TOKEN', newAccessToken)

    const userInfo = decodeToken(newAccessToken)
    if (userInfo) {
      user.value = userInfo
      localStorage.setItem('USERINFO', JSON.stringify(userInfo))
    }
  }

  // 로그인 상태 확인 (새로고침 시 앱 초기화 단계에서 호출)
  const checkLogin = () => {
    const savedToken = localStorage.getItem('ACCESS_TOKEN')
    const savedUser = localStorage.getItem('USERINFO')

    if (savedToken && savedUser && savedUser !== "undefined") {
      token.value = savedToken
      try {
        user.value = JSON.parse(savedUser)
        isLogin.value = true

        // ✅ 새로고침 시에도 로그인 상태라면 SSE 재연결
        startSseConnection(user.value.idx);
      } catch (e) {
        logout()
      }
    } else {
      logout()
    }
  }

  // 로그아웃 처리
  const logout = async () => {
    try {
      // ✅ 로그아웃 프로세스 시작 시 SSE 연결부터 안전하게 종료
      stopSseConnection();

      if (token.value || localStorage.getItem('ACCESS_TOKEN')) {
        try {
          await postApi.unsubscribeWebPush()
        } catch (error) {
          console.error('푸시 구독 해제 실패:', error)
        }

        await userApi.logout()
      }
    } catch (error) {
      console.error("로그아웃 API 호출 실패:", error)
    } finally {
      isLogin.value = false
      user.value = null
      token.value = null
      localStorage.removeItem('USERINFO')
      localStorage.removeItem('ACCESS_TOKEN')
    }
  }

  // SSE 처리
  const startSseConnection = (userId) => {
    // 이미 연결된 경우 중복 연결 방지
    if (sseInstance.value) return;

    sseInstance.value = sseApi.connectWorkspaceSse({
      userId: userId,
      onConnect: () => console.log(`[SSE] 사용자 ${userId} 연결 성공`),
      onTitleUpdated: (updatedData) => {
        // 방법 1: 직접 여기서 리스트를 관리하는 스토어의 액션을 호출
        // const postStore = usePostStore();
        // postStore.updateItemTitle(updatedData);
        
        // 방법 2: 커스텀 이벤트를 발생시켜 필요한 컴포넌트에서 듣게 함
        window.dispatchEvent(new CustomEvent('sse-title-updated', { detail: updatedData }));
      },
      onError: () => {
        sseInstance.value = null; // 에러 시 참조 제거
      }
    });
  }

  const stopSseConnection = () => {
    if (sseInstance.value) {
      sseApi.closeSse(sseInstance.value);
      sseInstance.value = null;
    }
  }

  return { isLogin, user, token, login, setToken, checkLogin, logout }
})
