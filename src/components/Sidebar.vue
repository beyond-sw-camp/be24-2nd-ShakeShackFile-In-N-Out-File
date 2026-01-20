<script setup>
import { ref } from 'vue'
import FileUpload from '@/components/function/FilesUpload.vue';

const isPersonalOpen = ref(true)
const isSharedOpen = ref(true)

const personalItems = ['SSL 인증서', '포트폴리오', 'Vue 학습']
const sharedItems = ['한화 부트캠프 24기', '프로젝트 팀A']

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
</script>

<template>
  <aside class="sidebar-container">
    <RouterLink 
      :to="{ name: 'home' }" 
      class="logo-wrapper"
      @click="scrollToTop"
    >
      <div class="w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <span class="logo-text">FileInNOut</span>
    </RouterLink>

    <nav class="sidebar-nav">
      <div class="mb-6 px-1">
        <FileUpload class="upload-button mb-4"></FileUpload>

        <RouterLink
          :to="{ name: 'home' }"
          class="nav-link"
          active-class="nav-link-active"
        >
          <i class="fa-solid fa-house"></i> 
          <span>홈</span>
        </RouterLink>

        <RouterLink
          :to="{ name: 'drive' }"
          class="nav-link"
          active-class="nav-link-active"
        >
          <i class="fa-brands fa-google-drive"></i> 
          <span>내 드라이브</span>
        </RouterLink>

        <RouterLink
          :to="{ name: 'shareFile' }"
          class="nav-link"
          active-class="nav-link-active"
        >
          <i class="fa-solid fa-people-group"></i> 
          <span>공유 문서함</span>
        </RouterLink>

        <RouterLink
          :to="{ name: 'recentFile' }"
          class="nav-link"
          active-class="nav-link-active"
        >
          <i class="fa-solid fa-clock"></i>
          <span>최근 문서함</span>
        </RouterLink>
      </div>

      <div class="divider"></div>

      <div class="mb-4">
        <div
          @click="isPersonalOpen = !isPersonalOpen"
          class="section-header"
        >
          <h3 class="section-title">개인 페이지</h3>
          <i class="fa-solid fa-chevron-down section-toggle" :class="{ 'rotate-180': !isPersonalOpen }"></i>
        </div>

        <div v-show="isPersonalOpen" class="mt-1 space-y-1">
          <div
            v-for="item in personalItems"
            :key="item"
            class="sidebar-item"
          >
            <i class="fa-solid fa-file-lines"></i> 
            <span>{{ item }}</span>
          </div>
        </div>
      </div>

      <div class="mb-4">
        <div
          @click="isSharedOpen = !isSharedOpen"
          class="section-header"
        >
          <h3 class="section-title">협업 페이지</h3>
          <i class="fa-solid fa-chevron-down section-toggle" :class="{ 'rotate-180': !isSharedOpen }"></i>
        </div>

        <div v-show="isSharedOpen" class="mt-1 space-y-1">
          <div
            v-for="team in sharedItems"
            :key="team"
            class="sidebar-item"
          >
            <i class="fa-solid fa-file-lines"></i>
            <span>{{ team }}</span>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <RouterLink
        :to="{ name: 'trash' }"
        class="nav-link"
        active-class="nav-link-active"
      >
        <i class="fa-solid fa-trash"></i>
        <span>휴지통</span>
      </RouterLink>

      <div class="storage-section">
        <RouterLink :to="{ name: 'storage' }" class="storage-link">
          <i class="fa-solid fa-cloud"></i>
          <span class="text-sm">저장용량</span>
        </RouterLink>

        <div class="storage-bar-container">
          <div class="storage-bar" style="width: 45%"></div>
        </div>

        <p class="storage-text">15GB 중 6.75GB 사용</p>

        <RouterLink
          :to="{ name: 'payment' }"
          class="upgrade-button"
        >
          추가 저장용량 구매
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar-container {
  width: 16rem;
  background-color: var(--bg-main);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.logo-wrapper {
  padding: 1.5rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
}

.logo-text {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--text-main);
  letter-spacing: -0.025em;
}

.sidebar-nav {
  flex: 1;
  padding: 0 0.75rem;
  overflow-y: auto;
}

.upload-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1d4ed8;
  background-color: #bae6fd;
  border-radius: 0.75rem;
}

/* 정렬의 핵심: nav-link와 sidebar-item 내부의 i 태그 너비 고정 */
.nav-link, .sidebar-item, .storage-link {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  border-radius: 0.75rem;
  transition: all 0.2s;
  text-decoration: none;
}

.nav-link i, .sidebar-item i, .storage-link i {
  width: 1.25rem; /* 아이콘 너비 고정 */
  text-align: center;
  flex-shrink: 0;
  font-size: 1.1rem;
}

.nav-link:hover, .sidebar-item:hover, .storage-link:hover {
  background-color: var(--bg-input);
  color: var(--text-main);
}

.nav-link-active {
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  font-weight: 700;
}

.divider {
  border-top: 1px solid var(--border-color);
  margin: 1rem 0.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 0.5rem;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.section-toggle {
  font-size: 0.75rem;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.rotate-180 {
  transform: rotate(180deg);
}

.storage-section {
  padding: 1rem 0.75rem;
}

.storage-bar-container {
  width: 100%;
  background-color: var(--bg-input);
  border-radius: 9999px;
  height: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.storage-bar {
  background-color: #2563eb;
  height: 100%;
}

.storage-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.upgrade-button {
  display: block;
  width: 100%;
  text-align: center;
  border: 1px solid var(--border-color);
  padding: 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
}

.upgrade-button:hover {
  background-color: rgba(59, 130, 246, 0.05);
}
</style>