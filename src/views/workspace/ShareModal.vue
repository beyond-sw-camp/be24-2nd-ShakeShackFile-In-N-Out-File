<script setup>
import { ref, computed, watch } from 'vue'; // watch 추가
import postApi from '@/api/postApi'; 
import loadpost from '@/components/workspace/loadpost';

const props = defineProps({
  isOpen: Boolean,
  postIdx: [Number, String],
  initialStatus: String // 부모로부터 받은 현재 상태 (예: 'Private', 'Shared')
});

const emit = defineEmits(['close', 'refresh']);

// 상태 관리: 백엔드 Enum 값과 동일하게 유지 (Private, Shared, Public)
const privacyStatus = ref(props.initialStatus); 
const email = ref('');

// 서버에서 데이터가 갱신되어 내려오면 즉시 UI에 반영되도록 합니다.
watch([() => props.isOpen, () => props.initialStatus], ([newOpen, newStatus]) => {
  if (newOpen) {
    privacyStatus.value = newStatus || 'Private';
  }
}, { immediate: true });

// 동적으로 초대 URL 생성
const inviteUrl = computed(() => {
  return `http://localhost:5173/workspace/invite/${props.postIdx}`;
});

const copyLink = () => {
  navigator.clipboard.writeText(inviteUrl.value);
  alert('링크가 클립보드에 복사되었습니다.');
};

/**
 * 1. 초대장 발송 API
 */
const handleInvite = async () => {
  if (!email.value) {
    alert('이메일 주소를 입력해주세요.');
    return;
  }

  try {
    await postApi.inviteUser({
      email: email.value,
      post_idx: props.postIdx
    });
    
    alert(`${email.value}님께 초대장을 보냈습니다.`);
    email.value = ''; 
  } catch (error) {
    console.error('Invite Error:', error);
    alert('초대장 발송에 실패했습니다.');
  }
};

/**
 * 2. 공유 상태 저장 API
 */
const handleSaveStatus = async () => {
  try {
    // privacyStatus.value는 'Private', 'Shared', 'Public' 중 하나임
    await postApi.updateShareStatus(props.postIdx, privacyStatus.value);
    
    alert('공유 설정이 저장되었습니다.');
    await loadpost.side_list(); 
    emit('close');
  } catch (error) {
    console.error('Save Status Error:', error);
    alert('설정 저장 중 오류가 발생했습니다.');
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center px-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative bg-[var(--bg-main)] border border-[var(--border-color)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      
      <div class="p-6 pb-0 flex justify-between items-start">
        <div>
          <h2 class="text-xl font-bold text-[var(--text-main)]">페이지 공유</h2>
          <p class="text-sm text-[var(--text-muted)] mt-1">공유 범위를 설정하고 팀원을 초대하세요.</p>
        </div>
        
        <div class="flex bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-color)] scale-90 origin-right">
          <button 
            v-for="status in ['Private', 'Shared', 'Public']" 
            :key="status"
            @click="privacyStatus = status"
            :class="[privacyStatus === status ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-[var(--text-muted)]']"
            class="px-2.5 py-1 text-[11px] font-bold rounded-md transition-all whitespace-nowrap"
          >
            {{ status === 'Private' ? '개인' : status === 'Shared' ? '공유' : '공개' }}
          </button>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <div>
          <label class="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2 tracking-wider">초대 링크</label>
          <div class="flex gap-2">
            <input 
              type="text" 
              readonly 
              :value="inviteUrl"
              class="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-main)] outline-none"
            />
            <button 
              @click="copyLink"
              class="bg-[var(--bg-input)] border border-[var(--border-color)] hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-main)] px-3 py-2 rounded-lg text-sm transition-colors"
              title="링크 복사"
            >
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[var(--text-muted)] uppercase mb-2 tracking-wider">사용자 초대</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <i class="fa-solid fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs"></i>
              <input 
                v-model="email"
                type="email" 
                placeholder="이메일 주소 입력"
                class="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-main)] focus:border-blue-500 outline-none transition-all"
                @keyup.enter="handleInvite"
              />
            </div>
            <button 
              @click="handleInvite"
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0"
            >
              초대장 발송
            </button>
          </div>
        </div>
      </div>

      <div class="bg-[var(--bg-input)] p-4 flex justify-end gap-3">
        <button 
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
        >취소</button>
        <button 
          @click="handleSaveStatus"
          class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
        >
          저장
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 기존 스타일 유지 */
</style>