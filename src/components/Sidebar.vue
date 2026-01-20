<script setup>
import { ref } from 'vue'
import FileUpload from '@/components/function/FilesUpload.vue';

const isPersonalOpen = ref(true)
const isSharedOpen = ref(true)
const isSidebarOpen = ref(true) // 사이드바 토글 상태

const personalItems = ['SSL 인증서', '포트폴리오', 'Vue 학습']
const sharedItems = ['한화 부트캠프 24기', '프로젝트 팀A']


const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// 사이드바 토글 함수
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}
</script>

<template>
  <!-- Wrapper for sidebar and toggle button -->
  <div class="relative">
    <!-- Sidebar -->
    <aside 
      class="bg-[var(--bg-main)] border-r border-[var(--border-color)] flex flex-col transition-all duration-300"
      :class="isSidebarOpen ? 'w-64' : 'w-0 border-r-0'"
    >
      <div :class="isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'" class="transition-opacity duration-300">
        <!-- Logo -->
        <RouterLink 
          :to="{ name: 'home' }" 
          class="py-6 px-6 pb-4 flex items-center gap-3 no-underline cursor-pointer transition-opacity duration-200 hover:opacity-80"
          @click="scrollToTop"
        >
          <div class="w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span class="font-bold text-lg text-[var(--text-main)] tracking-tight no-underline">FileInNOut</span>
        </RouterLink>

        <!-- Navigation -->
        <nav class="flex-1 px-3 overflow-y-auto">
          <div class="mb-6">
            <!-- Upload Button -->
            <FileUpload class="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-blue-700 bg-sky-200 rounded-xl transition-all duration-150 hover:bg-sky-300 active:bg-sky-400">
            </FileUpload>
            <br>

            <!-- Navigation Links -->
            <RouterLink
              :to="{ name: 'home' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              active-class="!bg-blue-500/10 !text-blue-600 !font-bold dark:!bg-blue-400/20 dark:!text-blue-400"
            >
              <i class="fa-solid fa-house w-5 text-center flex-shrink-0 text-lg"></i>
              <span>홈</span>
            </RouterLink>

            <RouterLink
              :to="{ name: 'drive' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              active-class="!bg-blue-500/10 !text-blue-600 !font-bold dark:!bg-blue-400/20 dark:!text-blue-400"
            >
              <i class="fa-brands fa-google-drive w-5 text-center flex-shrink-0 text-lg"></i>
              <span>내 드라이브</span>
            </RouterLink>

            <RouterLink
              :to="{ name: 'shareFile' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              active-class="!bg-blue-500/10 !text-blue-600 !font-bold dark:!bg-blue-400/20 dark:!text-blue-400"
            >
              <i class="fa-solid fa-people-group w-5 text-center flex-shrink-0 text-lg"></i>
              <span>공유 문서함</span>
            </RouterLink>

            <RouterLink
              :to="{ name: 'recentFile' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              active-class="!bg-blue-500/10 !text-blue-600 !font-bold dark:!bg-blue-400/20 dark:!text-blue-400"
            >
              <i class="fa-solid fa-clock w-5 text-center flex-shrink-0 text-lg"></i>
              <span>최근 문서함</span>
            </RouterLink>
          </div>

          <!-- Divider -->
          <div class="border-t border-[var(--border-color)] my-4 mx-2"></div>

          <!-- Personal Section -->
          <div>
            <div
              @click="isPersonalOpen = !isPersonalOpen"
              class="flex items-center justify-between px-4 py-2 cursor-pointer rounded-lg transition-colors duration-200 hover:bg-[var(--bg-input)]"
            >
              <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">개인 페이지</h3>
              <span
                class="text-xs text-[var(--text-muted)] transition-transform duration-200"
                :class="{ 'rotate-180': !isPersonalOpen }"
              >
                ▼
              </span>
            </div>

            <div v-show="isPersonalOpen" class="mt-1 space-y-1">
              <div
                v-for="item in personalItems"
                :key="item"
                class="px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl cursor-pointer flex items-center gap-3.5 transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              >
                <i class="fa-solid fa-file-lines w-5 text-center flex-shrink-0 text-lg"></i>
                <span>{{ item }}</span>
              </div>
            </div>
          </div>

          <!-- Shared Section -->
          <div>
            <div
              @click="isSharedOpen = !isSharedOpen"
              class="flex items-center justify-between px-4 py-2 cursor-pointer rounded-lg transition-colors duration-200 hover:bg-[var(--bg-input)]"
            >
              <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">협업 페이지</h3>
              <span
                class="text-xs text-[var(--text-muted)] transition-transform duration-200"
                :class="{ 'rotate-180': !isSharedOpen }"
              >
                ▼
              </span>
            </div>

            <div v-show="isSharedOpen" class="mt-1 space-y-1">
              <div
                v-for="team in sharedItems"
                :key="team"
                class="px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl cursor-pointer flex items-center gap-3.5 transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              >
                <i class="fa-solid fa-file-lines w-5 text-center flex-shrink-0 text-lg"></i>
                <span>{{ team }}</span>
              </div>
            </div>
            
            <!-- Divider -->
            <div class="border-t border-[var(--border-color)] my-4 mx-2"></div>
            
            <!-- Trash -->
            <RouterLink
              :to="{ name: 'trash' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
            >
              <i class="fa-solid fa-trash w-5 text-center flex-shrink-0 text-lg"></i>
              <span>휴지통</span>
            </RouterLink>

            <!-- Storage Section -->
            <div class="p-3 pt-2">
              <RouterLink 
                :to="{ name: 'storage' }" 
                class="flex items-center gap-3.5 text-[var(--text-secondary)] mb-3 transition-all duration-200 hover:text-[var(--text-main)] no-underline"
              >
                <i class="fa-solid fa-cloud w-5 text-center flex-shrink-0 text-lg"></i>
                <span class="text-sm">저장용량</span>
              </RouterLink>

              <!-- Storage Bar -->
              <div class="w-full bg-[var(--bg-input)] rounded-full h-1.5 mb-2 overflow-hidden">
                <div class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300" style="width: 45%"></div>
              </div>

              <p class="text-xs text-[var(--text-muted)] mb-4">15GB 중 6.75GB 사용</p>

              <!-- Upgrade Button -->
              <RouterLink
                :to="{ name: 'payment' }"
                class="block w-full text-center border border-[var(--border-color)] px-2 py-2 rounded-full text-sm font-semibold text-blue-600 dark:text-blue-400 bg-[var(--bg-main)] transition-all duration-200 hover:bg-blue-500/10 dark:hover:bg-blue-400/10"
              >
                추가 저장용량 구매
              </RouterLink>
            </div>
          </div>
        </nav>
      </div>
    </aside>

    <!-- Toggle Button -->
    <button
      @click="toggleSidebar"
      class="absolute top-4 z-50 w-8 h-8 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg flex items-center justify-center text-[var(--text-main)] shadow-lg transition-all duration-300 hover:bg-[var(--bg-input)] hover:scale-110"
      :class="isSidebarOpen ? 'left-[15rem]' : 'left-2'"
      :title="isSidebarOpen ? '사이드바 숨기기' : '사이드바 보이기'"
    >
      <i class="fas transition-transform duration-300" :class="isSidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'"></i>
    </button>
  </div>
</template>

<style scoped>
/* Scrollbar Styling */
nav::-webkit-scrollbar {
  width: 6px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

nav::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

nav::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>