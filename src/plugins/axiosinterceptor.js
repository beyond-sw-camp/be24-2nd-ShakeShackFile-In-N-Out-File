import axios from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'


export const api = axios.create({
  baseURL: 'http://localhost:8080',
  withCredentials: true, // Refresh Token 쿠키를 주고받기 위해 필수
  timeout: 5000,
})

// [1] 요청(Request) 인터셉터: Access Token 헤더 주입
api.interceptors.request.use(
  (config) => {
    // 인터셉터 내부에서 스토어를 호출해야 초기화 순서로 인한 에러를 방지할 수 있음
    const authStore = useAuthStore()
    const token = authStore.token

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    
    // post 요청일 경우 Content-Type 강제 지정 (기존 postApi의 역할 대체)
    if (config.method === 'post' && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json'
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// [2] 응답(Response) 인터셉터: 토큰 만료 처리 및 자동 재발급
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const authStore = useAuthStore()

    // 에러 코드가 401(Unauthorized)이고, 아직 재시도를 하지 않은 요청인 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true // 무한 루프 방지 플래그

      try {
        // 스토어의 재발급 액션 호출 (비동기 대기)
        const newAccessToken = await authStore.reissueToken()
        
        // 실패했던 기존 API 요청의 헤더를 새 토큰으로 교체
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
        
        // 갱신된 헤더로 기존 API 요청 재실행
        return api(originalRequest)
      } catch (refreshError) {
        // 재발급 실패 처리 (Store 내부에서 이미 logout 처리됨)
        console.error('토큰 재발급 실패. 다시 로그인해주세요.')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api