<script setup>
import { ref } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import Header from '../components/Header.vue'
import Chat from '@/components/Chat.vue'

const isChatOpen = ref(false)

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