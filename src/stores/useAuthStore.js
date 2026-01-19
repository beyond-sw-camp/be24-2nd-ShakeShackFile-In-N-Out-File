import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isLogin = ref(false)
  const user = ref(null)
  const login = (userInfo) => {
    isLogin.value = true
    const userData = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo
    user.value = userData
    localStorage.setItem('USERINFO', userInfo)
  }

  const checkLogin = () => {
    const savedInfo = localStorage.getItem('USERINFO')
    if (savedInfo) {
      isLogin.value = true
      user.value = JSON.parse(savedInfo)
    }
    return isLogin.value
  }
  const logout = () => {
    isLogin.value = false
    user.value = null
    localStorage.removeItem('USERINFO')
  }
  return { isLogin, user, login, checkLogin, logout }
})