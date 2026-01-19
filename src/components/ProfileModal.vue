<script setup>
import { ref, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore' // 경로 확인 필요

const authStore = useAuthStore()
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'save'])

const activeTab = ref('profile')
const isSaving = ref(false)

const tabs = [
  { id: 'profile', label: '기본 프로필', icon: 'fa-solid fa-circle-user' },
  { id: 'security', label: '계정 및 보안', icon: 'fa-solid fa-shield-halved' },
  { id: 'notif', label: '알림 설정', icon: 'fa-solid fa-bell' },
  { id: 'region', label: '언어 및 지역', icon: 'fa-solid fa-globe' },
  { id: 'billing', label: '구독 및 결제', icon: 'fa-solid fa-wallet' }
]

const profile = ref({
  name: '',
  role: '사용자',
  email: ''
})

// 데이터를 가져와서 profile에 넣어주는 함수
const syncProfile = () => {
  if (authStore.user) {
    console.log('현재 스토어 유저 정보:', authStore.user); // 콘솔에서 키값을 확인해보세요!
    profile.value = {
      name: authStore.user.name || authStore.user.userName || '', // 두 경우 모두 대비
      role: authStore.user.role || '사용자',
      email: authStore.user.email || ''
    }
  }
}

// 1. 컴포넌트 마운트 시 실행
onMounted(() => {
  authStore.checkLogin()
  syncProfile()
})

// 2. 모달이 열릴 때마다 실행
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) syncProfile()
})

// 3. 스토어 유저 정보가 바뀔 때 실행
watch(() => authStore.user, () => {
  syncProfile()
}, { deep: true })


const preferences = ref({
  marketing: true,
  private: false
})

const handleOverlayClick = () => {
  emit('close')
}

const handleSave = () => {
  isSaving.value = true
  emit('save')
  setTimeout(() => {
    isSaving.value = false
  }, 1000)
}
</script>

<template>
  <div :class="['modal-overlay', { active: isOpen }]" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <!-- Modal Header -->
      <div class="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-input)]/10">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-[#4cd5ff] rounded-lg flex items-center justify-center text-white">
            <i class="fa-solid fa-user-gear text-sm"></i>
          </div>
          <h2 class="text-lg font-black tracking-tight">설정</h2>
        </div>
        <button 
          @click="emit('close')"
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <!-- Modal Sidebar -->
        <aside class="modal-sidebar w-56 border-r border-[var(--border-color)] p-4 space-y-1 shrink-0 bg-[var(--bg-input)]/5">
          <div 
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="['modal-sidebar-btn', { active: activeTab === tab.id }]"
          >
            <i :class="tab.icon"></i> {{ tab.label }}
          </div>
          
        </aside>

        <!-- Modal Content Area -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-8">
          <!-- Tab: Basic Profile -->
          <div v-if="activeTab === 'profile'" class="modal-tab-pane active max-w-2xl mx-auto space-y-10">
            <section>
  <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-6">프로필 이미지</h3>
  <div class="flex items-center gap-8">
    <div class="relative group cursor-pointer">
      <img 
        :src="`https://ui-avatars.com/api/?name=${profile.name}&background=4cd5ff&color=fff`"
        class="w-28 h-28 rounded-3xl shadow-2xl border-2 border-[var(--border-color)] transition-transform group-hover:scale-[1.02]"
      >
      <div class="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <i class="fa-solid fa-camera text-white text-xl"></i>
      </div>
    </div>
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 bg-gray-500/20 text-blue-500 text-[10px] font-black rounded uppercase">
          {{ authStore.user?.grade || 'FREE MEMBER' }}
        </span>
        <span class="text-[11px] text-[var(--text-muted)]">가입일: 2023.10.15</span>
      </div>
      <p class="text-sm text-[var(--text-muted)]">정사각형 이미지를 권장합니다. (JPG, PNG)</p>
      </div>
  </div>
</section>

            <hr class="border-[var(--border-color)]">

            <section class="space-y-6">
              <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">상세 정보</h3>
              <div class="grid grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[11px] font-bold text-[var(--text-muted)] uppercase ml-1">사용자 성함</label>
                  <input 
                    v-model="profile.name"
                    type="text"
                    class="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-3 px-4 outline-none text-sm focus:border-[var(--accent)] transition-all"
                  >
                </div>
                <div class="space-y-2">
                  <label class="text-[11px] font-bold text-[var(--text-muted)] uppercase ml-1">직함 / 역할</label>
                  <input 
                    v-model="profile.role"
                    type="text"
                    class="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-3 px-4 outline-none text-sm focus:border-[var(--accent)] transition-all"
                  >
                </div>
                <div class="space-y-2 col-span-2">
                  <label class="text-[11px] font-bold text-[var(--text-muted)] uppercase ml-1">연락처 (이메일)</label>
                  <div class="relative">
                    <input 
                      v-model="profile.email"
                      type="email"
                      class="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-3 px-4 outline-none text-sm focus:border-[var(--accent)] transition-all pr-24"
                    >
                    <button class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1.5 rounded-lg">
                      인증됨
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <hr class="border-[var(--border-color)]">

            <section class="space-y-4">
              <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">선호 설정</h3>
              <div class="space-y-4 bg-[var(--bg-input)]/20 p-5 rounded-2xl border border-[var(--border-color)]">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold">마케팅 정보 수신</p>
                    <p class="text-[11px] text-[var(--text-muted)]">새로운 기능 및 혜택 정보를 받아봅니다.</p>
                  </div>
                  <label class="switch">
                    <input v-model="preferences.marketing" type="checkbox">
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold">프로필 비공개</p>
                    <p class="text-[11px] text-[var(--text-muted)]">팀원들에게 내 접속 상태를 숨깁니다.</p>
                  </div>
                  <label class="switch">
                    <input v-model="preferences.private" type="checkbox">
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
            </section>
          </div>

          <!-- Tab: Billing -->
          <div v-if="activeTab === 'billing'" class="modal-tab-pane active max-w-2xl mx-auto space-y-10">
            <section>
              <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-6">현재 플랜 정보</h3>
              <div class="bg-gradient-to-br from-silver-500 to-blue-700 rounded-3xl p-8 text-white shadow-xl">
                <div class="flex justify-between items-start mb-6">
                  <div>
                    <p class="text-xs font-bold opacity-80 uppercase tracking-widest">Active Plan</p>
                    <h4 class="text-3xl font-black mt-1">Professional</h4>
                  </div>
                  <span class="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold">Annual Billing</span>
                </div>
                <p class="text-sm opacity-90 leading-relaxed mb-6">
                  귀하의 플랜은 2024년 10월 15일에 갱신됩니다. 연간 구독으로 20% 할인 혜택을 받고 계십니다.
                </p>
                <div class="flex gap-3">
                  <button class="bg-white text-orange-600 px-6 py-2.5 rounded-xl text-xs font-black hover:bg-orange-50 transition-colors">
                    플랜 업그레이드
                  </button>
                  <button class="bg-orange-400/30 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-orange-400/50 transition-colors">
                    구독 취소
                  </button>
                </div>
              </div>
            </section>

            <hr class="border-[var(--border-color)]">

            <section class="space-y-4">
              <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">리소스 사용량</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="p-5 bg-[var(--bg-input)]/20 border border-[var(--border-color)] rounded-2xl">
                  <div class="flex justify-between items-center mb-3">
                    <span class="text-xs font-bold">Cloud Storage</span>
                    <span class="text-xs text-[var(--accent)] font-bold">75%</span>
                  </div>
                  <div class="w-full bg-gray-700/30 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-[var(--accent)] h-full" style="width: 75%"></div>
                  </div>
                  <p class="text-[10px] text-[var(--text-muted)] mt-2">37.5 GB / 50 GB 사용 중</p>
                </div>
                <div class="p-5 bg-[var(--bg-input)]/20 border border-[var(--border-color)] rounded-2xl">
                  <div class="flex justify-between items-center mb-3">
                    <span class="text-xs font-bold">API Requests</span>
                    <span class="text-xs text-blue-400 font-bold">12%</span>
                  </div>
                  <div class="w-full bg-gray-700/30 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-blue-400 h-full" style="width: 12%"></div>
                  </div>
                  <p class="text-[10px] text-[var(--text-muted)] mt-2">1,200 / 10,000 요청</p>
                </div>
              </div>
            </section>

            <hr class="border-[var(--border-color)]">

            <section class="space-y-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest">결제 수단</h3>
                <button class="text-xs text-[var(--accent)] font-bold hover:underline">+ 카드 추가</button>
              </div>
              <div class="p-4 bg-[var(--bg-input)]/20 border border-[var(--border-color)] rounded-2xl flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-8 bg-white/5 rounded flex items-center justify-center border border-white/10">
                    <i class="fa-brands fa-cc-visa text-blue-500 text-xl"></i>
                  </div>
                  <div>
                    <p class="text-sm font-bold">Visa •••• 4242</p>
                    <p class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Expires 12/26</p>
                  </div>
                </div>
                <span class="px-2 py-1 bg-green-500/10 text-green-500 text-[9px] font-black rounded uppercase">Default</span>
              </div>
            </section>

            <hr class="border-[var(--border-color)]">

            <section class="space-y-4">
              <h3 class="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">최근 결제 내역</h3>
              <div class="overflow-hidden border border-[var(--border-color)] rounded-2xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-[var(--bg-input)]/40 text-[var(--text-muted)] font-bold">
                    <tr>
                      <th class="px-5 py-3">Date</th>
                      <th class="px-5 py-3">Description</th>
                      <th class="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--border-color)]">
                    <tr class="hover:bg-[var(--bg-input)]/10 transition-colors">
                      <td class="px-5 py-3 text-[var(--text-muted)]">Oct 15, 2023</td>
                      <td class="px-5 py-3 font-bold">Professional Plan - Annual</td>
                      <td class="px-5 py-3 text-right font-black">$288.00</td>
                    </tr>
                    <tr class="hover:bg-[var(--bg-input)]/10 transition-colors">
                      <td class="px-5 py-3 text-[var(--text-muted)]">Sep 15, 2022</td>
                      <td class="px-5 py-3 font-bold">Professional Plan - Annual</td>
                      <td class="px-5 py-3 text-right font-black">$288.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- Other Tabs Placeholder -->
          <div v-if="activeTab === 'security'" class="modal-tab-pane active max-w-2xl mx-auto py-20 text-center">
            <i class="fa-solid fa-shield-halved text-4xl text-[var(--text-muted)] mb-4"></i>
            <h4 class="text-lg font-bold">보안 설정 준비 중</h4>
            <p class="text-sm text-[var(--text-muted)]">이 기능은 다음 업데이트에 포함될 예정입니다.</p>
          </div>
          
          <div v-if="activeTab === 'notif'" class="modal-tab-pane active max-w-2xl mx-auto py-20 text-center">
            <i class="fa-solid fa-bell text-4xl text-[var(--text-muted)] mb-4"></i>
            <h4 class="text-lg font-bold">알림 설정 준비 중</h4>
            <p class="text-sm text-[var(--text-muted)]">이 기능은 다음 업데이트에 포함될 예정입니다.</p>
          </div>
          
          <div v-if="activeTab === 'region'" class="modal-tab-pane active max-w-2xl mx-auto py-20 text-center">
            <i class="fa-solid fa-globe text-4xl text-[var(--text-muted)] mb-4"></i>
            <h4 class="text-lg font-bold">언어 및 지역 준비 중</h4>
            <p class="text-sm text-[var(--text-muted)]">이 기능은 다음 업데이트에 포함될 예정입니다.</p>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="p-6 bg-[var(--bg-input)]/10 border-t border-[var(--border-color)] flex justify-end gap-3 shrink-0">
        <button 
          @click="emit('close')"
          class="px-6 py-2.5 rounded-xl text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
        >
          취소
        </button>
        <button 
          @click="handleSave"
          :disabled="isSaving"
          class="btn-orange px-10 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
        >
          {{ isSaving ? '저장 중...' : '모든 변경사항 저장' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.modal-content {
  background: var(--bg-main, white);
  width: 90vw;
  max-width: 1200px;
  height: 85vh;
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  transform: scale(0.95);
  transition: transform 0.2s ease;
}

.modal-overlay.active .modal-content {
  transform: scale(1);
}

.modal-sidebar-btn {
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.modal-sidebar-btn:hover {
  background: var(--bg-input, #f3f4f6);
  color: var(--text-main);
}

.modal-sidebar-btn.active {
  background: var(--accent, #44d3ff);
  color: white;
}
.modal-sidebar {
  --accent: #2563eb;
}
.modal-sidebar-btn i {
  width: 18px;
  text-align: center;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-color, #e5e7eb);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted, #6b7280);
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4cd5ff;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.btn-orange {
  background: linear-gradient(135deg, #4cd5ff 0%, #4cd5ff 100%);
  color: white;
  font-weight: 900;
}

.btn-orange:hover {
  transform: translateY(-1px);
}

.btn-orange:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>