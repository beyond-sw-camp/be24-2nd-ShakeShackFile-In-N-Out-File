<script setup>
import { ref } from 'vue'
import IntrodHeader from '@/components/IntrodHeader.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isYearly = ref(false)
const selectedPlan = ref('Professional') // 기본 선택값

// Pay.vue로 이동하며 데이터 전달
const goToPay = (plan) => {
  // 무료 플랜(Starter)은 결제 페이지로 가지 않음
  if (plan.monthlyPrice === 0) {
    alert('이미 사용 중인 플랜입니다.')
    return
  }
  
  router.push({
    name: 'pay',
    query: { 
      plan: plan.name, 
      price: isYearly.value ? plan.yearlyPrice : plan.monthlyPrice,
      period: isYearly.value ? '연간' : '월간'
    }
  })
}

const plans = [
  {
    name: 'Starter',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: '개인 사용자를 위한 영구 무료 플랜',
    features: ['5GB 클라우드 저장소', '최대 3명의 팀 멤버', '기본적인 보안 기능'],
  },
  {
    name: 'Professional',
    monthlyPrice: 29,
    yearlyPrice: 24,
    description: '성장하는 팀과 프리랜서를 위한 강력한 도구',
    features: ['100GB 클라우드 저장소', '무제한 팀 멤버', '고급 분석 대시보드', '24/7 우선 기술 지원'],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 99,
    yearlyPrice: 89,
    description: '대규모 조직을 위한 커스텀 보안 및 관리',
    features: ['저장소 용량 무제한', '엔터프라이즈급 SSO 보안', '전담 계정 관리자 배정', '커스텀 API 통합 지원'],
  },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-100">
    <IntrodHeader></IntrodHeader>

    <header class="text-center py-20 px-6">
      <p class="text-blue-600 font-bold text-sm tracking-widest uppercase mb-4">Pricing Plans</p>
      <h1 class="text-5xl font-extrabold text-gray-900 mb-6">성장을 위한 최적의 플랜을 선택하세요</h1>

      <div class="flex items-center justify-center gap-4 mt-10">
        <span :class="!isYearly ? 'text-gray-900 font-bold' : 'text-gray-400'">월간 결제</span>
        <button
          @click="isYearly = !isYearly"
          class="w-14 h-7 rounded-full relative p-1 transition-colors duration-300"
          :class="isYearly ? 'bg-blue-600' : 'bg-gray-200'"
        >
          <div
            class="w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 absolute top-1 left-1"
            :class="{ 'translate-x-7': isYearly }"
          ></div>
        </button>
        <span :class="isYearly ? 'text-gray-900 font-bold' : 'text-gray-400'">연간 결제</span>
        <span class="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-full ml-2">2개월 무료 혜택</span>
      </div>
    </header>

    <section class="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
      <div
        v-for="plan in plans"
        :key="plan.name"
        @click="selectedPlan = plan.name" 
        class="bg-white rounded-3xl border p-8 flex flex-col transition-all duration-300 relative cursor-pointer"
        :class="
          selectedPlan === plan.name
            ? 'border-blue-500 shadow-xl shadow-blue-100 scale-105 z-10'
            : 'border-gray-200 shadow-sm hover:-translate-y-2'
        "
      >
        <div
          v-if="selectedPlan === plan.name"
          class="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full tracking-tighter"
        >
          SELECTED PLAN
        </div>

        <div class="mb-8">
          <h3
            class="text-sm font-bold uppercase mb-2"
            :class="selectedPlan === plan.name ? 'text-blue-600' : 'text-gray-400'"
          >
            {{ plan.name }}
          </h3>
          <div class="flex items-baseline gap-1">
            <span class="text-4xl font-black text-gray-900">
              ${{ isYearly ? plan.yearlyPrice : plan.monthlyPrice }}
            </span>
            <span class="text-gray-400 text-sm">/{{ isYearly ? 'year' : 'month' }}</span>
          </div>
          <p class="text-gray-500 text-xs mt-4 leading-relaxed">{{ plan.description }}</p>
        </div>

        <ul class="space-y-4 mb-10 flex-1">
          <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-3 text-sm text-gray-600">
            <span class="text-blue-500 text-xs">✔</span>
            {{ feature }}
          </li>
        </ul>

        <button
          @click.stop="goToPay(plan)"
          class="w-full py-4 rounded-xl font-bold text-sm transition-all"
          :class="
            selectedPlan === plan.name
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          "
        >
          {{ plan.name === 'Starter' ? '현재 플랜' : '플랜 업그레이드' }}
        </button>
      </div>
    </section>
  </div>
</template>