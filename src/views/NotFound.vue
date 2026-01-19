<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push({ name: 'home' })
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-main)] p-8 relative overflow-hidden">
    <div class="max-w-2xl text-center relative z-10 animate-fade-in-up">
      <!-- 404 아이콘 -->
      <div class="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] rounded-full mb-8 shadow-[0_20px_60px_rgba(240,125,24,0.3)] animate-float">
        <i class="fa-solid fa-cloud-exclamation text-6xl text-white"></i>
      </div>

      <!-- 404 숫자 -->
      <h1 class="text-[6rem] font-black bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] bg-clip-text text-transparent m-0 leading-none tracking-tighter">
        404 Not Found
      </h1>

      <!-- 메시지 -->
      <h2 class="text-3xl font-bold text-[var(--text-main)] mt-6 mb-4">
        페이지를 찾을 수 없습니다
      </h2>
      <p class="text-base text-[var(--text-secondary)] leading-relaxed mb-10">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.<br />
        URL을 다시 확인해주세요.
      </p>

      <!-- 버튼 그룹 -->
      <div class="flex gap-4 justify-center flex-wrap mb-12">
        <button 
          @click="goBack" 
          class="inline-flex items-center gap-2 px-8 py-3.5 text-[15px] font-semibold rounded-xl cursor-pointer transition-all duration-300 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-main)] hover:bg-[var(--border-color)] hover:-translate-y-0.5 relative overflow-hidden group"
        >
          <span class="absolute top-1/2 left-1/2 w-0 h-0 rounded-full bg-white/30 -translate-x-1/2 -translate-y-1/2 transition-all duration-600 group-hover:w-[300px] group-hover:h-[300px]"></span>
          <i class="fa-solid fa-arrow-left relative z-10"></i>
          <span class="relative z-10">이전 페이지</span>
        </button>
        <button 
          @click="goHome" 
          class="inline-flex items-center gap-2 px-8 py-3.5 text-[15px] font-semibold rounded-xl cursor-pointer transition-all duration-300 border-none bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-white shadow-[0_4px_15px_rgba(240,125,24,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(240,125,24,0.4)] relative overflow-hidden group"
        >
          <span class="absolute top-1/2 left-1/2 w-0 h-0 rounded-full bg-white/30 -translate-x-1/2 -translate-y-1/2 transition-all duration-600 group-hover:w-[300px] group-hover:h-[300px]"></span>
          <i class="fa-solid fa-house relative z-10"></i>
          <span class="relative z-10">홈으로 가기</span>
        </button>
      </div>

      <!-- 추천 링크 -->
      <div class="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl p-8 shadow-[var(--shadow-lg)]">
        <p class="text-sm font-semibold text-[var(--text-muted)] mb-5 uppercase tracking-wider">
          다음 페이지를 찾으시나요?
        </p>
        <div class="grid grid-cols-2 gap-4">
          <RouterLink 
            :to="{ name: 'home' }" 
            class="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm font-medium transition-all duration-300 no-underline hover:bg-[var(--bg-input)] hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(240,125,24,0.15)]"
          >
            <i class="fa-solid fa-house text-xl text-[var(--accent)]"></i>
            <span>홈</span>
          </RouterLink>
          <RouterLink 
            :to="{ name: 'drive' }" 
            class="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm font-medium transition-all duration-300 no-underline hover:bg-[var(--bg-input)] hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(240,125,24,0.15)]"
          >
            <i class="fa-brands fa-google-drive text-xl text-[var(--accent)]"></i>
            <span>내 드라이브</span>
          </RouterLink>
          <RouterLink 
            :to="{ name: 'shareFile' }" 
            class="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm font-medium transition-all duration-300 no-underline hover:bg-[var(--bg-input)] hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(240,125,24,0.15)]"
          >
            <i class="fa-solid fa-people-group text-xl text-[var(--accent)]"></i>
            <span>공유 문서함</span>
          </RouterLink>
          <RouterLink 
            :to="{ name: 'trash' }" 
            class="flex items-center gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] text-sm font-medium transition-all duration-300 no-underline hover:bg-[var(--bg-input)] hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(240,125,24,0.15)]"
          >
            <i class="fa-solid fa-trash text-xl text-[var(--accent)]"></i>
            <span>휴지통</span>
          </RouterLink>
        </div>
      </div>

      <!-- 장식 요소 -->
      <div class="fixed top-0 left-0 w-full h-full pointer-events-none z-[1]">
        <div class="absolute w-[300px] h-[300px] -top-[150px] -left-[150px] rounded-full bg-[var(--accent)] opacity-5 animate-float-shape"></div>
        <div class="absolute w-[200px] h-[200px] -bottom-[100px] -right-[100px] rounded-full bg-[var(--accent)] opacity-5 animate-float-shape-delayed-1"></div>
        <div class="absolute w-[150px] h-[150px] top-1/2 right-[10%] rounded-full bg-[var(--accent)] opacity-5 animate-float-shape-delayed-2"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 커스텀 애니메이션 */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes float-shape {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  33% {
    transform: translate(30px, -30px) rotate(120deg);
  }
  66% {
    transform: translate(-20px, 20px) rotate(240deg);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.animate-float-shape {
  animation: float-shape 20s ease-in-out infinite;
}

.animate-float-shape-delayed-1 {
  animation: float-shape 20s ease-in-out infinite 5s;
}

.animate-float-shape-delayed-2 {
  animation: float-shape 20s ease-in-out infinite 10s;
}

/* 반응형 (Tailwind로 처리하기 어려운 부분) */
@media (max-width: 768px) {
  h1 {
    font-size: 5rem;
  }
}
</style>