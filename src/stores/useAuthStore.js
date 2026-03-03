import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isLogin = ref(false)
  const user = ref(null)

  // 로그인 처리
  const login = (userInfo) => {
    isLogin.value = true
    // userInfo가 문자열로 들어올 경우를 대비한 파싱
    const userData = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo
    
    // 백엔드 응답 구조에 따라 userData.result 또는 userData 자체를 할당
    user.value = userData.result || userData
    
    // 로컬 스토리지 키값을 'USERINFO'로 통일
    localStorage.setItem('USERINFO', JSON.stringify(user.value))
  }

  // 로그인 상태 확인 (새로고침 시 호출용)
  const checkLogin = () => {
    const userData = localStorage.getItem('USERINFO')

    // 데이터가 없거나, 문자열 "undefined", "null"인 경우 방어 코드
    if (!userData || userData === "undefined" || userData === "null") {
      user.value = null
      isLogin.value = false
      return
    }

    try {
      user.value = JSON.parse(userData)
      isLogin.value = true
    } catch (error) {
      console.error("사용자 정보 파싱 실패 (JSON SyntaxError):", error)
      user.value = null
      isLogin.value = false
      localStorage.removeItem('USERINFO') // 잘못된 데이터 삭제
    }
  }

  // 로그아웃 처리
  const logout = () => {
    isLogin.value = false
    user.value = null
    localStorage.removeItem('USERINFO')
  }

  return { isLogin, user, login, checkLogin, logout }
})