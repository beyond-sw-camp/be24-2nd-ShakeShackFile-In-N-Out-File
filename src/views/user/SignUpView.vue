<script setup>
import { reactive, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/user'

const router = useRouter()
const isLoading = ref(false)
const signupSuccess = ref(false)

const signupForm = reactive({
  name: '',
  email: '',
  password: '',
  passwordConfirm: '',
})

const signupInputError = reactive({
  name: { errorMessage: null, isValid: false, touched: false },
  email: { errorMessage: null, isValid: false, touched: false },
  password: { errorMessage: null, isValid: false, touched: false },
  passwordConfirm: { errorMessage: null, isValid: false, touched: false }
})

// 정규식 정의
const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
const nicknameRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]{2,12}$/ // 영문+숫자 조합, 2~12자

// 유효성 검사 로직
const validateNickname = async () => {
  signupInputError.name.touched = true
  const val = signupForm.name.trim()

  if (val === '') {
    signupInputError.name.errorMessage = "닉네임을 입력해 주세요."
    signupInputError.name.isValid = false
    return
  }

  if (!nicknameRegex.test(val)) {
    signupInputError.name.errorMessage = "영문과 숫자를 조합하여 2~12자로 입력해 주세요."
    signupInputError.name.isValid = false
    return
  }

  signupInputError.name.errorMessage = null
  signupInputError.name.isValid = true
}

const validateEmail = () => {
  signupInputError.email.touched = true
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (signupForm.email === '') {
    signupInputError.email.errorMessage = "이메일 주소를 입력해 주세요."
    signupInputError.email.isValid = false
  } else if (!emailRegex.test(signupForm.email)) {
    signupInputError.email.errorMessage = "올바른 이메일 형식이 아닙니다."
    signupInputError.email.isValid = false
  } else {
    signupInputError.email.errorMessage = null
    signupInputError.email.isValid = true
  }
}

const validatePassword = () => {
  signupInputError.password.touched = true

  if (signupForm.password === '') {
    signupInputError.password.errorMessage = "비밀번호를 입력해 주세요."
    signupInputError.password.isValid = false
  } else if (!pwRegex.test(signupForm.password)) {
    signupInputError.password.errorMessage = "영문, 숫자, 특수문자를 포함하여 8자 이상 입력해 주세요."
    signupInputError.password.isValid = false
  } else {
    signupInputError.password.errorMessage = null
    signupInputError.password.isValid = true
  }

  // 비밀번호가 변경될 때마다 확인 필드도 재검증하여 일관성 유지
  if (signupForm.passwordConfirm) validatePasswordConfirm()
}

const validatePasswordConfirm = () => {
  signupInputError.passwordConfirm.touched = true
  const confirmVal = signupForm.passwordConfirm

  if (confirmVal === '') {
    signupInputError.passwordConfirm.errorMessage = "비밀번호를 한 번 더 입력해 주세요."
    signupInputError.passwordConfirm.isValid = false
  }
  // 확인창에서도 동일한 제약 조건 검증 수행
  else if (!pwRegex.test(confirmVal)) {
    signupInputError.passwordConfirm.errorMessage = "유효하지 않은 비밀번호 형식입니다."
    signupInputError.passwordConfirm.isValid = false
  }
  else if (confirmVal !== signupForm.password) {
    signupInputError.passwordConfirm.errorMessage = "비밀번호가 일치하지 않습니다."
    signupInputError.passwordConfirm.isValid = false
  } else {
    signupInputError.passwordConfirm.errorMessage = null
    signupInputError.passwordConfirm.isValid = true
  }
}

const isFormValid = computed(() => {
  return signupInputError.name.isValid &&
    signupInputError.email.isValid &&
    signupInputError.password.isValid &&
    signupInputError.passwordConfirm.isValid

})

const handleSignup = async () => {
  if (!isFormValid.value) return
  
  isLoading.value = true
  try {
    const { passwordConfirm, ...payload } = signupForm;
    const res = await api.signup(payload)
    signupSuccess.value = true
    setTimeout(() => {
      router.push({ name: 'login' })
    }, 2000)
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

const getInputClass = (field) => {
  const state = signupInputError[field]
  if (!state.touched) return 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20'
  return state.isValid
    ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
    : 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
}
</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Abstract Background Decor -->
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60">
    </div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60">
    </div>

    <div
      class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 w-full max-w-[480px] p-8 md:p-12 z-10">
      <!-- Header Section -->
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

        <p class="text-gray-500 mt-2 font-medium">나만의 워크스페이스를 시작하세요</p>
      </div>

      <!-- Success State -->
      <div v-if="signupSuccess" class="text-center py-10 animate-fade-in">
        <div
          class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">환영합니다!</h2>
        <p class="text-gray-500 mt-2">회원가입이 완료되었습니다.<br>잠시 후 로그인 페이지로 이동합니다.</p>
      </div>

      <!-- Form Section -->
      <form v-else @submit.prevent="handleSignup" class="space-y-5" novalidate>
        <!-- Nickname -->
        <div class="space-y-1.5">
          <label class="flex items-center text-sm font-bold text-gray-700 ml-1">
            <span>닉네임</span>
            <span v-if="signupInputError.name.errorMessage"
              class="ml-auto text-rose-500 text-[11px] font-bold animate-slide-down">
              {{ signupInputError.name.errorMessage }}
            </span>
          </label>
          <div class="relative">
            <input v-model="signupForm.name" @blur="validateNickname" type="text" placeholder="영문, 숫자 포함 2~12자"
              :class="['w-full bg-gray-50 border-2 rounded-xl px-4 py-3.5 text-sm transition-all outline-none focus:ring-4', getInputClass('name')]">
            
          </div>
        </div>

        <!-- Email -->
        <div class="space-y-1.5">
          <label class="flex items-center text-sm font-bold text-gray-700 ml-1">
            <span>이메일 </span>
            <span v-if="signupInputError.email.errorMessage"
              class="ml-auto text-rose-500 text-[11px] font-bold animate-slide-down">
              {{ signupInputError.email.errorMessage }}
            </span>
          </label>
          <input v-model="signupForm.email" @blur="validateEmail" type="email" placeholder="workspace@example.com"
            :class="['w-full bg-gray-50 border-2 rounded-xl px-4 py-3.5 text-sm transition-all outline-none focus:ring-4', getInputClass('email')]">
        </div>

        <!-- Password -->
        <div class="space-y-1.5">
          <label class="flex items-center text-sm font-bold text-gray-700 ml-1">
            <span>비밀번호 </span>
            <span v-if="signupInputError.password.errorMessage"
              class="ml-auto text-rose-500 text-[11px] font-bold animate-slide-down">
              {{ signupInputError.password.errorMessage }}
            </span>
          </label>
          <input v-model="signupForm.password" @blur="validatePassword" type="password"
            placeholder="영문, 숫자, 특수문자 조합 8자 이상"
            :class="['w-full bg-gray-50 border-2 rounded-xl px-4 py-3.5 text-sm transition-all outline-none focus:ring-4', getInputClass('password')]">
        </div>

        <!-- Password Confirm -->
        <div class="space-y-1.5">
          <label class="flex items-center text-sm font-bold text-gray-700 ml-1">
            <span>비밀번호 확인</span>
            <span v-if="signupInputError.passwordConfirm.errorMessage"
              class="ml-auto text-rose-500 text-[11px] font-bold animate-slide-down">
              {{ signupInputError.passwordConfirm.errorMessage }}
            </span>
          </label>
          <input v-model="signupForm.passwordConfirm" @blur="validatePasswordConfirm" type="password"
            placeholder="비밀번호를 다시 입력하세요"
            :class="['w-full bg-gray-50 border-2 rounded-xl px-4 py-3.5 text-sm transition-all outline-none focus:ring-4', getInputClass('passwordConfirm')]">
        </div>

        <!-- Submit Button -->
        <button :disabled="!isFormValid || isLoading"
          class="w-full relative bg-indigo-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all transform hover:translate-y-[-1px] active:translate-y-[0] shadow-lg shadow-indigo-100 mt-6">
          <span v-if="!isLoading">가입하기</span>
          <div v-else class="flex items-center justify-center">
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
              viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
              </path>
            </svg>
          </div>
        </button>
      </form>

      <div class="text-center mt-8">
        <p class="text-sm text-gray-500 font-medium">
          이미 계정이 있으신가요?
          <RouterLink to="/login" class="text-indigo-600 hover:text-indigo-700 font-bold ml-1 transition-colors">로그인
          </RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.animate-slide-down {
  animation: slide-down 0.2s ease-out forwards;
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out forwards;
}

input {
  -webkit-tap-highlight-color: transparent;
}
</style>