<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/user'
import { useAuthStore } from '@/stores/useAuthStore'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const loginErrorMessage = ref('')

const loginForm = reactive({
  email: '',
  password: '',
})

const loginInputError = reactive({
  email: { errorMessage: null, isValid: false, touched: false },
  password: { errorMessage: null, isValid: false, touched: false }
})

// 1. 순수 유효성 검사 로직 (재사용성 및 실시간 체크)
const checkEmailValidity = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return email !== '' && emailRegex.test(email)
}

const checkPasswordValidity = (password) => {
  return password.length > 0
}

// 2. 버튼 활성화를 위한 Computed (입력값 실시간 반영)
const isFormValid = computed(() => {
  return checkEmailValidity(loginForm.email) && checkPasswordValidity(loginForm.password)
})

// 3. 입력 중 실시간 상태 업데이트 (watch 활용)
watch(() => loginForm.email, (newVal) => {
  loginInputError.email.isValid = checkEmailValidity(newVal)
  if (loginInputError.email.touched) validateEmail()
})

watch(() => loginForm.password, (newVal) => {
  loginInputError.password.isValid = checkPasswordValidity(newVal)
  if (loginInputError.password.touched) validatePassword()
})

// 4. Blur 시점에 실행될 상세 유효성 검사
const validateEmail = () => {
  loginInputError.email.touched = true
  if (loginForm.email === '') {
    loginInputError.email.errorMessage = "이메일을 입력해 주세요."
  } else if (!checkEmailValidity(loginForm.email)) {
    loginInputError.email.errorMessage = "올바른 이메일 형식이 아닙니다."
  } else {
    loginInputError.email.errorMessage = null
  }
}

const validatePassword = () => {
  loginInputError.password.touched = true
  if (!checkPasswordValidity(loginForm.password)) {
    loginInputError.password.errorMessage = "비밀번호를 입력해 주세요."
  } else {
    loginInputError.password.errorMessage = null
  }
}

const handleLogin = async () => {
  if (!isFormValid.value) return

  isLoading.value = true
  loginErrorMessage.value = ''

  try {
    const res = await api.login(loginForm)
    if (res.status === 200) {
      authStore.login(JSON.stringify(res.data))
      router.push({ name: 'main' })
    }
  } catch (error) {
    loginErrorMessage.value = '아이디 또는 비밀번호가 일치하지 않습니다.'
  } finally {
    isLoading.value = false
  }
}

// UI Helper: Input 클래스 맵핑
const getInputClass = (field) => {
  const state = loginInputError[field]
  if (!state.touched) return 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20'
  return state.isValid
    ? 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20'
    : 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
}
</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
    <!-- 배경 디자인 -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60"></div>

    <div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 w-full max-w-[480px] p-8 md:p-12 z-10">
      <!-- 헤더 -->
      <div class="text-center mb-10">
        <router-link to="/" class="inline-flex flex-col items-center cursor-pointer group">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-6 group-hover:bg-indigo-700 transition">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight group-hover:text-indigo-700 transition">FileInNOut</h1>
        </router-link>
        <p class="text-gray-500 mt-2 font-medium">FileInNOut에 로그인하세요</p>
      </div>

      <!-- 소셜 로그인 -->
      <button class="w-full bg-white border-2 border-gray-100 rounded-xl py-3.5 flex items-center justify-center gap-3 hover:bg-gray-50 transition-all active:scale-[0.98] mb-8 font-bold text-gray-700 text-sm shadow-sm">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
        </svg>
        Google 계정으로 계속하기
      </button>

      <!-- 폼 섹션 -->
      <form @submit.prevent="handleLogin" class="space-y-5" novalidate>
        <!-- 이메일 -->
        <div class="space-y-1.5">
          <label class="flex items-center text-sm font-bold text-gray-700 ml-1">
            <span>이메일</span>
            <span v-if="loginInputError.email.errorMessage" class="ml-auto text-rose-500 text-[11px] font-bold animate-slide-down">
              {{ loginInputError.email.errorMessage }}
            </span>
          </label>
          <input v-model="loginForm.email" @blur="validateEmail" type="email" placeholder="workspace@example.com"
            :class="['w-full bg-gray-50 border-2 rounded-xl px-4 py-3.5 text-sm transition-all outline-none focus:ring-4', getInputClass('email')]" />
        </div>

        <!-- 비밀번호 -->
        <div class="space-y-1.5">
          <label class="flex items-center text-sm font-bold text-gray-700 ml-1">
            <span>비밀번호</span>
            <span v-if="loginInputError.password.errorMessage" class="ml-auto text-rose-500 text-[11px] font-bold animate-slide-down">
              {{ loginInputError.password.errorMessage }}
            </span>
          </label>
          <input v-model="loginForm.password" @blur="validatePassword" type="password" placeholder="••••••••"
            :class="['w-full bg-gray-50 border-2 rounded-xl px-4 py-3.5 text-sm transition-all outline-none focus:ring-4', getInputClass('password')]" />
        </div>

        <!-- 로그인 실패 메시지 -->
        <div v-if="loginErrorMessage" class="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 animate-fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <p class="text-rose-600 text-xs font-bold leading-tight">{{ loginErrorMessage }}</p>
        </div>

        <!-- 제출 버튼 -->
        <button :disabled="!isFormValid || isLoading"
          class="w-full relative bg-indigo-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all transform hover:translate-y-[-1px] active:translate-y-[0] shadow-lg shadow-indigo-100 mt-4">
          <span v-if="!isLoading">로그인</span>
          <div v-else class="flex items-center justify-center">
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </button>
      </form>

      <div class="text-center mt-10">
        <p class="text-sm text-gray-500 font-medium">
          아직 회원이 아니신가요?
          <RouterLink :to="{ name: 'signup' }" class="text-indigo-600 hover:text-indigo-700 font-bold ml-1 transition-colors">회원가입</RouterLink>
        </p>
        <p class="text-sm text-gray-500 font-medium">
          아이디나 비밀번호를 잊으셨나요?
          <br />
          <RouterLink :to="{ name: 'FindMember' }"
            class="text-indigo-600 hover:text-indigo-700 font-bold ml-1 transition-colors">
            아이디 / 비밀번호 찾기
          </RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-down {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-slide-down { animation: slide-down 0.2s ease-out forwards; }
.animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
input { -webkit-tap-highlight-color: transparent; }
</style>