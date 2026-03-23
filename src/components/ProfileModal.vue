<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { updateSettingsProfile, uploadSettingsProfileImage } from "@/api/featerApi";
import { STORAGE_ADDON_PRODUCTS, findMembershipProduct, formatKrw } from "@/constants/billingProducts";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFileStore } from "@/stores/useFileStore";
import GroupManagerPanel from "@/components/group/GroupManagerPanel.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  initialTab: {
    type: String,
    default: "profile",
  },
  settingsProfile: {
    type: Object,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "saved"]);
const authStore = useAuthStore();
const fileStore = useFileStore();

const activeTab = ref("profile");
const groupFocusSection = ref("manage");
const isSaving = ref(false);
const isUploadingImage = ref(false);
const saveError = ref("");
const imageFeedback = ref("");
const profileImageInput = ref(null);

const tabs = [
  { id: "group", label: "그룹", icon: "fa-solid fa-user-group" },
  { id: "profile", label: "프로필", icon: "fa-solid fa-circle-user" },
  { id: "security", label: "보안", icon: "fa-solid fa-shield-halved" },
  { id: "notification", label: "알림", icon: "fa-solid fa-bell" },
  { id: "language", label: "언어", icon: "fa-solid fa-globe" },
  { id: "billing", label: "결제", icon: "fa-solid fa-wallet" },
];

const groupSections = [
  { id: "requests", label: "요청 현황" },
  { id: "invite", label: "새 연결 초대" },
  { id: "create", label: "새 그룹 만들기" },
  { id: "manage", label: "그룹 관리" },
];

const localeOptions = [
  { code: "KO", label: "한국어" },
  { code: "EN", label: "English" },
  { code: "JA", label: "日本語" },
];

const regionOptions = [
  { code: "KR", label: "대한민국" },
  { code: "US", label: "United States" },
  { code: "JP", label: "Japan" },
];

const resolveMembershipLabel = (membershipCode) => {
  switch (String(membershipCode || "FREE").toUpperCase()) {
    case "PLUS":
      return "플러스 멤버십";
    case "PREMIUM":
      return "프리미엄 멤버십";
    default:
      return "기본 멤버십";
  }
};

const createDefaultProfileForm = () => ({
  displayName: "",
  email: "",
  role: "ROLE_USER",
  localeCode: "KO",
  regionCode: "KR",
  marketingOptIn: true,
  privateProfile: false,
  emailNotification: true,
  securityNotification: true,
  profileImageUrl: "",
  membershipCode: "FREE",
  membershipLabel: "기본 멤버십",
  storagePlanLabel: "기본 20GB",
  storageQuotaBytes: 0,
  storageBaseQuotaBytes: 0,
  storageAddonBytes: 0,
  joinedAt: null,
  updatedAt: null,
  emailVerified: false,
});

const profileForm = ref(createDefaultProfileForm());

const syncForm = (profile) => {
  if (!profile) return;

  const membershipCode = profile.membershipCode || "FREE";
  const membershipProduct = findMembershipProduct(membershipCode);

  profileForm.value = {
    ...createDefaultProfileForm(),
    displayName: profile.displayName || authStore.user?.name || "사용자",
    email: profile.email || authStore.user?.email || "",
    role: profile.role || authStore.user?.role || "ROLE_USER",
    localeCode: profile.localeCode || "KO",
    regionCode: profile.regionCode || "KR",
    marketingOptIn: Boolean(profile.marketingOptIn),
    privateProfile: Boolean(profile.privateProfile),
    emailNotification: Boolean(profile.emailNotification),
    securityNotification: Boolean(profile.securityNotification),
    profileImageUrl: profile.profileImageUrl || "",
    membershipCode,
    membershipLabel: profile.membershipLabel || resolveMembershipLabel(membershipCode),
    storagePlanLabel: profile.storagePlanLabel || membershipProduct.label,
    storageQuotaBytes: Number(profile.storageQuotaBytes || 0),
    storageBaseQuotaBytes: Number(profile.storageBaseQuotaBytes || 0),
    storageAddonBytes: Number(profile.storageAddonBytes || 0),
    joinedAt: profile.joinedAt || null,
    updatedAt: profile.updatedAt || null,
    emailVerified: Boolean(profile.emailVerified),
  };
};

watch(
  () => props.initialTab,
  (value) => {
    activeTab.value = value || "profile";
  },
  { immediate: true },
);

watch(
  () => props.settingsProfile,
  (profile) => {
    if (!profile) return;
    syncForm(profile);
  },
  { immediate: true },
);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return;
    saveError.value = "";
    imageFeedback.value = "";
    activeTab.value = props.initialTab || "profile";
    if (!fileStore.storageSummary && !fileStore.storageLoading) {
      fileStore.fetchStorageSummary().catch(() => {});
    }
  },
);

const profileInitials = computed(() => {
  const source = profileForm.value.displayName || authStore.user?.name || "User";
  return (
    source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => token[0]?.toUpperCase() || "")
      .join("") || "U"
  );
});

const storageSummary = computed(() => fileStore.storageSummary);
const storageUsageWidth = computed(() => `${Math.min(100, Math.max(0, Number(storageSummary.value?.usagePercent || 0)))}%`);
const currentMembershipProduct = computed(() => findMembershipProduct(profileForm.value.membershipCode));

const formatDate = (value) => {
  if (!value) return "정보 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const applySavedProfile = (savedProfile) => {
  syncForm(savedProfile);

  const currentUser = authStore.user || {};
  const updatedUser = {
    ...currentUser,
    name: savedProfile.displayName || currentUser.name,
    userName: savedProfile.displayName || currentUser.userName,
    email: savedProfile.email || currentUser.email,
    role: savedProfile.role || currentUser.role,
  };

  authStore.user = updatedUser;
  localStorage.setItem("USERINFO", JSON.stringify(updatedUser));
};

const handleTabSelect = (tabId) => {
  activeTab.value = tabId;

  if (tabId === "group" && !groupFocusSection.value) {
    groupFocusSection.value = "manage";
  }
};

const openProfileImagePicker = () => {
  profileImageInput.value?.click();
};

const downscaleProfileImage = async (file) => {
  if (!file || !file.type?.startsWith("image/")) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const target = new Image();
      target.onload = () => resolve(target);
      target.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
      target.src = objectUrl;
    });

    const maxDimension = 1600;
    const width = image.width || 1;
    const height = image.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    if (scale === 1) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png", 0.92);
    });

    if (!blob) {
      return file;
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.png`, {
      type: "image/png",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const handleProfileImageChange = async (event) => {
  const file = event?.target?.files?.[0];
  if (event?.target) {
    event.target.value = "";
  }

  if (!file) return;

  if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
    imageFeedback.value = "PNG 또는 JPG 이미지만 업로드할 수 있습니다.";
    return;
  }

  imageFeedback.value = "";
  isUploadingImage.value = true;

  try {
    const preparedFile = await downscaleProfileImage(file);
    const savedProfile = await uploadSettingsProfileImage(preparedFile);
    applySavedProfile(savedProfile);
    emit("saved", savedProfile);
    imageFeedback.value =
      preparedFile === file
        ? "프로필 이미지를 적용했습니다."
        : "프로필 이미지를 축소해 적용했습니다.";
  } catch (error) {
    imageFeedback.value =
      error?.response?.data?.message ||
      error?.message ||
      "프로필 이미지를 업로드하지 못했습니다.";
  } finally {
    isUploadingImage.value = false;
  }
};

const handleSave = async () => {
  saveError.value = "";
  isSaving.value = true;

  try {
    const savedProfile = await updateSettingsProfile({
      displayName: profileForm.value.displayName,
      localeCode: profileForm.value.localeCode,
      regionCode: profileForm.value.regionCode,
      marketingOptIn: profileForm.value.marketingOptIn,
      privateProfile: profileForm.value.privateProfile,
      emailNotification: profileForm.value.emailNotification,
      securityNotification: profileForm.value.securityNotification,
    });

    applySavedProfile(savedProfile);
    emit("saved", savedProfile);
    emit("close");
  } catch (error) {
    saveError.value =
      error?.response?.data?.message || 
      error?.message ||
      "설정을 저장하지 못했습니다.";
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="settings-overlay" :class="{ active: isOpen }" @click="emit('close')">
    <div class="settings-modal" @click.stop>
      <header class="settings-modal__header">
        <div>
          <p class="settings-modal__eyebrow">Account Center</p>
          <h2 class="settings-modal__title">설정</h2>
        </div>
        <button type="button" class="settings-close" @click="emit('close')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </header>

      <div class="settings-modal__body">
        <aside class="settings-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="settings-sidebar__item"
            :class="{ 'is-active': activeTab === tab.id }"
            @click="handleTabSelect(tab.id)"
          >
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <section class="settings-content">
          <div v-if="isLoading && !settingsProfile" class="settings-empty">설정 정보를 불러오는 중입니다.</div>

          <template v-else>
            <section v-if="activeTab === 'profile'" class="settings-pane">
              <div class="profile-hero">
                <div class="profile-avatar">
                  <img
                    v-if="profileForm.profileImageUrl"
                    :src="profileForm.profileImageUrl"
                    :alt="profileForm.displayName"
                    class="profile-avatar__image"
                  />
                  <span v-else>{{ profileInitials }}</span>
                </div>
                <div class="profile-hero__copy">
                  <span class="settings-pill settings-pill--blue">{{ profileForm.membershipLabel }}</span>
                  <h3>{{ profileForm.displayName }}</h3>
                  <p>{{ profileForm.email }}</p>
                  <div class="profile-hero__actions">
                    <button type="button" class="settings-ghost-button" :disabled="isUploadingImage" @click="openProfileImagePicker">
                      {{ isUploadingImage ? "이미지 적용 중..." : "프로필 이미지 변경" }}
                    </button>
                    <input ref="profileImageInput" type="file" accept="image/png,image/jpeg" hidden @change="handleProfileImageChange" />
                    <span class="settings-meta">가입일 : {{ formatDate(profileForm.joinedAt) }}</span>
                  </div>
                  <p v-if="imageFeedback" class="settings-feedback">{{ imageFeedback }}</p>
                </div>
              </div>

              <div class="settings-grid settings-grid--two">
                <label class="settings-field">
                  <span class="settings-field__label">표시 이름</span>
                  <input v-model="profileForm.displayName" class="settings-input" maxlength="100" />
                </label>
                <label class="settings-field">
                  <span class="settings-field__label">이메일</span>
                  <input :value="profileForm.email" class="settings-input" disabled />
                </label>
              </div>
            </section>

            <section v-else-if="activeTab === 'group'" class="settings-pane">
              <GroupManagerPanel :active="activeTab === 'group'" :focus-section="groupFocusSection" />
            </section>

            <section v-else-if="activeTab === 'security'" class="settings-pane">
              <div class="settings-card">
                <h3 class="settings-section__title">보안 상태</h3>
                <div class="settings-grid settings-grid--two">
                  <div class="settings-info-box">
                    <span class="settings-info-box__label">이메일 인증</span>
                    <strong>{{ profileForm.emailVerified ? "완료" : "대기" }}</strong>
                  </div>
                  <div class="settings-info-box">
                    <span class="settings-info-box__label">보안 알림</span>
                    <strong>{{ profileForm.securityNotification ? "켜짐" : "꺼짐" }}</strong>
                  </div>
                </div>
                <p class="settings-help">
                  비밀번호 변경은 기존 로그인 화면에서 진행해 주세요. 여기에서는 프로필 공개 범위와
                  보안 알림 수신 여부를 관리할 수 있습니다.
                </p>
              </div>

              <label class="settings-check">
                <input v-model="profileForm.privateProfile" type="checkbox" />
                <span>프로필을 비공개로 유지</span>
              </label>
              <label class="settings-check">
                <input v-model="profileForm.securityNotification" type="checkbox" />
                <span>보안 알림 메일 받기</span>
              </label>
            </section>

            <section v-else-if="activeTab === 'notification'" class="settings-pane">
              <label class="settings-check">
                <input v-model="profileForm.emailNotification" type="checkbox" />
                <span>파일 및 공유 알림 메일 받기</span>
              </label>
              <label class="settings-check">
                <input v-model="profileForm.marketingOptIn" type="checkbox" />
                <span>새 기능 및 혜택 안내 받기</span>
              </label>
            </section>

            <section v-else-if="activeTab === 'language'" class="settings-pane">
              <div class="settings-grid settings-grid--two">
                <label class="settings-field">
                  <span class="settings-field__label">언어</span>
                  <select v-model="profileForm.localeCode" class="settings-input">
                    <option v-for="option in localeOptions" :key="option.code" :value="option.code">{{ option.label }}</option>
                  </select>
                </label>
                <label class="settings-field">
                  <span class="settings-field__label">지역</span>
                  <select v-model="profileForm.regionCode" class="settings-input">
                    <option v-for="option in regionOptions" :key="option.code" :value="option.code">{{ option.label }}</option>
                  </select>
                </label>
              </div>
            </section>

            <section v-else-if="activeTab === 'billing'" class="settings-pane">
              <div class="billing-summary">
                <div>
                  <p class="settings-modal__eyebrow">Current Plan</p>
                  <h3 class="settings-section__title">{{ profileForm.storagePlanLabel }}</h3>
                  <p class="settings-help">{{ currentMembershipProduct.description }}</p>
                </div>
                <RouterLink
                  :to="{ name: 'payment', query: { category: 'membership', product: 'PLUS' } }"
                  class="settings-primary-link"
                  @click="emit('close')"
                >
                  멤버십 변경
                </RouterLink>
              </div>

              <div class="settings-card">
                <h3 class="settings-section__title">현재 멤버십 기능</h3>
                <p class="settings-help">멤버십 플랜은 기본 저장 공간과 사용할 수 있는 파일 기능을 함께 결정합니다.</p>
                <ul class="plan-feature-list">
                  <li v-for="feature in currentMembershipProduct.features" :key="feature">{{ feature }}</li>
                </ul>
              </div>

              <div v-if="storageSummary" class="storage-panel">
                <div class="storage-panel__head">
                  <span>저장 공간 사용량</span>
                  <strong>{{ storageSummary.usagePercent }}%</strong>
                </div>
                <div class="storage-panel__bar">
                  <div :style="{ width: storageUsageWidth }"></div>
                </div>
                <p class="settings-help">{{ formatBytes(storageSummary.usedBytes) }} / {{ formatBytes(storageSummary.quotaBytes) }} 사용 중</p>

                <div class="settings-grid settings-grid--three">
                  <div class="settings-info-box">
                    <span class="settings-info-box__label">기본 용량</span>
                    <strong>{{ formatBytes(storageSummary.addonQuotaBytes || profileForm.storageAddonBytes) }}</strong>
                    
                  </div>
                  <div class="settings-info-box">
                    <span class="settings-info-box__label">추가 용량</span>
                    <strong>{{ formatBytes(storageSummary.baseQuotaBytes || profileForm.storageBaseQuotaBytes) }}</strong>
                  </div>
                  <div class="settings-info-box">
                    <span class="settings-info-box__label">활성 파일</span>
                    <strong>{{ storageSummary.activeFileCount }}개</strong>
                  </div>
                </div>
              </div>

              <div class="settings-card">
                <h3 class="settings-section__title">추가 저장용량</h3>
                <p class="settings-help">추가 저장용량은 멤버십 기능을 바꾸지 않고 순수 저장 공간만 더합니다.</p>
              </div>

              <div class="addon-grid">
                <article v-for="product in STORAGE_ADDON_PRODUCTS" :key="product.code" class="addon-card">
                  <div>
                    <span class="settings-pill settings-pill--amber">{{ product.badge }}</span>
                    <h4>{{ product.label }}</h4>
                    <p>{{ product.description }}</p>
                  </div>
                  <div class="addon-card__footer">
                    <strong>{{ formatKrw(product.price) }}/ KRW</strong>
                    <RouterLink
                      :to="{ name: 'payment', query: { category: 'storage', product: product.code } }"
                      class="settings-ghost-button"
                      @click="emit('close')"
                    >
                      용량만 구입
                    </RouterLink>
                  </div>
                </article>
              </div>
            </section>
          </template>
        </section>
      </div>

      <footer class="settings-modal__footer">
        <p v-if="saveError" class="settings-error">{{ saveError }}</p>
        <div class="settings-modal__actions">
          <button type="button" class="settings-secondary-button" @click="emit('close')">닫기</button>
          <button type="button" class="settings-primary-button" :disabled="isSaving || isLoading || isUploadingImage" @click="handleSave">
            {{ isSaving ? "저장 중..." : "설정 저장" }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(10px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.settings-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.settings-modal {
  display: flex;
  width: min(1080px, 92vw);
  height: min(88vh, 860px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 2rem;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  box-shadow: 0 32px 80px color-mix(in srgb, #020617 18%, transparent);
}

.settings-modal__header,
.settings-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.3rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.settings-modal__footer {
  border-top: 1px solid var(--border-color);
  border-bottom: none;
}

.settings-modal__eyebrow {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0ea5e9;
}

.settings-modal__title {
  margin-top: 0.3rem;
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--text-main);
}

.settings-close {
  display: inline-flex;
  height: 2.6rem;
  width: 2.6rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--text-muted);
  transition: background-color 0.18s ease, color 0.18s ease;
}

.settings-close:hover {
  background: var(--bg-input);
  color: var(--text-main);
}

.settings-modal__body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 220px minmax(0, 1fr);
}

.settings-sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  border-right: 1px solid var(--border-color);
  padding: 1.2rem;
  background: color-mix(in srgb, var(--bg-input) 76%, var(--bg-elevated) 24%);
}

.settings-sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-radius: 1rem;
  padding: 0.85rem 0.95rem;
  color: var(--text-secondary);
  font-size: 0.92rem;
  font-weight: 700;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.settings-sidebar__item.is-active {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.settings-sidebar__submenu {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.2rem;
  padding: 0.15rem 0 0 0.85rem;
}

.settings-sidebar__subitem {
  border-radius: 0.85rem;
  padding: 0.72rem 0.9rem;
  text-align: left;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-main) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent);
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.settings-sidebar__subitem:hover {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-main) 88%);
}

.settings-sidebar__subitem.is-active {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.24);
  color: #0369a1;
}

.settings-content {
  min-height: 0;
  overflow-y: auto;
  padding: 1.35rem 1.5rem;
}

.settings-pane {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.profile-hero,
.billing-summary,
.storage-panel,
.settings-card {
  border-radius: 1.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  padding: 1.25rem;
}

.profile-hero {
  display: flex;
  gap: 1.25rem;
  align-items: center;
}

.profile-avatar {
  display: inline-flex;
  height: 5.4rem;
  width: 5.4rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  color: white;
  font-size: 1.4rem;
  font-weight: 900;
}

.profile-avatar__image {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.profile-hero__copy h3,
.settings-section__title {
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--text-main);
}

.profile-hero__copy p,
.settings-help,
.addon-card p {
  color: var(--text-muted);
  line-height: 1.6;
}

.profile-hero__actions,
.addon-card__footer,
.settings-modal__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.85rem;
}

.settings-feedback {
  margin-top: 0.7rem;
  color: #0f766e;
  font-size: 0.88rem;
  font-weight: 700;
}

.settings-grid {
  display: grid;
  gap: 1rem;
}

.settings-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.settings-field__label,
.settings-info-box__label,
.settings-meta {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
}

.settings-input {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  padding: 0.8rem 0.95rem;
  color: var(--text-main);
}

.settings-check {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-radius: 1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  padding: 1rem 1.1rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.settings-check input {
  height: 1rem;
  width: 1rem;
}

.settings-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.35rem 0.72rem;
  font-size: 0.72rem;
  font-weight: 900;
}

.settings-pill--blue {
  background: #e0f2fe;
  color: #0369a1;
}

.settings-pill--amber {
  background: #fef3c7;
  color: #b45309;
}

.storage-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  font-size: 0.94rem;
  font-weight: 800;
  color: var(--text-main);
}

.storage-panel__bar {
  margin: 0.9rem 0 0.8rem;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-input) 78%, var(--border-color) 22%);
}

.storage-panel__bar > div {
  height: 0.8rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%);
}

.settings-info-box {
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--bg-input) 84%, var(--bg-main) 16%);
  padding: 1rem;
}

.settings-info-box strong,
.addon-card strong {
  display: block;
  margin-top: 0.4rem;
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--text-main);
}

.plan-feature-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.9rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.55;
}

.plan-feature-list li {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.plan-feature-list li::before {
  content: "";
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.42rem;
  border-radius: 999px;
  background: #0ea5e9;
  flex-shrink: 0;
}

.addon-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.addon-card {
  display: flex;
  min-height: 12rem;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 1.4rem;
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  padding: 1.1rem;
}

.addon-card h4 {
  margin-top: 0.65rem;
  font-size: 1.05rem;
  font-weight: 900;
  color: var(--text-main);
}

.settings-primary-link,
.settings-primary-button,
.settings-secondary-button,
.settings-ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  font-size: 0.86rem;
  font-weight: 900;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.settings-primary-link,
.settings-primary-button {
  background: #0284c7;
  color: white;
}

.settings-primary-link:hover,
.settings-primary-button:hover {
  background: #0369a1;
}

.settings-secondary-button,
.settings-ghost-button {
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-secondary);
}

.settings-secondary-button:hover,
.settings-ghost-button:hover {
  background: var(--bg-input);
}

.settings-error {
  color: #dc2626;
  font-size: 0.88rem;
  font-weight: 700;
}

.settings-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  border-radius: 1.5rem;
  border: 1px dashed var(--border-color);
  background: color-mix(in srgb, var(--bg-input) 74%, var(--bg-main) 26%);
  color: var(--text-muted);
}

@media (max-width: 960px) {
  .settings-modal {
    width: min(96vw, 720px);
    height: min(94vh, 860px);
  }

  .settings-modal__body {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    flex-direction: row;
    overflow-x: auto;
  }

  .settings-sidebar__submenu {
    min-width: 100%;
    padding-left: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-grid--two,
  .settings-grid--three,
  .addon-grid {
    grid-template-columns: 1fr;
  }

  .profile-hero,
  .billing-summary {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
