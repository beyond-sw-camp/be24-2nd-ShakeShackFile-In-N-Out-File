<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router';
import FileUpload from '@/components/function/FilesUpload.vue';
import loadpost from '@/components/workspace/loadpost';
import { useFileStore } from '@/stores/useFileStore';
import { useAuthStore } from '@/stores/useAuthStore';
import postApi from '@/api/postApi';
import ShareModal from '@/views/workspace/ShareModal.vue'; // {추가} 모달 컴포넌트 임포트

const authStore = useAuthStore()
const fileStore = useFileStore()
const isSidebarOpen = ref(true) // 사이드바 토글 상태
const openMenuId = ref(null) // 현재 열려있는 메뉴의 ID 관리

// {추가} 공유 모달 관련 상태
const isShareModalOpen = ref(false);
const targetPostIdx = ref(null);

// 1. loadpost에서 정의된 상태와 함수를 가져옵니다.
const { 
  personalItems, 
  sharedItems, 
  isPersonalOpen, 
  isSharedOpen, 
  side_list 
} = loadpost;

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// 메뉴 토글 함수 (이벤트 전파 방지 포함)
const toggleMenu = (event, idx) => {
  event.stopPropagation();
  openMenuId.value = openMenuId.value === idx ? null : idx;
}

// 외부 클릭 시 메뉴 닫기
const closeMenu = () => {
  openMenuId.value = null;
}

onMounted(() => {
  side_list();
  fileStore.fetchStorageSummary().catch(() => {})

  //
  window.addEventListener('click', closeMenu);
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenu);
})
 
// 사이드바 토글 함수
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const formatBytes = (bytes) => {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  )
  const value = size / 1024 ** unitIndex
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`
}

const storageSummary = computed(() => fileStore.storageSummary)

const storageUsageWidth = computed(() => {
  return `${Math.min(100, Math.max(0, Number(storageSummary.value?.usagePercent || 0)))}%`
})

const storageUsageText = computed(() => {
  if (!storageSummary.value) {
    return '저장 공간 통계 불러오는 중'
  }

  return `${formatBytes(storageSummary.value.usedBytes)} / ${formatBytes(storageSummary.value.quotaBytes)} 사용`
})

const isAdministrator = computed(() => {
  return (
    authStore.user?.email === 'administrator@administrator.adm' &&
    authStore.user?.role === 'ROLE_ADMIN'
  )
})

const sidebarToggleStyle = computed(() => ({
  left: isSidebarOpen.value ? 'calc(16rem - 0.75rem)' : '0.75rem',
}))
const router = useRouter();
const goToPost = (idx) => {
  if (!idx) return;
  router.push(`/workspace/read/${idx}`);
};
// 1. 선택된 게시글의 상태를 저장할 ref 추가
const targetPostStatus = ref('Private');

// 메뉴 액션 함수들
const handleAction = async (action, idx) => {
  if (action === 'delete') {
    if (confirm('정말로 이 페이지를 삭제하시겠습니까?')) {
      // 1. 실제 삭제 API 호출 로직이 이곳에 위치해야 합니다.
      console.log(idx);
      await postApi.deletePost(idx); 
      
      // 2. 삭제 후 side_list()를 호출하여 사이드바 목록을 서버 데이터와 동기화합니다.
      await side_list(); 
      
      // 만약 현재 삭제한 페이지를 보고 있었다면 홈으로 이동시키는 로직을 추가할 수도 있습니다.
      router.push({ name: 'home' });
    }
  }else if (action === 'share') {
    // [수정] 현재 클릭한 아이템의 status를 찾아서 저장합니다.
    const allItems = [...personalItems.value, ...sharedItems.value];
    const selectedItem = allItems.find(item => item.post_idx === idx);

    targetPostIdx.value = idx;
    // 서버 데이터의 status('Private', 'Public' 등)를 모달에 넘겨줄 변수에 할당
    targetPostStatus.value = selectedItem ? selectedItem.status : 'Private';
    isShareModalOpen.value = true;
  } else {
    console.log(`${action} action on post: ${idx}`);
  }
  openMenuId.value = null;
}
</script>

<template>
  <div class="relative">
    <ShareModal 
      :is-open="isShareModalOpen" 
      :post-idx="targetPostIdx"
      :initial-status="targetPostStatus" 
      @close="isShareModalOpen = false"
    />
    <aside 
      class="bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col transition-all duration-300 h-full sticky top-0"
      :class="[
        isSidebarOpen ? 'w-64 overflow-visible' : 'w-0 border-r-0 overflow-hidden'
      ]"
    >
      <div :class="isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'" class="transition-opacity duration-300 h-full flex flex-col">
        <RouterLink 
          :to="{ name: 'home' }" 
          class="py-6 px-6 pb-4 flex items-center gap-3 no-underline cursor-pointer transition-opacity duration-200 hover:opacity-80 flex-shrink-0"
          @click="scrollToTop"
        >
          <div class="w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span class="font-bold text-lg text-[var(--text-main)] tracking-tight no-underline">FileInNOut</span>
        </RouterLink>

        <div class="px-6 mb-4 overflow-visible relative z-[100]">
          <FileUpload />
        </div>

        <nav class="flex-1 px-3 overflow-y-auto custom-scrollbar">
          <div class="mb-6">
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

          <div class="border-t border-[var(--border-color)] my-4 mx-2"></div>

          <div>
            <div>
              <div
                @click="isPersonalOpen = !isPersonalOpen"
                class="flex items-center justify-between px-4 py-2 cursor-pointer rounded-lg transition-colors duration-200 hover:bg-[var(--bg-input)] group"
              >
                <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  개인 페이지
                </h3>
                <div class="flex items-center gap-2">
                  <RouterLink :to="{ name: 'workspace' }" @click.stop>
                    <button 
                      class="p-1 rounded hover:bg-gray-200 text-[var(--text-muted)] hover:text-blue-500 transition-colors"
                    >
                      <i class="fa-solid fa-plus text-[10px]"></i>
                    </button>
                  </RouterLink>
                  <span
                    class="text-xs text-[var(--text-muted)] transition-transform duration-200"
                    :class="{ 'rotate-180': !isPersonalOpen }"
                  >▼</span>
                </div>
              </div>

              <div v-show="isPersonalOpen" class="mt-1 space-y-1 px-2">
                <template v-if="personalItems.length > 0">
                  <div
                    v-for="item in personalItems"
                    :key="item.post_idx"
                    @click="goToPost(item.post_idx)"
                    class="group relative px-3 py-2 text-sm text-[var(--text-secondary)] rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)]"
                  >
                    <div class="flex items-center gap-3 overflow-hidden">
                      <i class="fa-solid fa-file-lines w-4 text-center opacity-70 flex-shrink-0"></i>
                      <span class="truncate">{{ item.title }}</span>
                    </div>
                    
                    <button 
                      @click="toggleMenu($event, item.post_idx)"
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all"
                    >
                      <i class="fa-solid fa-ellipsis text-xs"></i>
                    </button>

                    <div 
                      v-if="openMenuId === item.post_idx"
                      class="absolute right-2 top-10 w-32 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg shadow-xl z-[110] py-1 overflow-hidden"
                    >
                      <button @click.stop="handleAction('share', item.post_idx)" class="w-full text-left px-4 py-2 text-xs hover:bg-[var(--bg-input)] transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-share-nodes w-3"></i> 공유
                      </button>
                      <button @click.stop="handleAction('settings', item.post_idx)" class="w-full text-left px-4 py-2 text-xs hover:bg-[var(--bg-input)] transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-lock w-3"></i> 권한 설정
                      </button>
                      <div class="border-t border-[var(--border-color)] my-1"></div>
                      <button @click.stop="handleAction('delete', item.post_idx)" class="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-trash w-3"></i> 삭제
                      </button>
                    </div>
                  </div>
                </template>
                
                <div v-else class="px-3 py-4 text-xs text-[var(--text-muted)] italic text-center border border-dashed border-gray-200 rounded-lg mx-2">
                  생성된 페이지가 없습니다.
                </div>
              </div>
            </div>

            <div>
              <div
                @click="isSharedOpen = !isSharedOpen"
                class="flex items-center justify-between px-4 py-2 cursor-pointer rounded-lg transition-colors duration-200 hover:bg-[var(--bg-input)]"
              >
                <h3 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">협업 페이지</h3>
                <span
                  class="text-xs text-[var(--text-muted)] transition-transform duration-200"
                  :class="{ 'rotate-180': !isSharedOpen }"
                >▼</span>
              </div>

              <div v-show="isSharedOpen" class="mt-1 space-y-1 px-2">
                <template v-if="sharedItems.length > 0">
                  <div
                    v-for="team in sharedItems"
                    :key="team.post_idx"
                    @click="goToPost(team.post_idx)"
                    class="group relative px-3 py-2 text-sm text-[var(--text-secondary)] rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)]"
                  >
                    <div class="flex items-center gap-3 overflow-hidden">
                      <i class="fa-solid fa-file-lines w-4 text-center opacity-70 flex-shrink-0"></i>
                      <span class="truncate">{{ team.title }}</span>
                    </div>

                    <button 
                      @click="toggleMenu($event, team.post_idx)"
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all"
                    >
                      <i class="fa-solid fa-ellipsis text-xs"></i>
                    </button>

                    <div 
                      v-if="openMenuId === team.post_idx"
                      class="absolute right-2 top-10 w-32 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg shadow-xl z-[110] py-1 overflow-hidden"
                    >
                      <button @click.stop="handleAction('share', team.post_idx)" class="w-full text-left px-4 py-2 text-xs hover:bg-[var(--bg-input)] transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-share-nodes w-3"></i> 공유
                      </button>
                      <button @click.stop="handleAction('settings', team.post_idx)" class="w-full text-left px-4 py-2 text-xs hover:bg-[var(--bg-input)] transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-lock w-3"></i> 권한 설정
                      </button>
                      <div class="border-t border-[var(--border-color)] my-1"></div>
                      <button @click.stop="handleAction('delete', team.post_idx)" class="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-trash w-3"></i> 삭제
                      </button>
                    </div>
                  </div>
                </template>
                <div v-else class="px-3 py-4 text-xs text-[var(--text-muted)] italic text-center border border-dashed border-gray-200 rounded-lg mx-2">
                  생성된 페이지가 없습니다.
                </div>
              </div>
            </div>
            
            <div class="border-t border-[var(--border-color)] my-4 mx-2"></div>
            
            <RouterLink
              :to="{ name: 'trash' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
            >
              <i class="fa-solid fa-trash w-5 text-center flex-shrink-0 text-lg"></i>
              <span>휴지통</span>
            </RouterLink>

            <RouterLink
              v-if="isAdministrator"
              :to="{ name: 'administrator' }"
              class="w-full flex items-center gap-3.5 px-3 py-2.5 text-sm text-[var(--text-secondary)] rounded-xl transition-all duration-200 hover:bg-[var(--bg-input)] hover:text-[var(--text-main)] no-underline"
              active-class="!bg-blue-500/10 !text-blue-600 !font-bold dark:!bg-blue-400/20 dark:!text-blue-400"
            >
              <i class="fa-solid fa-user-shield w-5 text-center flex-shrink-0 text-lg"></i>
              <span>관리자 페이지</span>
            </RouterLink>

            <div class="p-3 pt-2">
              <RouterLink 
                :to="{ name: 'storage' }" 
                class="flex items-center gap-3.5 text-[var(--text-secondary)] mb-3 transition-all duration-200 hover:text-[var(--text-main)] no-underline"
              >
                <i class="fa-solid fa-cloud w-5 text-center flex-shrink-0 text-lg"></i>
                <span class="text-sm">저장용량</span>
              </RouterLink>

              <div class="w-full bg-[var(--bg-input)] rounded-full h-1.5 mb-2 overflow-hidden">
                <div
                  class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                  :style="{ width: storageUsageWidth }"
                ></div>
              </div>

              <p class="text-xs text-[var(--text-muted)] mb-1">{{ storageUsageText }}</p>
              <p v-if="storageSummary" class="text-[11px] text-[var(--text-muted)] mb-4">
                {{ storageSummary.planLabel }} 플랜 · 휴지통 포함 {{ storageSummary.usagePercent }}%
              </p>
              <p v-else class="text-[11px] text-[var(--text-muted)] mb-4">
                저장 공간 통계 확인 중
              </p>

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

    <button
      @click="toggleSidebar"
      class="sidebar-toggle absolute top-4 z-50 flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-lg transition-all duration-300 hover:bg-[var(--bg-input)]"
      :style="sidebarToggleStyle"
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
.overflow-visible {
  overflow: visible !important; 
}

.sidebar-toggle {
  transform: translateX(-50%);
}

@media (max-width: 1024px) {
  .sidebar-toggle {
    top: 0.75rem;
  }
}
</style>
