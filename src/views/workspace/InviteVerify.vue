<template>
  <div class="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans text-[#1e293b]">
    <div class="max-w-md w-full bg-white rounded-[2rem] shadow-2xl shadow-blue-500/5 p-12 text-center border border-slate-100">
      
      <div v-if="status === 'loading'" class="space-y-6">
        <div class="relative w-20 h-20 mx-auto">
          <div class="absolute inset-0 border-4 border-blue-50 rounded-full"></div>
          <div class="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div>
          <h2 class="text-2xl font-black tracking-tight mb-2">초대 확인 중</h2>
          <p class="text-slate-400 text-sm">워크스페이스 초대를 확인하고 있습니다...</p>
        </div>
      </div>

      <div v-else-if="status === 'success'" class="animate-in fade-in zoom-in duration-300">
        <div :class="['w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3', isAccept ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500']">
          <i :class="['fa-solid text-3xl', isAccept ? 'fa-circle-check' : 'fa-circle-info']"></i>
        </div>
        <h2 class="text-2xl font-black mb-3">{{ isAccept ? '반가워요!' : '처리가 완료되었습니다' }}</h2>
        <p class="text-slate-500 mb-10 leading-relaxed">{{ message }}</p>
        
        <button v-if="isAccept" @click="goDashboard" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-200 active:scale-95">
          워크스페이스 입장하기
        </button>
        <button v-else @click="goHome" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all active:scale-95">
          홈으로 돌아가기
        </button>
      </div>

      <div v-else class="animate-in slide-in-from-bottom-4 duration-300">
        <div class="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 -rotate-3">
          <i class="fa-solid fa-triangle-exclamation text-3xl"></i>
        </div>
        <h2 class="text-2xl font-black mb-3">초대를 처리할 수 없어요</h2>
        <p class="text-slate-500 mb-10 leading-relaxed">{{ errorMessage }}</p>
        <button @click="goHome" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl transition-all active:scale-95">
          홈으로 돌아가기
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import postApi from '@/api/postApi';

const route = useRoute();
const router = useRouter();

const status = ref('loading');
const message = ref('');
const errorMessage = ref('');
const requestType = ref(''); 

const isAccept = computed(() => requestType.value === 'accept');

onMounted(async () => {
  const uuid = route.query.uuid;
  const type = route.query.type; 
  requestType.value = type;
  
  const accessToken = localStorage.getItem('ACCESS_TOKEN');

  if (!accessToken) {
    status.value = 'error';
    errorMessage.value = '로그인이 필요한 서비스입니다. 로그인 후 이메일의 링크를 다시 클릭해주세요.';
    return;
  }

  if (!uuid || !type) {
    status.value = 'error';
    errorMessage.value = '유효하지 않은 초대 링크입니다.';
    return;
  }

  try {
    const result = await postApi.verifyEmail(uuid, type);

    // ✅ 성공 조건 강화: code가 200이거나 status가 SUCCESS(대소문자 무관)인 경우
    const isSuccess = result.code === 200 || 
                      (result.status && result.status.toUpperCase() === 'SUCCESS');

    if (isSuccess) {
      status.value = 'success';
      message.value = result.message || '워크스페이스 멤버 인증이 완료되었습니다!';
    } else {
      // 성공 응답이 아닐 경우 에러로 던짐
      throw new Error(result.message || '인증 처리에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
    
    const serverMessage = error.response?.data?.message || error.message;
    
    // 백엔드에서 "거절하였습니다" 또는 "성공"이라는 메시지가 포함된 에러가 왔을 때의 처리
    if (serverMessage && (serverMessage.includes('거절') || serverMessage.includes('성공'))) {
      status.value = 'success';
      message.value = serverMessage;
    } else {
      status.value = 'error';
      errorMessage.value = serverMessage || '이미 만료되었거나 올바르지 않은 초대장입니다.';
    }
  }
});

const goDashboard = () => router.push('/main/home'); 
const goHome = () => router.push('/');
</script>

<style scoped>
.animate-in { animation-fill-mode: forwards; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }
</style>