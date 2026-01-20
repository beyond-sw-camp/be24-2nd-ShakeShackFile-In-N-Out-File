<script setup>
import { onMounted, computed, ref, onBeforeUnmount } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouter } from 'vue-router';
const authStore = useAuthStore();
const router = useRouter();

// 로그인 여부 및 사용자 정보
const isLoggedIn = computed(() => !!authStore.user);
const userName = computed(() => authStore.user?.userName || authStore.user?.name || '사용자');

// 드롭다운 상태 관리
const showProfileDropdown = ref(false);

const toggleProfileMenu = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
};

const handleLogout = () => {
  if (confirm("로그아웃 하시겠습니까?")) {
    authStore.logout();
    router.push('/login');
  }
};

// 외부 클릭 시 드롭다운 닫기
const handleClickOutside = (event) => {
  if (!event.target.closest('#profile-container')) {
    showProfileDropdown.value = false;
  }
};

onMounted(() => {
  document.documentElement.classList.remove('dark');
  document.addEventListener('click', handleClickOutside);
  if (!authStore.user) {
    authStore.checkLogin();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <nav class="flex items-center justify-between px-10 py-5 sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-200 z-50">
    <RouterLink :to="{ name: 'intro' }" class="flex items-center gap-3">
      <div class="w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <div class="font-bold text-2xl tracking-tight text-gray-900">FileInNOut</div>
    </RouterLink>

    <div class="flex items-center gap-8 text-sm font-semibold">
      
      
      <template v-if="!isLoggedIn">
        <RouterLink :to="{ name: 'payment' }" class="text-gray-500 hover:text-blue-600 transition">요금제</RouterLink>
        <RouterLink :to="{ name: 'login' }" class="text-gray-700 hover:text-blue-600">로그인</RouterLink>
        <RouterLink
          :to="{ name: 'signup' }"
          class="bg-blue-600 text-white px-6 py-2.5 rounded-full hover:bg-blue-700 transition shadow-md shadow-blue-100"
        >
          무료로 시작하기
        </RouterLink>
      </template>

      <div v-else class="relative" id="profile-container">
        <div @click="toggleProfileMenu" class="flex items-center gap-3 cursor-pointer group">
          <div class="text-right hidden md:block">
            <p class="text-sm font-bold text-gray-900">{{ userName }}님</p>
            <p class="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">My Account</p>
          </div>
          <img 
            :src="`https://ui-avatars.com/api/?name=${userName}&background=2563eb&color=fff&bold=true`" 
            class="w-10 h-10 rounded-xl border-2 border-transparent group-hover:border-blue-400 transition-all"
            :alt="userName"
          >
        </div>

        <div v-if="showProfileDropdown" class="absolute top-full right-0 mt-3 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50">
          <div class="px-4 py-3 border-b border-gray-50">
            <p class="text-[11px] text-gray-400 font-bold uppercase">사용자 계정</p>
            <p class="text-sm font-bold text-gray-800 truncate">{{ authStore.user?.email }}</p>
          </div>
          <div class="py-1">
            <RouterLink :to="{ name: 'main' }" class="flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 transition">
              <i class="fa-solid fa-gauge-high text-xs"></i>
              <span class="text-xs font-bold">대시보드 가기</span>
            </RouterLink>
          </div>
          <div class="border-t border-gray-50 pt-1">
            <button @click="handleLogout" class="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 transition">
              <i class="fa-solid fa-right-from-bracket text-xs"></i>
              <span class="text-xs font-black">로그아웃</span>
            </button>
          </div>
        </div>
      </div>
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