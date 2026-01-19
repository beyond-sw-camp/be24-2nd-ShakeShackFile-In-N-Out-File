<template>
  <div class="min-h-screen bg-[#f4f7fa] py-12 px-5 font-sans text-[#1a202c]">
    <div class="max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-[1.8fr_1.2fr] gap-[30px]">
      
      <!-- 메인 섹션 -->
      <div class="space-y-[30px]">
        <!-- 카드 정보 입력 박스 -->
        <div class="bg-white p-10 rounded-[24px] border border-[#edf2f7] shadow-sm">
          <h2 class="flex items-center gap-3 text-[1.75rem] font-black mt-1 mb-[30px]">
            <span class="w-7 h-7 bg-[#2563eb] text-white rounded-full text-[0.8rem] flex items-center justify-center">1</span>
            카드 결제 정보
          </h2>

          <div class="space-y-5">
            <!-- 카드 번호 -->
            <div class="space-y-2">
              <label class="block text-[0.85rem] font-bold text-[#4a5568]">카드 번호</label>
              <div class="grid grid-cols-4 gap-2.5">
                <input
                  type="text"
                  maxlength="4"
                  placeholder="0000"
                  class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                  v-model="card.n1"
                />
                <input
                  type="password"
                  maxlength="4"
                  placeholder="****"
                  class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                  v-model="card.n2"
                />
                <input
                  type="password"
                  maxlength="4"
                  placeholder="****"
                  class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                  v-model="card.n3"
                />
                <input
                  type="text"
                  maxlength="4"
                  placeholder="0000"
                  class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                  v-model="card.n4"
                />
              </div>
            </div>

            <!-- 유효기간 & CVC -->
            <div class="flex flex-row gap-5">
              <div class="flex-1 space-y-2">
                <label class="block text-[0.85rem] font-bold text-[#4a5568]">유효기간 (MM/YY)</label>
                <div class="flex items-center gap-2.5">
                  <input
                    type="text"
                    maxlength="2"
                    placeholder="MM"
                    class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base text-center transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                    v-model="card.mm"
                  />
                  <span class="text-[#cbd5e0]">/</span>
                  <input
                    type="text"
                    maxlength="2"
                    placeholder="YY"
                    class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base text-center transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                    v-model="card.yy"
                  />
                </div>
              </div>
              <div class="flex-1 space-y-2">
                <label class="block text-[0.85rem] font-bold text-[#4a5568]">CVC 번호</label>
                <input
                  type="password"
                  maxlength="3"
                  placeholder="뒷면 3자리"
                  class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                  v-model="card.cvc"
                />
              </div>
            </div>

            <!-- 비밀번호 & 할부 -->
            <div class="flex flex-row gap-5 pt-5 border-t border-[#f1f5f9]">
              <div class="space-y-2">
                <label class="block text-[0.85rem] font-bold text-[#4a5568]">비밀번호 앞 2자리</label>
                <input
                  type="password"
                  maxlength="2"
                  placeholder="**"
                  class="w-20 px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base text-center transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-600/10"
                  v-model="card.pwd"
                />
              </div>
              <div class="flex-1 space-y-2">
                <label class="block text-[0.85rem] font-bold text-[#4a5568]">할부 설정</label>
                <select 
                  class="w-full px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none text-base transition-all focus:bg-white focus:border-[#2563eb] appearance-none" 
                  v-model="card.installment"
                >
                  <option value="0">일시불</option>
                  <option value="2">2개월 (무이자)</option>
                  <option value="3">3개월 (무이자)</option>
                  <option value="6">6개월</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- 결제 동의 박스 -->
        <div class="bg-white p-10 rounded-[24px] border border-[#edf2f7] shadow-sm">
          <h2 class="flex items-center gap-3 text-[1.75rem] font-black mt-1 mb-5">
            <span class="w-7 h-7 bg-[#2563eb] text-white rounded-full text-[0.8rem] flex items-center justify-center">2</span>
            결제 동의
          </h2>
          <label class="flex gap-4 bg-[#f8fafc] p-5 rounded-2xl cursor-pointer select-none">
            <input type="checkbox" v-model="agreements" class="w-5 h-5 mt-0.5 cursor-pointer accent-blue-600" />
            <div class="text-[0.9rem] text-[#4a5568] leading-relaxed">
              <strong class="text-[#1a202c] font-bold">[필수] 정기결제 및 서비스 이용약관 동의</strong><br />
              입력하신 카드 정보로 매달 자동 결제됨에 동의합니다.
            </div>
          </label>
        </div>
      </div>

      <!-- 사이드 섹션 (요약) -->
      <div class="md:sticky md:top-8 h-fit">
        <div class="bg-white p-10 rounded-[24px] border border-[#edf2f7] shadow-sm">
          <div class="mb-[30px]">
            <span class="text-[0.75rem] font-extrabold text-[#2563eb] uppercase tracking-wider">Final Checkout</span>
            <h2 class="text-[1.75rem] font-black mt-1">{{ route.query.plan || 'Standard' }} 플랜</h2>
          </div>

          <div class="space-y-4">
            <div class="flex justify-between font-medium text-[#718096]">
              <span>구독 주기</span>
              <span class="text-[#1a202c]">{{ route.query.period || '월간' }}</span>
            </div>
            <div class="flex justify-between font-medium text-[#718096]">
              <span>결제 금액</span>
              <span class="text-[#1a202c]">${{ route.query.price || '0.00' }}</span>
            </div>
            <div class="flex justify-between items-center mt-[25px] pt-5 border-t border-[#f1f5f9]">
              <span class="font-bold">총 합계</span>
              <span class="text-[2rem] font-black text-[#2563eb]">${{ route.query.price || '0.00' }}</span>
            </div>
          </div>

          <button
            @click="handlePayment"
            :disabled="!isReady"
            :class="[
              'w-full p-[18px] mt-[30px] rounded-[16px] text-[1.1rem] font-bold transition-all duration-300',
              isReady 
                ? 'bg-[#1a202c] text-white cursor-pointer hover:bg-black hover:-translate-y-0.5 shadow-lg active:scale-95' 
                : 'bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed'
            ]"
          >
            안전하게 결제하기
          </button>

          <div class="text-center mt-[25px]">
            <p class="text-[0.7rem] text-[#a0aec0]">모든 정보는 256비트 SSL로 암호화됩니다.</p>
            <div class="text-[0.65rem] text-[#cbd5e0] font-extrabold mt-2.5 tracking-[0.1em]">
              VISA | MASTER | AMEX | JCB
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const agreements = ref(false)

const card = reactive({
  n1: '',
  n2: '',
  n3: '',
  n4: '',
  mm: '',
  yy: '',
  cvc: '',
  pwd: '',
  installment: '0',
})

const isReady = computed(() => {
  // 최소한의 필수 조건 체크
  return agreements.value && 
         card.n1.length === 4 && 
         card.n4.length === 4 && 
         card.mm.length === 2 && 
         card.yy.length === 2 && 
         card.cvc.length === 3
})

const handlePayment = () => {
  if (!isReady.value) return

  const price = route.query.price || '0.00'
  
  // 브라우저 팝업은 사용자 경험에 좋지 않으나, 요구사항 유지를 위해 남겨둠
  alert(`$${price} 결제가 성공적으로 완료되었습니다! 메인 화면으로 이동합니다.`)

  router.push('/main')
}
</script>