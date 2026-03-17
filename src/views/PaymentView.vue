<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PortOne from "@portone/browser-sdk/v2";
import IntrodHeader from "@/components/IntrodHeader.vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFileStore } from "@/stores/useFileStore";
import { createOrder, verifyOrder } from "@/api/ordersApi";
import {
  MEMBERSHIP_PRODUCTS,
  STORAGE_ADDON_PRODUCTS,
  findBillingProduct,
  formatKrw,
  isMembershipDowngrade,
  normalizeMembershipCode,
} from "@/constants/billingProducts";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const fileStore = useFileStore();

const paymentStatus = ref({
  status: "idle",
  message: "상품을 선택한 뒤 결제를 진행해 주세요.",
});
const isProcessing = ref(false);
const selectedProductCode = ref("PLUS");

const selectedCategory = computed(() =>
  route.query.category === "storage" ? "storage" : "membership",
);
const currentMembershipCode = computed(() =>
  normalizeMembershipCode(fileStore.storageSummary?.planCode || "FREE"),
);
const currentMembershipProduct = computed(() =>
  MEMBERSHIP_PRODUCTS.find((product) => product.code === currentMembershipCode.value) ||
  MEMBERSHIP_PRODUCTS[0],
);
const selectedProduct = computed(() =>
  findBillingProduct(selectedProductCode.value) || MEMBERSHIP_PRODUCTS[1],
);

const isMembershipPurchaseBlocked = (productCode) =>
  isMembershipDowngrade(productCode, currentMembershipCode.value);

const canSelectMembershipProduct = (productCode) =>
  !isMembershipPurchaseBlocked(productCode);

const resolveSelectedProductCode = (requestedProductCode, category) => {
  const fallbackProductCode = category === "storage" ? "ADDON_20GB" : "PLUS";
  const requestedProduct = findBillingProduct(String(requestedProductCode || ""));
  const fallbackProduct = findBillingProduct(fallbackProductCode);

  if (!requestedProduct || requestedProduct.category !== category) {
    if (category === "membership" && isMembershipPurchaseBlocked(fallbackProductCode)) {
      return currentMembershipCode.value;
    }
    return fallbackProduct?.code || fallbackProductCode;
  }

  if (category === "membership" && isMembershipPurchaseBlocked(requestedProduct.code)) {
    return currentMembershipCode.value;
  }

  return requestedProduct.code;
};

const syncSelectedProduct = () => {
  const nextProductCode = resolveSelectedProductCode(
    route.query.product,
    selectedCategory.value,
  );

  if (selectedProductCode.value === nextProductCode) {
    return;
  }

  selectedProductCode.value = nextProductCode;
};

const selectedFeatureList = computed(() => {
  if (selectedCategory.value === "membership") {
    return selectedProduct.value?.features || [];
  }

  return [
    "선택한 용량만 1년 동안 추가됩니다.",
    "멤버십 기능과 업로드 한도는 바뀌지 않습니다.",
  ];
});

const checkoutButtonLabel = computed(() => {
  if (isProcessing.value) {
    return "결제 준비 중...";
  }

  if (selectedProduct.value.price <= 0) {
    return "무료 플랜은 결제가 필요하지 않습니다";
  }

  if (
    selectedCategory.value === "membership" &&
    selectedProduct.value.code === currentMembershipCode.value
  ) {
    return `${selectedProduct.value.label} 갱신하기`;
  }

  return `${selectedProduct.value.label} 결제하기`;
});

watch(
  [() => route.query.product, selectedCategory, currentMembershipCode],
  () => {
    syncSelectedProduct();
  },
  { immediate: true },
);

onMounted(() => {
  if (authStore.token && !fileStore.storageSummary && !fileStore.storageLoading) {
    fileStore.fetchStorageSummary().catch(() => {});
  }
});

const randomId = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const selectProduct = (productCode, category) => {
  if (category === "membership" && isMembershipPurchaseBlocked(productCode)) {
    paymentStatus.value = {
      status: "failed",
      message: `현재 ${currentMembershipProduct.value.label} 이상 멤버십을 사용 중이라 하위 플랜은 구매할 수 없습니다.`,
    };
    return;
  }

  paymentStatus.value = {
    status: "idle",
    message: "상품을 선택한 뒤 결제를 진행해 주세요.",
  };

  selectedProductCode.value = productCode;
  router.replace({
    name: "payment",
    query: { category, product: productCode },
  });
};

const requestPayment = async (order) => {
  return PortOne.requestPayment({
    storeId: "store-445d1c07-f501-4e52-bd21-62fc568b3de3",
    channelKey: "channel-key-b36de3d5-a4c9-4d4b-9240-df360144f8d4",
    paymentId: randomId(),
    orderName: order.productName,
    totalAmount: Number(order.amount || 0),
    currency: "KRW",
    payMethod: "CARD",
    customData: {
      orderId: order.orderId,
      productCode: order.productCode,
    },
  });
};

const startCheckout = async () => {
  const product = selectedProduct.value;

  if (!product) {
    paymentStatus.value = { status: "failed", message: "선택한 상품 정보를 찾을 수 없습니다." };
    return;
  }

  if (selectedCategory.value === "membership" && isMembershipPurchaseBlocked(product.code)) {
    paymentStatus.value = {
      status: "failed",
      message: "현재 멤버십보다 낮은 등급은 구매할 수 없습니다.",
    };
    return;
  }

  if (product.price <= 0) {
    paymentStatus.value = {
      status: "idle",
      message: "기본 멤버십은 무료입니다. 상위 멤버십 또는 추가 저장용량을 선택해 주세요.",
    };
    return;
  }

  if (!authStore.token) {
    paymentStatus.value = { status: "failed", message: "결제는 로그인 후 진행할 수 있습니다." };
    router.push({ name: "login" });
    return;
  }

  isProcessing.value = true;
  paymentStatus.value = { status: "loading", message: "주문 정보를 준비하고 있습니다." };

  try {
    const order = await createOrder(product.code);
    const paymentResult = await requestPayment(order);

    if (paymentResult?.code) {
      paymentStatus.value = {
        status: "failed",
        message: paymentResult.pgMessage || paymentResult.message || "결제를 진행하지 못했습니다.",
      };
      return;
    }

    const paymentId = paymentResult?.paymentId || paymentResult?.payment_id;
    if (!paymentId) {
      paymentStatus.value = { status: "failed", message: "결제 응답에서 결제 ID를 확인하지 못했습니다." };
      return;
    }

    paymentStatus.value = { status: "loading", message: "결제 정보를 검증하고 있습니다." };
    await verifyOrder(paymentId, order.orderId);
    await fileStore.fetchStorageSummary().catch(() => {});
    paymentStatus.value = {
      status: "success",
      message: `${product.label} 결제가 완료되었습니다. 플랜 정보가 바로 반영됩니다.`,
    };

    window.setTimeout(() => {
      router.push({ name: "storage" });
    }, 900);
  } catch (error) {
    paymentStatus.value = {
      status: "failed",
      message:
        error?.response?.data?.message ||
        error?.message ||
        "결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    };
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <IntrodHeader />

    <main class="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-14 lg:px-10">
      <section class="rounded-[2rem] border border-slate-200 bg-white px-7 py-8 shadow-sm lg:px-10 lg:py-10">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-sm font-black uppercase tracking-[0.22em] text-sky-600">Annual Billing</p>
            <h1 class="mt-4 text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
              멤버십 플랜과 추가 저장용량을 분리해서 선택해 주세요
            </h1>
            <p class="mt-4 text-base leading-7 text-slate-600">
              멤버십 플랜은 저장 공간과 기능이 함께 바뀌고, 추가 저장용량은 현재 멤버십 기능을 유지한 채 용량만 더해집니다.
            </p>
          </div>

          <div class="rounded-[1.5rem] bg-slate-100 px-5 py-4 text-sm text-slate-600">
            <p class="font-bold text-slate-900">현재 멤버십</p>
            <p class="mt-1 text-lg font-black text-slate-950">
              {{ currentMembershipProduct.label }}
            </p>
            <p class="mt-2">
              선택 상품: {{ selectedProduct.label }} · 연간 {{ formatKrw(selectedProduct.price) }}원
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-8">
          <section>
            <div class="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 class="text-2xl font-black text-slate-950">멤버십 플랜</h2>
                <p class="mt-2 text-sm text-slate-500">
                  저장 공간과 파일 기능을 함께 바꾸는 연간 멤버십입니다.
                </p>
              </div>
              <span class="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                {{ selectedCategory === "membership" ? "현재 선택 중" : "기능 포함 상품" }}
              </span>
            </div>

            <div class="grid gap-4 xl:grid-cols-3">
              <article
                v-for="product in MEMBERSHIP_PRODUCTS"
                :key="product.code"
                class="billing-card"
                :class="{
                  'is-selected': selectedCategory === 'membership' && selectedProductCode === product.code,
                  'is-disabled': isMembershipPurchaseBlocked(product.code),
                }"
                @click="selectProduct(product.code, 'membership')"
              >
                <div class="billing-card__top">
                  <div class="billing-card__badge-row">
                    <span class="billing-card__badge">
                      {{
                        product.code === currentMembershipCode
                          ? "현재 플랜"
                          : isMembershipPurchaseBlocked(product.code)
                            ? "하위 플랜 구매 불가"
                            : product.badge
                      }}
                    </span>
                  </div>
                  <h3 class="billing-card__title">{{ product.label }}</h3>
                  <p class="billing-card__description">{{ product.description }}</p>
                </div>
                <ul class="billing-card__features">
                  <li v-for="feature in product.features" :key="feature">{{ feature }}</li>
                </ul>
                <div class="billing-card__price-wrap">
                  <strong class="billing-card__price">
                    {{ product.price > 0 ? `${formatKrw(product.price)}원` : "무료" }}
                  </strong>
                  <span class="billing-card__period">/ 1년</span>
                </div>
                <p class="billing-card__quota">기본 제공 저장 공간 {{ product.quotaLabel }}</p>
              </article>
            </div>
          </section>

          <section>
            <div class="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 class="text-2xl font-black text-slate-950">추가 저장용량</h2>
                <p class="mt-2 text-sm text-slate-500">
                  현재 멤버십 기능은 유지하고 저장 공간만 1년 동안 추가합니다.
                </p>
              </div>
              <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                {{ selectedCategory === "storage" ? "추가 용량 선택 중" : "순수 용량 상품" }}
              </span>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article
                v-for="product in STORAGE_ADDON_PRODUCTS"
                :key="product.code"
                class="billing-card billing-card--addon"
                :class="{ 'is-selected': selectedCategory === 'storage' && selectedProductCode === product.code }"
                @click="selectProduct(product.code, 'storage')"
              >
                <div class="billing-card__top">
                  <span class="billing-card__badge">{{ product.badge }}</span>
                  <h3 class="billing-card__title">{{ product.label }}</h3>
                  <p class="billing-card__description">{{ product.description }}</p>
                </div>
                <ul class="billing-card__features">
                  <li>멤버십 기능 변경 없음</li>
                  <li>저장 공간 {{ product.quotaLabel }} 추가</li>
                </ul>
                <div class="billing-card__price-wrap">
                  <strong class="billing-card__price">{{ formatKrw(product.price) }}원</strong>
                  <span class="billing-card__period">/ 1년</span>
                </div>
                <p class="billing-card__quota">추가 제공 {{ product.quotaLabel }}</p>
              </article>
            </div>
          </section>
        </div>

        <aside class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-8 lg:h-fit">
          <p class="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Checkout</p>
          <h2 class="mt-3 text-3xl font-black text-slate-950">{{ selectedProduct.label }}</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">{{ selectedProduct.description }}</p>

          <div class="mt-6 rounded-[1.5rem] bg-slate-100 p-5">
            <div class="flex items-center justify-between text-sm text-slate-500">
              <span>상품 금액</span>
              <span>{{ selectedProduct.price > 0 ? `${formatKrw(selectedProduct.price)}원` : "무료" }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between text-sm text-slate-500">
              <span>제공 용량</span>
              <span>{{ selectedProduct.quotaLabel }}</span>
            </div>
            <div class="mt-4 border-t border-slate-200 pt-4">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Total</p>
                  <p class="mt-2 text-3xl font-black text-slate-950">
                    {{ selectedProduct.price > 0 ? `${formatKrw(selectedProduct.price)}원` : "무료" }}
                  </p>
                </div>
                <p class="text-xs font-semibold text-slate-500">연간 결제만 지원</p>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">포함 내용</p>
            <ul class="mt-3 space-y-2 text-sm text-slate-700">
              <li v-for="feature in selectedFeatureList" :key="feature" class="feature-row">{{ feature }}</li>
            </ul>
          </div>

          <button
            type="button"
            class="mt-6 w-full rounded-full bg-sky-600 px-5 py-3.5 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
            :disabled="
              isProcessing ||
              selectedProduct.price <= 0 ||
              (selectedCategory === 'membership' && isMembershipPurchaseBlocked(selectedProduct.code))
            "
            @click="startCheckout"
          >
            {{ checkoutButtonLabel }}
          </button>

          <p class="mt-4 text-xs leading-6 text-slate-500">
            결제가 완료되면 멤버십 정보와 저장 공간이 즉시 갱신됩니다.
          </p>

          <div
            class="mt-6 rounded-[1.5rem] border px-4 py-4 text-sm"
            :class="
              paymentStatus.status === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : paymentStatus.status === 'failed'
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
            "
          >
            {{ paymentStatus.message }}
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

<style scoped>
.billing-card {
  display: flex;
  min-height: 23rem;
  cursor: pointer;
  flex-direction: column;
  justify-content: space-between;
  gap: 1.2rem;
  border-radius: 1.7rem;
  border: 1px solid #e2e8f0;
  background: white;
  padding: 1.4rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.billing-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
}

.billing-card.is-selected {
  border-color: #0ea5e9;
  box-shadow: 0 18px 36px rgba(14, 165, 233, 0.14);
}

.billing-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.62;
  border-style: dashed;
}

.billing-card.is-disabled:hover {
  transform: none;
  box-shadow: none;
}

.billing-card--addon.is-selected {
  border-color: #f59e0b;
  box-shadow: 0 18px 36px rgba(245, 158, 11, 0.16);
}

.billing-card__top {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.billing-card__badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.billing-card__badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  background: #e0f2fe;
  padding: 0.38rem 0.72rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: #0369a1;
}

.billing-card--addon .billing-card__badge {
  background: #fef3c7;
  color: #b45309;
}

.billing-card__title {
  font-size: 1.25rem;
  font-weight: 900;
  color: #020617;
}

.billing-card__description {
  font-size: 0.92rem;
  line-height: 1.6;
  color: #64748b;
}

.billing-card__features {
  display: grid;
  gap: 0.55rem;
  color: #334155;
  font-size: 0.88rem;
  line-height: 1.5;
}

.feature-row,
.billing-card__features li {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
}

.feature-row::before,
.billing-card__features li::before {
  content: "";
  display: inline-flex;
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.4rem;
  border-radius: 999px;
  background: #0ea5e9;
  flex-shrink: 0;
}

.billing-card--addon .billing-card__features li::before {
  background: #f59e0b;
}

.billing-card__price-wrap {
  display: flex;
  align-items: end;
  gap: 0.45rem;
}

.billing-card__price {
  font-size: 2rem;
  font-weight: 900;
  color: #020617;
}

.billing-card__period {
  font-size: 0.88rem;
  font-weight: 700;
  color: #64748b;
}

.billing-card__quota {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
}
</style>
