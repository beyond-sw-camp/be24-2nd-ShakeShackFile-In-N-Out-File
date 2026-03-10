<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router' // route와 router 추가
import { useAuthStore } from '@/stores/useAuthStore' // 스토어 추가
import Sidebar from '../components/Sidebar.vue'
import Header from '../components/Header.vue'
import Chat from '@/components/Chat.vue'

const isChatOpen = ref(false)
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

onMounted(() => {
  // 1. URL 쿼리 파라미터에서 token 추출 (백엔드가 주는 파라미터명 확인 필요)
  // 예: ?token=... 혹은 ?accessToken=...
  const token = route.query.token || route.query.accessToken

  if (token) {
    console.log("OAuth2 토큰 발견:", token)
    
    // 2. 스토어의 login 함수를 호출하여 로컬 스토리지에 저장 및 로그인 상태 활성화
    authStore.login(token)

    // 3. URL에서 토큰을 지워주기 위해 쿼리 파라미터를 제거한 주소로 replace
    // (보안 및 주소창 깔끔하게 유지)
    router.replace({ name: 'home' }) 
  }
})

// 2. 서버에서 가져오기 (GET)
const loadContent = async () => {
  try {
    const response = await axios.get('http://localhost:8080/api/posts/1')
    content.value = response.data.content
  } catch (error) {
    console.error('불러오기 실패:', error)
  }
}
</script>

<template>
  <div class="main-layout">
    <Sidebar />

    <div class="content-wrapper">
      <Header @toggle-chat="isChatOpen = !isChatOpen" />

      <div class="main-container">
        <main class="main-content">
          <RouterView />
        </main>

        <Chat :is-open="isChatOpen" @close="isChatOpen = false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  background-color: var(--bg-secondary);
  transition: background-color 0.3s ease;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: var(--bg-secondary);
  transition: all 0.3s ease;
}

/* 스크롤바 스타일 */
.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>