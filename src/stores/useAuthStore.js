import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios' // axios 임포트 추가

export const useAuthStore = defineStore('auth', () => {
  const isLogin = ref(false)
  const user = ref(null)
  const token = ref(null)

  const decodeToken = (tokenStr) => {
    try {
      const payload = tokenStr.split('.')[1]
      const decoded = decodeURIComponent(escape(atob(payload)))
      return JSON.parse(decoded)
    } catch (error) {
      console.error("토큰 디코딩 실패:", error)
      return null
    }
  }

  const login = (accessToken) => {
    if (!accessToken) return

    token.value = accessToken
    localStorage.setItem('ACCESS_TOKEN', accessToken)

    const userInfo = decodeToken(accessToken)
    if (userInfo) {
      user.value = userInfo
      isLogin.value = true
      localStorage.setItem('USERINFO', JSON.stringify(userInfo))
    }
  }

  // 수정됨: isLogin 상태 업데이트 로직 추가
  const setToken = (newAccessToken) => {
    if (!newAccessToken) return
    token.value = newAccessToken
    localStorage.setItem('ACCESS_TOKEN', newAccessToken)
    
    const userInfo = decodeToken(newAccessToken)
    if (userInfo) {
      user.value = userInfo
      isLogin.value = true // 누락되었던 로그인 상태 갱신 추가
      localStorage.setItem('USERINFO', JSON.stringify(userInfo))
    }
  }

  const isTokenExpired = (tokenStr) => {
  const decoded = decodeToken(tokenStr)
  if (!decoded || !decoded.exp) return true
  // exp는 초 단위이므로 밀리초로 변환하여 현재 시간과 비교
  return (decoded.exp * 1000) < Date.now()
}

  const checkLogin = () => {
    const savedToken = localStorage.getItem('ACCESS_TOKEN')
    const savedUser = localStorage.getItem('USERINFO')

    if (savedToken && !isTokenExpired(savedToken) && savedUser && savedUser !== "undefined") {
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

  const logout = () => {
    isLogin.value = false
    user.value = null
    token.value = null
    localStorage.removeItem('USERINFO')
    localStorage.removeItem('ACCESS_TOKEN')
  }

  // 신규 추가: Refresh Token을 이용해 Access Token을 재발급 받는 함수
  const reissueToken = async () => {
    try {
      const res = await axios.post('/auth/reissue', {}, { 
        baseURL: 'http://localhost:8080', // 운영 환경에 맞춰 환경변수 처리 필요
        withCredentials: true 
      })
      
      const newAccessToken = res.headers['authorization']?.replace('Bearer ', '')
      
      if (newAccessToken) {
        setToken(newAccessToken) // 내부 상태 및 로컬 스토리지 갱신
        return newAccessToken
      } else {
        throw new Error('응답 헤더에 토큰이 없습니다.')
      }
    } catch (error) {
      console.error('토큰 재발급 실패:', error)
      logout() // 재발급 실패 시 기존 정보 초기화
      throw error // 라우터 가드 및 인터셉터에서 예외 처리를 위해 에러 던짐
    }
  }

  // return 객체에 reissueToken 추가
  return { isLogin, user, token, login, setToken, checkLogin, logout, reissueToken }
})