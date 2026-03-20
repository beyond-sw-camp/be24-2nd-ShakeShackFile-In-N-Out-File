import axios from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'
import { API_BASE_URL } from '@/config/runtime'

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 5000,
})

api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    const token = authStore.token

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const isFormDataRequest =
      typeof FormData !== 'undefined' &&
      config.data instanceof FormData

    if (isFormDataRequest) {
      delete config.headers['Content-Type']
      delete config.headers['content-type']
      return config
    }

    if (config.method === 'post' && !config.headers['Content-Type'] && !config.headers['content-type']) {
      config.headers['Content-Type'] = 'application/json'
    }

    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const authStore = useAuthStore()

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const res = await axios.post('/auth/reissue', {}, {
          baseURL: API_BASE_URL,
          withCredentials: true,
        })

        const newAccessToken = res.headers.authorization?.replace('Bearer ', '')

        if (newAccessToken) {
          authStore.setToken(newAccessToken)
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        console.error('토큰 재발급 실패. 다시 로그인해 주세요.')
        authStore.logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default api
