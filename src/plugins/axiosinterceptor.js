import axios from 'axios'
// Pinia 스토어 임포트 (경로는 본인의 프로젝트 구조에 맞게 확인)
import { useAuthStore } from '@/stores/useAuthStore'

export const api = axios.create({
  baseURL: 'https://api.fileinnout.kro.kr',
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

    const isFormDataRequest =
      typeof FormData !== 'undefined' &&
      config.data instanceof FormData

    if (isFormDataRequest) {
      delete config.headers['Content-Type']
      delete config.headers['content-type']
      return config
    }

    // JSON 본문 요청에만 Content-Type을 지정합니다.
    if (config.method === 'post' && !config.headers['Content-Type'] && !config.headers['content-type']) {
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
        // 백엔드의 재발급 API 호출 (withCredentials 덕분에 HttpOnly 쿠키가 자동 전송됨)
        // 무한 루프를 막기 위해 api 인스턴스 대신 순수 axios 사용
        const res = await axios.post('/auth/reissue', {}, { 
          baseURL: 'https://api.fileinnout.kro.kr', // 프록시 설정을 타도록 빈 값 또는 환경변수 설정
          withCredentials: true 
        })
        
        // 새로 발급받은 Access Token을 헤더에서 추출 (소문자 authorization 주의)
        const newAccessToken = res.headers['authorization']?.replace('Bearer ', '')
        
        if (newAccessToken) {
          // 스토어의 토큰 값 갱신
          authStore.setToken(newAccessToken)
          
          // 실패했던 기존 요청의 헤더를 새 토큰으로 교체
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
          
          // 기존 요청 재실행
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh Token마저 만료되었거나 조작된 경우 (완전한 로그아웃 처리)
        console.error('토큰 재발급 실패. 다시 로그인해주세요.')
        authStore.logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
