<script setup>
import { ref } from 'vue'
import PortOne from '@portone/browser-sdk/v2'
import IntrodHeader from '@/components/IntrodHeader.vue'
import { useRouter } from 'vue-router'
import { ordersApi } from '@/api/ordersApi'

const router = useRouter()
const isYearly = ref(false)
const selectedPlan = ref('Professional') // 기본 선택값

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
    monthlyPrice: 29000,
    yearlyPrice: 24000,
    description: '성장하는 팀과 프리랜서를 위한 강력한 도구',
    features: ['100GB 클라우드 저장소', '무제한 팀 멤버', '고급 분석 대시보드', '24/7 우선 기술 지원'],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 99000,
    yearlyPrice: 89000,
    description: '대규모 조직을 위한 커스텀 보안 및 관리',
    features: ['저장소 용량 무제한', '엔터프라이즈급 SSO 보안', '전담 계정 관리자 배정', '커스텀 API 통합 지원'],
  },
]

// 결제 상태
const paymentStatus = ref({
  status: '',
  message: '',
})

/**
 * 결제하기
 */
const onPayment = async () => {
  const plan = plans.find(p => p.name === selectedPlan.value)
  if (!plan) return

  if (plan.name === 'Starter') {
    alert('Starter 플랜은 무료입니다.')
    return
  }

  // 금액 계산 (예시)
  const amount = isYearly.value ? plan.yearlyPrice * 12 : plan.monthlyPrice
  
  try {
    paymentStatus.value = { status: 'IDLE', message: '주문 생성 중...' }

    // 1. 주문 생성
    const orderData = await ordersApi.createOrder({
      planType: plan.name.toUpperCase(), // 백엔드 설계에 맞춰 planType 전송 (예: BASIC, PROFESSIONAL 등)
      amount: amount, // 백엔드 설계에 맞춰 amount 전송
    })

    // 서버에서 반환하는 고유 주문번호 (BaseResponse 형태를 고려하여 result.orderId 등 확인)
    const orderId = orderData?.result?.orderId || orderData?.orderId

    if (!orderId) {
      throw new Error('주문 생성 실패: 서버에서 orderId를 반환하지 않았습니다.')
    }

    paymentStatus.value = { status: 'IDLE', message: '결제 진행 중...' }

    // 2. 주문 창 열기 (PortOne SDK)
    const paymentResult = await PortOne.requestPayment({
      storeId: 'store-445d1c07-f501-4e52-bd21-62fc568b3de3',
      channelKey: 'channel-key-b36de3d5-a4c9-4d4b-9240-df360144f8d4',
      paymentId: orderId, // 서버에서 생성된 고유 orderId를 PortOne paymentId로 사용
      orderName: `${plan.name} 플랜 (${isYearly.value ? '연간' : '월간'})`,
      totalAmount: amount, // 원화 기준
      currency: 'KRW',
      payMethod: 'CARD',
      customData: { planType: plan.name.toUpperCase() },
    })

    if (paymentResult.code) {
      // 결제 창 닫기 또는 실패 (취소 API 호출 생략)
      paymentStatus.value = { status: 'FAILED', message: paymentResult.message || '결제가 취소되었거나 실패했습니다.' }
      return
    }

    paymentStatus.value = { status: 'IDLE', message: '결제 검증 중...' }

    // 3. 주문 검증
    // 포트원 응답에 담긴 paymentId(또는 txId)와 우리 서버의 orderId를 함께 전송
    const verifyResponse = await ordersApi.verifyOrder({ 
      paymentId: paymentResult.paymentId || paymentResult.txId || orderId, // 포트원 결제 완료 후 반환되는 고유번호
      orderId: orderId 
    })

    // 성공 여부(verifyResponse.success 등)는 백엔드 응답 구조에 맞게 수정 필요
    if (verifyResponse?.success !== false) { // 임시 검증 로직 (실제 구조에 맞춰 변경해야 함)
      paymentStatus.value = { status: 'SUCCESS', message: '결제가 정상적으로 완료되었습니다.' }
      alert('결제가 성공적으로 완료되었습니다!')
      router.push({ name: 'main' }) // 또는 대시보드 화면 등 적절한 페이지로 라우팅
    } else {
      throw new Error('결제 검증 실패: 금액이 일치하지 않거나 위변조되었습니다.')
    }

  } catch (error) {
    console.error('결제 중 오류 발생:', error)
    paymentStatus.value = {
      status: 'FAILED',
      message: error.message || '결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
    }
    alert(paymentStatus.value.message)
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-100">
    <IntrodHeader></IntrodHeader>

    <header class="text-center py-20 px-6">
      <p class="text-blue-600 font-bold text-sm tracking-widest uppercase mb-4">Pricing Plans</p>
      <h1 class="text-5xl font-extrabold text-gray-900 mb-6">성장을 위한 최적의 플랜을 선택하세요</h1>

      <div class="flex items-center justify-center gap-4 mt-10">
        <span :class="!isYearly ? 'text-gray-900 font-bold' : 'text-gray-400'">월간 결제</span>
        <button @click="isYearly = !isYearly" class="w-14 h-7 rounded-full relative p-1 transition-colors duration-300"
          :class="isYearly ? 'bg-blue-600' : 'bg-gray-200'">
          <div class="w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 absolute top-1 left-1"
            :class="{ 'translate-x-7': isYearly }"></div>
        </button>
        <span :class="isYearly ? 'text-gray-900 font-bold' : 'text-gray-400'">연간 결제</span>
        <span class="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-full ml-2">2개월 무료 혜택</span>
      </div>
    </header>

    <section class="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
      <div v-for="plan in plans" :key="plan.name" @click="selectedPlan = plan.name"
        class="bg-white rounded-3xl border p-8 flex flex-col transition-all duration-300 relative cursor-pointer"
        :class="selectedPlan === plan.name
          ? 'border-blue-500 shadow-xl shadow-blue-100 scale-105 z-10'
          : 'border-gray-200 shadow-sm hover:-translate-y-2'
          ">
        <div v-if="selectedPlan === plan.name"
          class="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full tracking-tighter">
          SELECTED PLAN
        </div>

        <div class="mb-8">
          <h3 class="text-sm font-bold uppercase mb-2"
            :class="selectedPlan === plan.name ? 'text-blue-600' : 'text-gray-400'">
            {{ plan.name }}
          </h3>
          <div class="flex items-baseline gap-1">
            <span class="text-4xl font-black text-gray-900">
              ₩{{ isYearly ? plan.yearlyPrice.toLocaleString() : plan.monthlyPrice.toLocaleString() }}
            </span>
            <span class="text-gray-400 text-sm">/{{ isYearly ? '년' : '월' }}</span>
          </div>
          <p class="text-gray-500 text-xs mt-4 leading-relaxed">{{ plan.description }}</p>
        </div>

        <ul class="space-y-4 mb-10 flex-1">
          <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-3 text-sm text-gray-600">
            <span class="text-blue-500 text-xs">✔</span>
            {{ feature }}
          </li>
        </ul>

        <button @click="onPayment" class="w-full py-4 rounded-xl font-bold text-sm transition-all" :class="selectedPlan === plan.name
          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ">
          {{ plan.name === 'Starter' ? '현재 플랜' : '플랜 업그레이드' }}
        </button>
      </div>
    </section>
  </div>
</template>