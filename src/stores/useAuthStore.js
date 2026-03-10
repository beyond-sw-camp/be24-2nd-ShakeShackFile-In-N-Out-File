import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isLogin = ref(false)
  const user = ref(null)
  const token = ref(null) // 필수: Access Token 저장용 상태

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
      } catch (e) {
        logout()
      }
    } else {
      logout()
    }
  }

  // 로그아웃 처리
  const logout = () => {
    isLogin.value = false
    user.value = null
    token.value = null
    localStorage.removeItem('USERINFO')
    localStorage.removeItem('ACCESS_TOKEN')
  }

  return { isLogin, user, token, login, setToken, checkLogin, logout }
})