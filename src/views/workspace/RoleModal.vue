<script setup>
import { ref, watch } from 'vue';
import postApi from '@/api/postApi';

const props = defineProps({
  isOpen: Boolean,
  postIdx: [Number, String],
  initialRoles: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'refresh']);

// 내부에서 수정할 수 있도록 리스트 복사
const roleList = ref([]);

watch([() => props.isOpen, () => props.initialRoles], ([newOpen, newRoles]) => {
  if (newOpen) {
    // 부모로부터 받은 리스트를 깊은 복사하여 모달 내 상태로 관리
    roleList.value = JSON.parse(JSON.stringify(newRoles || []));
  }
}, { immediate: true });

// 백엔드로 Post 보낼 저장 로직
const handleSaveRole = async () => {
  try {
    // 1. 데이터를 { "idx": "ROLE" } 형식으로 변환
    // member.idx 가 유저의 고유 번호라고 가정합니다.
    const roleData = roleList.value.reduce((acc, member) => {
      acc[member.idx] = member.role;
      return acc;
    }, {});

    console.log('서버로 보낼 변환된 데이터:', roleData);

    // 2. 실제 백엔드 API 호출
    const response = await postApi.saveRole(props.postIdx, roleData);

    console.log(response);
    
    alert('권한 설정이 저장되었습니다.');
    
    emit('refresh'); // 사이드바 또는 부모 데이터 갱신
    emit('close');
  } catch (error) {
    console.error('Save Role Error:', error);
    alert('권한 저장 중 오류가 발생했습니다.');
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center justify-center px-4">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative bg-[var(--bg-main)] border border-[var(--border-color)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
      
      <div class="p-6 pb-4">
        <h2 class="text-xl font-bold text-[var(--text-main)]">권한 설정</h2>
        <p class="text-sm text-[var(--text-muted)] mt-1">이 페이지에 참여 중인 멤버의 권한을 관리하세요.</p>
      </div>

      <div class="px-6 pb-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <ul class="space-y-3">
          <li 
            v-for="(member, index) in roleList" 
            :key="member.idx || index"
            class="flex items-center justify-between p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--border-color)]"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center overflow-hidden shrink-0">
                <img v-if="member.image || member.Image" :src="member.image || member.Image" alt="profile" class="w-full h-full object-cover"/>
                <i v-else class="fa-solid fa-user text-xs"></i>
              </div>
              <span class="text-sm font-medium text-[var(--text-main)]">{{ member.username }}</span>
            </div>

            <select 
              v-model="member.role"
              class="bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ADMIN">관리자</option>
              <option value="WRITE">편집자</option>
              <option value="READ">뷰어</option>
            </select>
          </li>
        </ul>
        
        <div v-if="roleList.length === 0" class="text-center py-6 text-sm text-[var(--text-muted)]">
          참여 중인 멤버가 없습니다.
        </div>
      </div>

      <div class="bg-[var(--bg-input)] p-4 flex justify-end gap-3 border-t border-[var(--border-color)]">
        <button 
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
        >취소</button>
        <button 
          @click="handleSaveRole"
          class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
        >
          저장
        </button>
      </div>
    </div>
  </div>
</template>
