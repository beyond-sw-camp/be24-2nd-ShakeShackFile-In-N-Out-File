<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import ProfileModal from './ProfileModal.vue'


const emit = defineEmits(['toggle-chat', 'toggle-theme', 'switch-view'])
const router = useRouter()
const authStore = useAuthStore()
// authStore.user 안의 name(또는 userName)을 실시간으로 가져옵니다.
// 서버 응답 필드명이 'name'인지 'userName'인지 확인하여 맞춰주세요.
const userName = computed(() => {
  return authStore.user?.userName || authStore.user?.name || '사용자'
})
const userEmail = computed(() => {
  // 서버 응답 필드명에 따라 user.email 또는 user.userEmail 등을 확인하세요
  return authStore.user?.email || authStore.user?.userEmail || '이메일 정보 없음'
})
onMounted(() => {
  initTheme()
  authStore.checkLogin() // 저장된 정보가 있다면 불러오기
  document.addEventListener('click', handleClickOutside)
})

// 드롭다운 상태
const showNotifDropdown = ref(false)  
const showProfileDropdown = ref(false)

// 모달 상태
const isProfileModalOpen = ref(false)

// 테마 상태
const isDarkMode = ref(false)
const themeIcon = ref('fa-solid fa-moon')

// 채팅 토글
const handleToggleChat = () => {
  console.log('채팅 버튼 클릭됨')
  emit('toggle-chat')
}

// 테마 초기화 및 적용
const initTheme = () => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDarkMode.value = true
    themeIcon.value = 'fa-solid fa-sun'
    document.documentElement.classList.add('dark')
  } else {
    isDarkMode.value = false
    themeIcon.value = 'fa-solid fa-moon'
    document.documentElement.classList.remove('dark')
  }
}

// 알림 메뉴 토글
const toggleNotifMenu = () => {
  showNotifDropdown.value = !showNotifDropdown.value
  showProfileDropdown.value = false
}

// 프로필 메뉴 토글
const toggleProfileMenu = () => {
  showProfileDropdown.value = !showProfileDropdown.value
  showNotifDropdown.value = false
}

// 테마 토글
const handleToggleTheme = () => {
  isDarkMode.value = !isDarkMode.value

  if (isDarkMode.value) {
    themeIcon.value = 'fa-solid fa-sun'
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    themeIcon.value = 'fa-solid fa-moon'
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }

  emit('toggle-theme', isDarkMode.value)
}

// 프로필 모달 열기
const handleOpenProfileModal = () => {
  showProfileDropdown.value = false
  isProfileModalOpen.value = true
}

// 프로필 모달 닫기
const handleCloseProfileModal = () => {
  isProfileModalOpen.value = false
}

// 프로필 저장
const handleSaveProfile = () => {
  console.log('프로필 저장됨')
  // 여기에 실제 저장 로직 추가
  setTimeout(() => {
    isProfileModalOpen.value = false
  }, 1000)
}

// 로그아웃
const handleLogout = () => {
  if (confirm("로그아웃 하시겠습니까?")) {
    authStore.logout() // 스토어에서 만든 logout 함수 호출 (이전 가이드 참고)
    router.push('/login') // 로그인 페이지로 이동
  }
}

// 외부 클릭 감지
const handleClickOutside = (event) => {
  if (!event.target.closest('#profile-container') && !event.target.closest('#notif-container')) {
    showNotifDropdown.value = false
    showProfileDropdown.value = false
  }
}


onMounted(() => {
  // 테마 초기화
  initTheme()

  if (authStore.data && authStore.data.userName) {
    userName.value = authStore.data.userName
  }
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div>
    <!-- Profile Modal -->
    <ProfileModal :isOpen="isProfileModalOpen" @close="handleCloseProfileModal" @save="handleSaveProfile" />

    <header class="header-container">
      <div class="flex-1 max-w-2xl relative group">
        <input type="text" placeholder="파일, 폴더, 사람 검색" class="search-input" />
        <span class="absolute left-4 top-2.5 opacity-40">
          <i class="fa-solid fa-search"></i>
        </span>
      </div>

      <div class="flex items-center gap-5 ml-6">
        <!-- 알림 버튼 -->
        <div class="relative" id="notif-container">
          <button @click="toggleNotifMenu" class="icon-button">
            <i class="fa-solid fa-bell"></i>
          </button>

          <div v-if="showNotifDropdown" class="dropdown-container active">
            <div class="dropdown-header">
              <p class="text-sm font-bold">알림</p>
            </div>
            <div class="py-2">
              <div class="dropdown-item">
                <span class="text-sm text-gray-500 dark:text-gray-400">새로운 알림이 없습니다</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 테마 토글 버튼 -->
        <button @click="handleToggleTheme" class="icon-button theme-button"
          :title="isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'">
          <i :class="themeIcon"></i>
        </button>

        <!-- 채팅 버튼 -->
        <button @click="handleToggleChat" class="icon-button chat-button" title="협업채팅">
          <i class="fa-solid fa-comments"></i>
        </button>

        <!-- 프로필 드롭다운 -->
        <div class="relative" id="profile-container">
          <div @click="toggleProfileMenu" class="flex items-center gap-3 cursor-pointer group">
            <div class="text-right hidden md:block">
              <p class="text-sm font-bold text-[var(--text-main)]">{{ userName }}</p>
              <p class="text-[10px] text-[#190094] dark:text-[#44dff4] font-bold">비싼 요금제 오너</p>
            </div>
            <img 
      :src="`https://ui-avatars.com/api/?name=${userName}&background=190094&color=fff&bold=true`" 
      class="profile-avatar"
      :alt="userName"
    >
          </div>

          <div v-if="showProfileDropdown" class="dropdown-container active">
            <div class="dropdown-header">
              <p class="text-xs text-[var(--text-muted)] font-bold">로그인 계정</p>
              <p class="text-sm font-black mt-1">{{userEmail}}</p>
            </div>
            <div class="py-2">
              <div @click="handleOpenProfileModal" class="dropdown-item">
                <i class="fa-solid fa-user-gear text-[var(--text-muted)]"></i>
                <span>개인 프로필 설정</span>
              </div>
              <div class="dropdown-item">
                <i class="fa-solid fa-shield-halved text-[var(--text-muted)]"></i>
                <span>보안 및 비밀번호</span>
              </div>
              <div class="dropdown-item">
                <i class="fa-solid fa-language text-[var(--text-muted)]"></i>
                <span>언어 설정 (KO)</span>
              </div>
            </div>
            <div class="dropdown-footer">
              <div @click="handleLogout" class="dropdown-item text-red-500 font-bold">
                <i class="fa-solid fa-right-from-bracket"></i>
                <span>로그아웃</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  </div>
</template>

<style scoped>
/* 헤더 컨테이너 */
.header-container {
  height: 4rem;
  background-color: var(--bg-main);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

/* 검색 입력 */
.search-input {
  width: 100%;
  background-color: var(--bg-input);
  border: none;
  border-radius: 1rem;
  padding: 0.625rem 1rem 0.625rem 3rem;
  outline: none;
  font-size: 0.875rem;
  color: var(--text-main);
  transition: all 0.2s ease;
}

.search-input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  background-color: var(--bg-main);
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* 아이콘 버튼 */
.icon-button {
  color: var(--text-muted);
  transition: color 0.2s ease, transform 0.2s ease;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  position: relative;
}

.icon-button:hover {
  color: var(--text-main);
  background-color: var(--bg-input);
  transform: rotate(180deg);
}

.theme-button:hover {
  color: var(--accent);
  transform: rotate(180deg);
}

.chat-button:hover {
  color: #6366f1;
  transform: rotate(180deg);
}

/* 프로필 아바타 */
.profile-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.group:hover .profile-avatar {
  border-color: #44dff4;
}

/* 드롭다운 컨테이너 */
.dropdown-container {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  min-width: 250px;
  z-index: 50;
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: none;
  transition: all 0.2s ease;
}

.dropdown-container.active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* 드롭다운 헤더 */
.dropdown-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background-color: rgba(243, 244, 246, 0.1);
}

.dark .dropdown-header {
  background-color: rgba(55, 65, 81, 0.1);
}

/* 드롭다운 아이템 */
.dropdown-item {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  color: var(--text-main);
}

.dropdown-item:hover {
  background: var(--bg-input);
}

.dropdown-item i {
  width: 18px;
  text-align: center;
}

/* 드롭다운 푸터 */
.dropdown-footer {
  padding: 0.5rem 0;
  border-top: 1px solid var(--border-color);
  background-color: rgba(243, 244, 246, 0.2);
}

.dark .dropdown-footer {
  background-color: rgba(55, 65, 81, 0.2);
}

/* 다크모드 전환 애니메이션 */
.dark .header-container {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

/* 테마 버튼 특별 효과 */
@keyframes rotate-sun {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.theme-button:active i {
  animation: rotate-sun 0.5s ease;
}
</style>