<script setup>
import { onMounted } from 'vue';

onMounted (() => {
  // 테마 초기화 및 적용
  document.documentElement.classList.remove('dark')
})
</script>

<template>
    <nav
      class="flex items-center justify-between px-10 py-5 sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-200 z-50"
    >
      <RouterLink :to="{name : 'intro'}" class="flex items-center gap-3">
        <div
          class="w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div class="font-bold text-2xl tracking-tight text-gray-900">FileInNOut</div>
      </RouterLink>

      <div class="flex items-center gap-10 text-sm font-semibold text-gray-500">
        <RouterLink :to="{ name: 'payment' }" class="hover:text-blue-600 transition"
          >요금제</RouterLink
        >
        <RouterLink :to="{ name: 'login' }" class="text-gray-700 hover:text-blue-600"
          >로그인</RouterLink
        >
        <RouterLink
          :to="{ name: 'signup' }"
          class="bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 transition shadow-md shadow-blue-100"
        >
          무료로 시작하기
        </RouterLink>
      </div>
    </nav>
</template>

<style scoped>
nav {
  background-color: var(--bg-main); /* theme.css의 변수 사용 */
  border-color: var(--border-color);
}
.font-bold {
  color: var(--text-main);
}
</style>