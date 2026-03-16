const GIGABYTE = 1024 ** 3;

const MEMBERSHIP_RANK = {
  FREE: 0,
  PLUS: 1,
  PREMIUM: 2,
};

export const MEMBERSHIP_CAPABILITIES = {
  FREE: {
    shareEnabled: false,
    fileLockEnabled: false,
    maxUploadFileBytes: 5 * GIGABYTE,
    maxUploadCount: 30,
  },
  PLUS: {
    shareEnabled: true,
    fileLockEnabled: true,
    maxUploadFileBytes: 5 * GIGABYTE,
    maxUploadCount: 100,
  },
  PREMIUM: {
    shareEnabled: true,
    fileLockEnabled: true,
    maxUploadFileBytes: 20 * GIGABYTE,
    maxUploadCount: 200,
  },
};

export const normalizeMembershipCode = (membershipCode = "FREE") =>
  String(membershipCode || "FREE").trim().toUpperCase();

export const getMembershipRank = (membershipCode = "FREE") =>
  MEMBERSHIP_RANK[normalizeMembershipCode(membershipCode)] ?? MEMBERSHIP_RANK.FREE;

export const isMembershipDowngrade = (targetMembershipCode, currentMembershipCode) =>
  getMembershipRank(targetMembershipCode) < getMembershipRank(currentMembershipCode);

export const resolveMembershipCapabilities = (membershipCode = "FREE") =>
  MEMBERSHIP_CAPABILITIES[normalizeMembershipCode(membershipCode)] ||
  MEMBERSHIP_CAPABILITIES.FREE;

export const MEMBERSHIP_PRODUCTS = [
  {
    code: "FREE",
    category: "membership",
    name: "Free",
    label: "기본 20GB",
    description: "가볍게 시작하는 기본 멤버십입니다. 저장 공간만 제공되며 추가 기능은 포함되지 않습니다.",
    quotaLabel: "20GB",
    price: 0,
    badge: "기본 제공",
    features: [
      "추가 저장 공간 20GB",
      "파일 잠금 기능 없음",
      "파일 공유 기능 없음",
      "한 번에 최대 30개 업로드",
      "파일당 최대 5GB 업로드",
    ],
  },
  {
    code: "PLUS",
    category: "membership",
    name: "Plus",
    label: "플러스 500GB",
    description: "실무 작업에 필요한 저장 공간과 함께 파일 잠금, 파일 공유 기능을 사용할 수 있는 멤버십입니다.",
    quotaLabel: "500GB",
    price: 129000,
    badge: "연간 결제",
    features: [
      "추가 저장 공간 500GB",
      "파일 잠금 기능 제공",
      "파일 공유 기능 제공",
      "한 번에 최대 100개 업로드",
      "파일당 최대 5GB 업로드",
    ],
  },
  {
    code: "PREMIUM",
    category: "membership",
    name: "Premium",
    label: "프리미엄 1TB",
    description: "대용량 작업을 위한 상위 멤버십입니다. 파일 잠금, 파일 공유, 더 큰 업로드 한도를 모두 제공합니다.",
    quotaLabel: "1TB",
    price: 229000,
    badge: "연간 결제",
    features: [
      "추가 저장 공간 1TB",
      "파일 잠금 기능 제공",
      "파일 공유 기능 제공",
      "한 번에 최대 300개 업로드",
      "파일당 최대 20GB 업로드",
    ],
  },
];

export const STORAGE_ADDON_PRODUCTS = [
  {
    code: "ADDON_20GB",
    category: "storage",
    label: "추가 20GB",
    quotaLabel: "20GB",
    price: 24000,
    badge: "1년권",
    description: "현재 멤버십 기능은 그대로 두고 저장 공간만 20GB 추가합니다.",
  },
  {
    code: "ADDON_40GB",
    category: "storage",
    label: "추가 40GB",
    quotaLabel: "40GB",
    price: 43000,
    badge: "1년권",
    description: "현재 멤버십 기능은 그대로 두고 저장 공간만 40GB 추가합니다.",
  },
  {
    code: "ADDON_80GB",
    category: "storage",
    label: "추가 80GB",
    quotaLabel: "80GB",
    price: 79000,
    badge: "1년권",
    description: "현재 멤버십 기능은 그대로 두고 저장 공간만 80GB 추가합니다.",
  },
  {
    code: "ADDON_100GB",
    category: "storage",
    label: "추가 100GB",
    quotaLabel: "100GB",
    price: 94000,
    badge: "1년권",
    description: "현재 멤버십 기능은 그대로 두고 저장 공간만 100GB 추가합니다.",
  },
  {
    code: "ADDON_1TB",
    category: "storage",
    label: "추가 1TB",
    quotaLabel: "1TB",
    price: 249000,
    badge: "1년권",
    description: "현재 멤버십 기능은 그대로 두고 저장 공간만 1TB 추가합니다.",
  },
  {
    code: "ADDON_5TB",
    category: "storage",
    label: "추가 5TB",
    quotaLabel: "5TB",
    price: 890000,
    badge: "1년권",
    description: "현재 멤버십 기능은 그대로 두고 저장 공간만 5TB 추가합니다.",
  },
];

export const BILLING_PRODUCTS = [...MEMBERSHIP_PRODUCTS, ...STORAGE_ADDON_PRODUCTS];

export const findBillingProduct = (productCode) =>
  BILLING_PRODUCTS.find((product) => product.code === productCode) || null;

export const findMembershipProduct = (productCode) =>
  MEMBERSHIP_PRODUCTS.find((product) => product.code === normalizeMembershipCode(productCode)) ||
  MEMBERSHIP_PRODUCTS[0];

export const formatKrw = (value) =>
  new Intl.NumberFormat("ko-KR").format(Number(value || 0));
