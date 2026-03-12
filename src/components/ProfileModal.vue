<script setup>
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { updateSettingsProfile, uploadSettingsProfileImage } from "@/api/featerApi";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFileStore } from "@/stores/useFileStore";

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
const isSaving = ref(false);
const isUploadingImage = ref(false);
const saveError = ref("");
const imageFeedback = ref("");
const profileImageInput = ref(null);
const mergeImageOnlyFromParent = ref(false);

const profileForm = ref({
  displayName: "",
  email: "",
  role: "",
  localeCode: "KO",
  regionCode: "KR",
  marketingOptIn: true,
  privateProfile: false,
  emailNotification: true,
  securityNotification: true,
  profileImageUrl: "",
  membershipLabel: "FREE MEMBER",
  storagePlanLabel: "기본 20GB",
  joinedAt: null,
  updatedAt: null,
  emailVerified: false,
});

const tabs = [
  { id: "profile", label: "기본 프로필", icon: "fa-solid fa-circle-user" },
  { id: "security", label: "계정 및 보안", icon: "fa-solid fa-shield-halved" },
  { id: "notification", label: "알림 설정", icon: "fa-solid fa-bell" },
  { id: "language", label: "언어 및 지역", icon: "fa-solid fa-globe" },
  { id: "billing", label: "구독 및 결제", icon: "fa-solid fa-wallet" },
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

const syncForm = (profile) => {
  if (!profile) {
    return;
  }

  profileForm.value = {
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
    membershipLabel: profile.membershipLabel || "FREE MEMBER",
    storagePlanLabel: profile.storagePlanLabel || "기본 20GB",
    joinedAt: profile.joinedAt || null,
    updatedAt: profile.updatedAt || null,
    emailVerified: Boolean(profile.emailVerified),
  };
};

const mergeProfileImageIntoForm = (profile) => {
  if (!profile) {
    return;
  }

  profileForm.value = {
    ...profileForm.value,
    profileImageUrl: profile.profileImageUrl || "",
    membershipLabel: profile.membershipLabel || profileForm.value.membershipLabel,
    storagePlanLabel: profile.storagePlanLabel || profileForm.value.storagePlanLabel,
    joinedAt: profile.joinedAt || profileForm.value.joinedAt,
    updatedAt: profile.updatedAt || profileForm.value.updatedAt,
    emailVerified: profile.emailVerified ?? profileForm.value.emailVerified,
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
    if (!profile) {
      return;
    }

    if (mergeImageOnlyFromParent.value) {
      mergeProfileImageIntoForm(profile);
      mergeImageOnlyFromParent.value = false;
      return;
    }

    syncForm(profile);
  },
  { immediate: true },
);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    activeTab.value = props.initialTab || "profile";
    saveError.value = "";
    imageFeedback.value = "";

    if (!fileStore.storageSummary && !fileStore.storageLoading) {
      fileStore.fetchStorageSummary().catch(() => {});
    }
  },
);

const formatDate = (value) => {
  if (!value) return "정보 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const profileInitials = computed(() => {
  const source = profileForm.value.displayName || authStore.user?.name || "User";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("") || "U";
});

const storageSummary = computed(() => fileStore.storageSummary);
const storageUsageWidth = computed(() => `${Math.min(100, Math.max(0, Number(storageSummary.value?.usagePercent || 0)))}%`);

const applySavedProfile = (savedProfile, options = {}) => {
  if (options.imageOnly) {
    mergeProfileImageIntoForm(savedProfile);
  } else {
    syncForm(savedProfile);
  }

  const currentUser = authStore.user || {};
  const updatedUser = {
    ...currentUser,
    name: options.imageOnly ? (profileForm.value.displayName || currentUser.name) : savedProfile.displayName,
    userName: options.imageOnly ? (profileForm.value.displayName || currentUser.userName) : savedProfile.displayName,
    email: savedProfile.email || currentUser.email,
    role: savedProfile.role || currentUser.role,
    localeCode: options.imageOnly ? (profileForm.value.localeCode || currentUser.localeCode) : savedProfile.localeCode,
  };

  authStore.user = updatedUser;
  localStorage.setItem("USERINFO", JSON.stringify(updatedUser));
};

const openProfileImagePicker = () => {
  profileImageInput.value?.click();
};

const handleProfileImageChange = async (event) => {
  const file = event?.target?.files?.[0];
  event.target.value = "";

  if (!file) {
    return;
  }

  const isSupportedType = ["image/png", "image/jpeg", "image/jpg"].includes(file.type);
  if (!isSupportedType) {
    imageFeedback.value = "JPG 또는 PNG 파일만 업로드할 수 있습니다.";
    return;
  }

  imageFeedback.value = "";
  isUploadingImage.value = true;

  try {
    const savedProfile = await uploadSettingsProfileImage(file);
    mergeImageOnlyFromParent.value = true;
    applySavedProfile(savedProfile, { imageOnly: true });
    emit("saved", savedProfile);
    imageFeedback.value = "프로필 이미지가 300 x 300px로 적용되었습니다.";
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
  <div
    :class="['settings-overlay', { active: isOpen }]"
    @click="emit('close')"
  >
    <div class="settings-modal" @click.stop>
      <div class="settings-modal__header">
        <div class="settings-modal__title-wrap">
          <div class="settings-modal__title-icon">
            <i class="fa-solid fa-users-gear"></i>
          </div>
          <h2 class="settings-modal__title">설정</h2>
        </div>

        <button
          type="button"
          class="settings-modal__close"
          @click="emit('close')"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="settings-modal__body">
        <aside class="settings-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="settings-sidebar__item"
            :class="{ 'is-active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <section class="settings-content">
          <div
            v-if="isLoading && !settingsProfile"
            class="settings-placeholder"
          >
            설정 정보를 불러오는 중입니다.
          </div>

          <template v-else>
            <div v-if="activeTab === 'profile'" class="settings-pane">
              <section class="settings-section">
                <h3 class="settings-section__title">프로필 이미지</h3>
                <div class="settings-profile-hero">
                  <div class="settings-avatar-card">
                    <div class="settings-avatar-preview">
                      <img
                        v-if="profileForm.profileImageUrl"
                        :src="profileForm.profileImageUrl"
                        :alt="profileForm.displayName"
                        class="settings-avatar-image"
                      />
                      <span v-else>{{ profileInitials }}</span>
                    </div>
                  </div>

                  <div class="settings-profile-hero__meta">
                    <div class="settings-profile-badges">
                      <span class="badge badge-blue">{{ profileForm.membershipLabel }}</span>
                      <span class="settings-meta-text">가입일: {{ formatDate(profileForm.joinedAt) }}</span>
                    </div>
                    <p class="settings-meta-copy">
                      JPG, PNG 파일을 업로드하면 백엔드에서 300 x 300px 정사각형 이미지로 변환해 저장합니다.
                    </p>
                    <div class="settings-upload-row">
                      <button
                        type="button"
                        class="settings-upload-btn"
                        :disabled="isUploadingImage"
                        @click="openProfileImagePicker"
                      >
                        <i class="fa-solid fa-arrow-up-from-bracket"></i>
                        <span>{{ isUploadingImage ? "업로드 중..." : "프로필 이미지 업로드" }}</span>
                      </button>
                      <input
                        ref="profileImageInput"
                        type="file"
                        class="settings-hidden-input"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        @change="handleProfileImageChange"
                      />
                    </div>
                    <p v-if="imageFeedback" class="settings-upload-feedback">
                      {{ imageFeedback }}
                    </p>
                  </div>
                </div>
              </section>

              <section class="settings-section">
                <h3 class="settings-section__title">상세 정보</h3>
                <div class="settings-grid settings-grid--two">
                  <label class="settings-field">
                    <span class="settings-field__label">사용자 성함</span>
                    <input
                      v-model="profileForm.displayName"
                      type="text"
                      class="settings-input"
                    />
                  </label>

                  <label class="settings-field">
                    <span class="settings-field__label">직함 / 역할</span>
                    <input
                      :value="profileForm.role"
                      type="text"
                      class="settings-input is-readonly"
                      readonly
                    />
                  </label>

                  <label class="settings-field settings-field--full">
                    <span class="settings-field__label">연락처 (이메일)</span>
                    <div class="settings-email-row">
                      <input
                        :value="profileForm.email"
                        type="email"
                        class="settings-input is-readonly"
                        readonly
                      />
                      <span class="badge" :class="profileForm.emailVerified ? 'badge-green' : 'badge-gray'">
                        {{ profileForm.emailVerified ? '인증됨' : '미인증' }}
                      </span>
                    </div>
                  </label>
                </div>
              </section>

              <section class="settings-section">
                <h3 class="settings-section__title">선호 설정</h3>
                <div class="settings-toggle-list">
                  <label class="settings-toggle">
                    <div>
                      <p class="settings-toggle__title">마케팅 정보 수신</p>
                      <p class="settings-toggle__desc">새로운 기능 및 혜택 정보를 받아봅니다.</p>
                    </div>
                    <input v-model="profileForm.marketingOptIn" type="checkbox" />
                  </label>

                  <label class="settings-toggle">
                    <div>
                      <p class="settings-toggle__title">프로필 비공개</p>
                      <p class="settings-toggle__desc">다른 사용자에게 공개 범위를 제한합니다.</p>
                    </div>
                    <input v-model="profileForm.privateProfile" type="checkbox" />
                  </label>
                </div>
              </section>
            </div>

            <div v-else-if="activeTab === 'security'" class="settings-pane">
              <section class="settings-section">
                <h3 class="settings-section__title">계정 및 보안</h3>
                <div class="settings-card-list">
                  <div class="settings-card">
                    <p class="settings-card__title">로그인 이메일</p>
                    <p class="settings-card__value">{{ profileForm.email }}</p>
                  </div>
                  <div class="settings-card">
                    <p class="settings-card__title">이메일 인증 상태</p>
                    <p class="settings-card__value">{{ profileForm.emailVerified ? "인증 완료" : "인증 필요" }}</p>
                  </div>
                  <div class="settings-card">
                    <p class="settings-card__title">보안 알림</p>
                    <label class="settings-inline-toggle">
                      <span>보안 관련 활동 알림 받기</span>
                      <input v-model="profileForm.securityNotification" type="checkbox" />
                    </label>
                  </div>
                  <div class="settings-card">
                    <p class="settings-card__title">비밀번호 변경</p>
                    <p class="settings-card__subtext">현재는 로그인 계정의 비밀번호 변경 기능을 준비 중입니다.</p>
                  </div>
                </div>
              </section>
            </div>

            <div v-else-if="activeTab === 'notification'" class="settings-pane">
              <section class="settings-section">
                <h3 class="settings-section__title">알림 설정</h3>
                <div class="settings-toggle-list">
                  <label class="settings-toggle">
                    <div>
                      <p class="settings-toggle__title">이메일 알림</p>
                      <p class="settings-toggle__desc">파일 공유, 업로드 상태 등의 이메일 알림을 받습니다.</p>
                    </div>
                    <input v-model="profileForm.emailNotification" type="checkbox" />
                  </label>

                  <label class="settings-toggle">
                    <div>
                      <p class="settings-toggle__title">보안 이벤트 알림</p>
                      <p class="settings-toggle__desc">로그인, 권한 변경 등의 보안 관련 알림을 받습니다.</p>
                    </div>
                    <input v-model="profileForm.securityNotification" type="checkbox" />
                  </label>
                </div>
              </section>
            </div>

            <div v-else-if="activeTab === 'language'" class="settings-pane">
              <section class="settings-section">
                <h3 class="settings-section__title">언어 및 지역</h3>
                <div class="settings-grid settings-grid--two">
                  <label class="settings-field">
                    <span class="settings-field__label">언어</span>
                    <select v-model="profileForm.localeCode" class="settings-input">
                      <option
                        v-for="option in localeOptions"
                        :key="option.code"
                        :value="option.code"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>

                  <label class="settings-field">
                    <span class="settings-field__label">지역</span>
                    <select v-model="profileForm.regionCode" class="settings-input">
                      <option
                        v-for="option in regionOptions"
                        :key="option.code"
                        :value="option.code"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <div v-else-if="activeTab === 'billing'" class="settings-pane">
              <section class="settings-section">
                <h3 class="settings-section__title">현재 플랜 정보</h3>
                <div class="settings-plan-card">
                  <div class="settings-plan-card__header">
                    <div>
                      <p class="settings-plan-card__eyebrow">ACTIVE PLAN</p>
                      <h4 class="settings-plan-card__title">{{ profileForm.storagePlanLabel }}</h4>
                    </div>
                    <span class="badge badge-light">{{ profileForm.membershipLabel }}</span>
                  </div>
                  <p class="settings-plan-card__desc">
                    현재 계정은 {{ profileForm.storagePlanLabel }} 플랜을 사용 중입니다.
                  </p>
                  <RouterLink
                    :to="{ name: 'payment' }"
                    class="settings-plan-card__cta"
                    @click="emit('close')"
                  >
                    플랜 업그레이드
                  </RouterLink>
                </div>
              </section>

              <section class="settings-section">
                <h3 class="settings-section__title">리소스 사용량</h3>
                <div
                  v-if="storageSummary"
                  class="settings-card-list"
                >
                  <div class="settings-card">
                    <div class="settings-storage-head">
                      <span>Cloud Storage</span>
                      <strong>{{ storageSummary.usagePercent }}%</strong>
                    </div>
                    <div class="settings-storage-bar">
                      <div :style="{ width: storageUsageWidth }"></div>
                    </div>
                    <p class="settings-card__subtext">
                      {{ formatBytes(storageSummary.usedBytes) }} / {{ formatBytes(storageSummary.quotaBytes) }} 사용 중
                    </p>
                  </div>

                  <div class="settings-card">
                    <p class="settings-card__title">활성 파일</p>
                    <p class="settings-card__value">{{ storageSummary.activeFileCount }}개</p>
                    <p class="settings-card__subtext">휴지통 제외 기준</p>
                  </div>

                  <div class="settings-card">
                    <p class="settings-card__title">휴지통 사용량</p>
                    <p class="settings-card__value">{{ formatBytes(storageSummary.trashUsedBytes) }}</p>
                    <p class="settings-card__subtext">휴지통 포함 총 용량 집계</p>
                  </div>
                </div>

                <div v-else class="settings-placeholder">
                  저장 공간 통계를 불러오는 중입니다.
                </div>
              </section>
            </div>
          </template>
        </section>
      </div>

      <div class="settings-modal__footer">
        <p v-if="saveError" class="settings-save-error">{{ saveError }}</p>
        <div class="settings-modal__footer-actions">
          <button
            type="button"
            class="settings-secondary-btn"
            @click="emit('close')"
          >
            취소
          </button>
          <button
            type="button"
            class="settings-primary-btn"
            :disabled="isSaving || isLoading || isUploadingImage"
            @click="handleSave"
          >
            {{ isSaving ? "저장 중..." : "모든 변경사항 저장" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
  backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.settings-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.settings-modal {
  display: flex;
  height: min(86vh, 780px);
  width: min(92vw, 1200px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
}

.settings-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  padding: 24px 24px 20px;
}

.settings-modal__title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-modal__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  width: 30px;
  border-radius: 10px;
  background: linear-gradient(135deg, #38bdf8 0%, #60a5fa 100%);
  color: #fff;
}

.settings-modal__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
}

.settings-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 36px;
  border-radius: 999px;
  color: var(--text-muted);
  transition: background-color 0.18s ease, color 0.18s ease;
}

.settings-modal__close:hover {
  background: var(--bg-input);
  color: var(--text-main);
}

.settings-modal__body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.settings-sidebar {
  width: 224px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
  padding: 18px 16px;
}

.settings-sidebar__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border-radius: 16px;
  padding: 12px 14px;
  color: var(--text-secondary);
  font-size: 0.96rem;
  font-weight: 700;
  transition: all 0.18s ease;
}

.settings-sidebar__item:hover {
  background: var(--bg-input);
  color: var(--text-main);
}

.settings-sidebar__item.is-active {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.18);
}

.settings-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 28px 30px 36px;
}

.settings-pane {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.settings-section {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 28px;
}

.settings-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.settings-section__title {
  margin-bottom: 18px;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-secondary);
}

.settings-profile-hero {
  display: flex;
  align-items: center;
  gap: 28px;
}

.settings-avatar-card {
  flex-shrink: 0;
}

.settings-avatar-preview {
  display: flex;
  height: 112px;
  width: 112px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 28px;
  background: linear-gradient(135deg, #4cc9f0 0%, #38bdf8 100%);
  color: white;
  font-size: 3rem;
  font-weight: 700;
  box-shadow: 0 18px 40px rgba(56, 189, 248, 0.26);
}

.settings-avatar-image {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.settings-profile-hero__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.settings-profile-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.settings-meta-text {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.settings-meta-copy {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.settings-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-radius: 16px;
  background: linear-gradient(135deg, #38bdf8 0%, #4cc9f0 100%);
  padding: 12px 16px;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(56, 189, 248, 0.22);
}

.settings-upload-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
}

.settings-hidden-input {
  display: none;
}

.settings-upload-feedback {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--accent);
}

.settings-grid {
  display: grid;
  gap: 22px;
}

.settings-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-field--full {
  grid-column: 1 / -1;
}

.settings-field__label {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-muted);
}

.settings-input {
  width: 100%;
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  color: var(--text-main);
  font-size: 0.96rem;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.settings-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.16);
  background: var(--bg-main);
}

.settings-input.is-readonly {
  cursor: default;
  background: var(--bg-input);
}

.settings-email-row {
  position: relative;
}

.settings-email-row .badge {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}

.settings-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--bg-secondary);
  padding: 18px 20px;
}

.settings-toggle__title {
  font-size: 0.96rem;
  font-weight: 800;
  color: var(--text-main);
}

.settings-toggle__desc {
  margin-top: 4px;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.settings-toggle input,
.settings-inline-toggle input {
  accent-color: #2563eb;
  width: 18px;
  height: 18px;
}

.settings-card-list {
  display: grid;
  gap: 14px;
}

.settings-card {
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--bg-secondary);
  padding: 18px 20px;
}

.settings-card__title {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-muted);
}

.settings-card__value {
  margin-top: 8px;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-main);
}

.settings-card__subtext {
  margin-top: 8px;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.settings-inline-toggle {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 0.92rem;
  color: var(--text-secondary);
}

.settings-plan-card {
  border-radius: 28px;
  background: linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%);
  padding: 26px 28px;
  color: #fff;
  box-shadow: 0 20px 40px rgba(37, 99, 235, 0.18);
}

.settings-plan-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.settings-plan-card__eyebrow {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  opacity: 0.82;
}

.settings-plan-card__title {
  margin-top: 8px;
  font-size: 1.9rem;
  font-weight: 900;
}

.settings-plan-card__desc {
  margin-top: 16px;
  max-width: 32rem;
  font-size: 0.95rem;
  line-height: 1.6;
  opacity: 0.94;
}

.settings-plan-card__cta {
  margin-top: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: #fff;
  padding: 12px 18px;
  color: #2563eb;
  font-size: 0.85rem;
  font-weight: 800;
  text-decoration: none;
}

.settings-storage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--text-main);
}

.settings-storage-bar {
  margin-top: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--border-color);
  height: 10px;
}

.settings-storage-bar > div {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%);
}

.settings-placeholder {
  display: flex;
  min-height: 280px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 20px;
  color: var(--text-muted);
  background: var(--bg-secondary);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.68rem;
  font-weight: 800;
}

.badge-blue {
  background: rgba(59, 130, 246, 0.14);
  color: #2563eb;
}

.badge-green {
  background: rgba(34, 197, 94, 0.16);
  color: #16a34a;
}

.badge-gray {
  background: var(--bg-input);
  color: var(--text-muted);
}

.badge-light {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.settings-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--border-color);
  padding: 20px 24px;
  background: var(--bg-elevated);
}

.settings-save-error {
  color: #ef4444;
  font-size: 0.9rem;
  font-weight: 700;
}

.settings-modal__footer-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-secondary-btn {
  padding: 12px 18px;
  color: var(--text-secondary);
  font-size: 0.92rem;
  font-weight: 700;
}

.settings-secondary-btn:hover {
  background: var(--bg-input);
}

.settings-primary-btn {
  border-radius: 16px;
  background: linear-gradient(135deg, #38bdf8 0%, #4cc9f0 100%);
  padding: 12px 22px;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 800;
  box-shadow: 0 14px 28px rgba(56, 189, 248, 0.22);
}

.settings-primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  box-shadow: none;
}

@media (max-width: 980px) {
  .settings-modal {
    height: min(92vh, 860px);
  }

  .settings-modal__body {
    flex-direction: column;
  }

  .settings-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    overflow-x: auto;
    gap: 10px;
  }

  .settings-sidebar__item {
    min-width: max-content;
  }

  .settings-grid--two {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .settings-modal {
    width: calc(100vw - 24px);
    border-radius: 24px;
  }

  .settings-content {
    padding: 22px 18px 28px;
  }

  .settings-profile-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-modal__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-modal__footer-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
