<script setup>
import { ref, computed } from 'vue';

const currentStep = ref('main');
const mode = ref('');
const selectedMethod = ref('');

// Font Awesome 아이콘 클래스를 포함한 데이터
const authMethods = [
  { 
    id: 'email', 
    label: '이메일 인증', 
    desc: '가입하신 이메일로 링크가 발송됩니다.', 
    iconClass: 'fa-solid fa-at' // 요청하신 아이콘
  },
  { 
    id: 'phone', 
    label: '메세지 인증', 
    desc: '등록된 번호로 인증번호를 전송합니다.', 
    iconClass: 'fa-solid fa-comment-sms' 
  },
  { 
    id: 'otp', 
    label: 'OTP 이용하기', 
    desc: '2차 인증 앱의 번호를 입력해주세요.', 
    iconClass: 'fa-solid fa-shield-halved' 
  }
];

const pageTitle = computed(() => {
  if (currentStep.value === 'main') return '나만의 워크스페이스를 다시 찾으세요';
  return mode.value === 'id' ? '아이디 찾기' : '비밀번호 변경';
});

const selectedMethodLabel = computed(() => {
  return authMethods.find(m => m.id === selectedMethod.value)?.label || '';
});

const currentIcon = computed(() => {
  return authMethods.find(m => m.id === selectedMethod.value)?.iconClass || '';
});

const placeholderText = computed(() => {
  if (selectedMethod.value === 'email') return '이메일 주소를 입력하세요';
  if (selectedMethod.value === 'phone') return '010-0000-0000';
  return '6자리 숫자 입력';
});

const selectMode = (m) => { mode.value = m; currentStep.value = 'method'; };
const selectMethod = (m) => { selectedMethod.value = m; currentStep.value = 'form'; };
const goBack = () => {
  if (currentStep.value === 'form') currentStep.value = 'method';
  else if (currentStep.value === 'method') currentStep.value = 'main';
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[500px] h-[650px] bg-white rounded-2xl shadow-xl p-8 overflow-hidden font-sans">
      <button 
        v-if="currentStep !== 'main'" 
        @click="goBack"
        class="absolute top-6 left-6 text-slate-400 hover:text-indigo-600 transition-colors"
      >
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </button>

      <div class="text-center mb-10">
        <router-link
          to="/"
          class="inline-flex flex-col items-center cursor-pointer group"
        >
          <div
            class="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-6
                  group-hover:bg-indigo-700 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>

          <h1
            class="text-3xl font-extrabold text-gray-900 tracking-tight group-hover:text-indigo-700 transition"
          >
            FileInNOut
          </h1>
        </router-link>
        <p class="text-slate-400 text-sm mt-1 font-medium">{{ pageTitle }}</p>
      </div>

      <div v-if="currentStep === 'main'" class="space-y-4">
        <button @click="selectMode('id')" class="w-full py-4 px-6 border-2 border-slate-100 rounded-xl font-semibold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all flex justify-between items-center group">
          아이디 찾기
          <i class="fa-solid fa-arrow-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </button>
        <button @click="selectMode('pw')" class="w-full py-4 px-6 border-2 border-slate-100 rounded-xl font-semibold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all flex justify-between items-center group">
          비밀번호 변경하기
          <i class="fa-solid fa-arrow-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
        </button>
      </div>

      <div v-else-if="currentStep === 'method'" class="space-y-3">
        <button 
          v-for="method in authMethods" 
          :key="method.id" 
          @click="selectMethod(method.id)" 
          class="w-full p-4 bg-slate-50 rounded-xl border border-transparent hover:border-indigo-200 hover:bg-white transition-all flex items-center gap-4 group"
        >
          <div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
             <i :class="method.iconClass" class="text-lg"></i>
          </div>
          <div class="text-left">
            <p class="font-bold text-slate-700 text-sm">{{ method.label }}</p>
            <p class="text-xs text-slate-400">{{ method.desc }}</p>
          </div>
        </button>
      </div>

      <div v-else-if="currentStep === 'form'" class="space-y-5">
        <div class="space-y-1">
          <label class="text-[11px] font-bold text-slate-400 ml-1 uppercase tracking-wider">
            {{ selectedMethodLabel }} 정보
          </label>
          <div class="relative">
            <i :class="currentIcon" class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input 
              type="text" 
              :placeholder="placeholderText"
              class="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            >
          </div>
        </div>
        <button class="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-600 transition-all active:scale-[0.98]">
          인증 요청하기
        </button>
      </div>

      <div class="absolute bottom-0 left-0 w-full p-8 bg-white border-t border-slate-50 space-y-3 text-center text-sm">
      <div class="mt-4 text-center text-sm">
        <p class="text-slate-400 font-medium">
          문제가 발생했나요? <a href="https://item.kakaocdn.net/do/38901199f7579d841006238c15aa66dd8f324a0b9c48f77dbce3a43bd11ce785" class="text-indigo-600 font-bold ml-1 hover:underline">고객센터 문의</a>
        </p>
      </div>
      <div class="mt-4 text-center text-sm">
        <p class="text-slate-400">이미 계정이 있으신가요? 
            <router-link :to="{ name: 'login' }">
                <a class="text-indigo-600 font-semibold ml-1 hover:underline">로그인</a>
            </router-link></p>
      </div>
      <div class="mt-4 text-center text-sm">
        <div class="text-slate-400">계정이 없으신가요?
            <router-link :to="{ name: 'signup' }">
                <a class="text-indigo-600 font-semibold ml-1 hover:underline">회원가입</a>
            </router-link></div>
      </div>
      </div>
    </div>
  </div>
</template>

<style>

</style>