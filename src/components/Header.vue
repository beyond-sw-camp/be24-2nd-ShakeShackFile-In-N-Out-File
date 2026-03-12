<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchSettingsProfile } from "@/api/featerApi";
import ProfileModal from "./ProfileModal.vue";

const emit = defineEmits(["toggle-chat", "toggle-theme", "switch-view"]);
const router = useRouter();
const authStore = useAuthStore();

const showNotifDropdown = ref(false);
const showProfileDropdown = ref(false);
const isProfileModalOpen = ref(false);
const isDarkMode = ref(false);
const themeIcon = ref("fa-solid fa-moon");
const settingsTab = ref("profile");
const settingsProfile = ref(null);
const isSettingsLoading = ref(false);

const userName = computed(() => {
  return settingsProfile.value?.displayName || authStore.user?.userName || authStore.user?.name || "사용자";
});

const userEmail = computed(() => {
  return settingsProfile.value?.email || authStore.user?.email || authStore.user?.userEmail || "이메일 정보 없음";
});

const userLocaleLabel = computed(() => settingsProfile.value?.localeCode || "KO");
const membershipLabel = computed(() => settingsProfile.value?.membershipLabel || "FREE MEMBER");
const userProfileImage = computed(() => settingsProfile.value?.profileImageUrl || "");

const avatarInitials = computed(() => {
  const source = userName.value || "사용자";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("") || "U";
});

const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    isDarkMode.value = true;
    themeIcon.value = "fa-solid fa-sun";
    document.documentElement.classList.add("dark");
  } else {
    isDarkMode.value = false;
    themeIcon.value = "fa-solid fa-moon";
    document.documentElement.classList.remove("dark");
  }
};

const loadSettingsProfile = async () => {
  isSettingsLoading.value = true;

  try {
    settingsProfile.value = await fetchSettingsProfile();
  } catch {
    settingsProfile.value = null;
  } finally {
    isSettingsLoading.value = false;
  }
};

onMounted(() => {
  initTheme();
  authStore.checkLogin();
  loadSettingsProfile();
  document.addEventListener("click", handleClickOutside);
});

const toggleNotifMenu = () => {
  showNotifDropdown.value = !showNotifDropdown.value;
  showProfileDropdown.value = false;
};

const toggleProfileMenu = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
  showNotifDropdown.value = false;
};

const handleToggleTheme = () => {
  isDarkMode.value = !isDarkMode.value;

  if (isDarkMode.value) {
    themeIcon.value = "fa-solid fa-sun";
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    themeIcon.value = "fa-solid fa-moon";
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }

  emit("toggle-theme", isDarkMode.value);
};

const openSettings = async (tab = "profile") => {
  settingsTab.value = tab;
  showProfileDropdown.value = false;
  isProfileModalOpen.value = true;
  await loadSettingsProfile();
};

const handleCloseProfileModal = () => {
  isProfileModalOpen.value = false;
};

const handleSavedProfile = (savedProfile) => {
  settingsProfile.value = savedProfile;
};

const handleLogout = () => {
  if (confirm("로그아웃 하시겠습니까?")) {
    authStore.logout();
    router.push("/login");
  }
};

const handleToggleChat = () => {
  emit("toggle-chat");
};

const handleClickOutside = (event) => {
  if (!event.target.closest("#profile-container") && !event.target.closest("#notif-container")) {
    showNotifDropdown.value = false;
    showProfileDropdown.value = false;
  }
};

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div>
    <ProfileModal
      :is-open="isProfileModalOpen"
      :initial-tab="settingsTab"
      :settings-profile="settingsProfile"
      :is-loading="isSettingsLoading"
      @close="handleCloseProfileModal"
      @saved="handleSavedProfile"
    />

    <header class="header-container">
      <div class="header-search-wrap">
        <input type="text" placeholder="파일, 폴더, 사람 검색" class="search-input" />
        <span class="search-icon">
          <i class="fa-solid fa-search"></i>
        </span>
      </div>

      <div class="header-actions">
        <div class="relative" id="notif-container">
          <button @click="toggleNotifMenu" class="icon-button bell-button">
            <i class="fa-solid fa-bell"></i>
          </button>

          <div v-if="showNotifDropdown" class="dropdown-container active">
            <div class="dropdown-header">
              <p class="dropdown-header__label">알림</p>
            </div>
            <div class="py-2">
              <div class="dropdown-item">
                <span class="dropdown-muted">새로운 알림이 없습니다</span>
              </div>
            </div>
          </div>
        </div>

        <button
          @click="handleToggleTheme"
          class="icon-button theme-button"
          :title="isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'"
        >
          <i :class="themeIcon" class="theme-icon"></i>
        </button>

        <button @click="handleToggleChat" class="icon-button chat-button" title="협업채팅">
          <i class="fa-solid fa-comments"></i>
        </button>

        <div class="relative" id="profile-container">
          <button @click="toggleProfileMenu" class="profile-trigger">
            <div class="profile-trigger__copy">
              <p class="profile-trigger__name">{{ userName }}</p>
              <p class="profile-trigger__plan">{{ membershipLabel }}</p>
            </div>
            <div class="profile-trigger__avatar">
              <img
                v-if="userProfileImage"
                :src="userProfileImage"
                :alt="userName"
                class="profile-trigger__avatar-image"
              />
              <span v-else>{{ avatarInitials }}</span>
            </div>
          </button>

          <div v-if="showProfileDropdown" class="dropdown-container active profile-dropdown">
            <div class="dropdown-header">
              <p class="dropdown-header__label">로그인 계정</p>
              <p class="dropdown-header__email">{{ userEmail }}</p>
            </div>

            <div class="py-2">
              <button type="button" class="dropdown-item" @click="openSettings('profile')">
                <i class="fa-solid fa-user-gear"></i>
                <span>개인 프로필 설정</span>
              </button>
              <button type="button" class="dropdown-item" @click="openSettings('security')">
                <i class="fa-solid fa-shield-halved"></i>
                <span>보안 및 비밀번호</span>
              </button>
              <button type="button" class="dropdown-item" @click="openSettings('language')">
                <i class="fa-solid fa-language"></i>
                <span>언어 설정 ({{ userLocaleLabel }})</span>
              </button>
            </div>

            <div class="dropdown-footer">
              <button type="button" class="dropdown-item logout-item" @click="handleLogout">
                <i class="fa-solid fa-right-from-bracket"></i>
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  </div>
</template>

<style scoped>
.header-container {
  min-height: 4rem;
  background-color: var(--bg-main);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 clamp(1rem, 2vw, 2rem);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.header-search-wrap {
  position: relative;
  flex: 1 1 22rem;
  max-width: min(42rem, 55vw);
  min-width: 0;
}

.search-input {
  width: 100%;
  background-color: var(--bg-input);
  border: none;
  border-radius: 1rem;
  padding: 0.7rem 1rem 0.7rem 3rem;
  outline: none;
  font-size: 0.875rem;
  color: var(--text-main);
  transition: all 0.2s ease;
}

.search-input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  background-color: var(--bg-main);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 0.78rem;
  opacity: 0.45;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: clamp(0.65rem, 1vw, 1.1rem);
  margin-left: auto;
  min-width: max-content;
}

.icon-button {
  color: var(--text-muted);
  transition: color 0.2s ease, background-color 0.2s ease;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.75rem;
  position: relative;
}

@keyframes bell-swing {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(14deg); }
  30% { transform: rotate(-10deg); }
  45% { transform: rotate(7deg); }
  60% { transform: rotate(-5deg); }
  75% { transform: rotate(2deg); }
}

.bell-button:hover,
.theme-button:hover,
.chat-button:hover {
  background-color: var(--bg-input);
  color: var(--text-main);
}

.bell-button:hover i {
  animation: bell-swing 0.7s ease-in-out infinite;
  transform-origin: top center;
}

.theme-icon {
  transition: transform 0.2s ease;
}

.theme-button:hover .theme-icon {
  transform: scale(1.08);
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-radius: 1rem;
  padding: 0.25rem 0.35rem 0.25rem 0.6rem;
  transition: background-color 0.18s ease;
  max-width: min(18rem, 32vw);
}

.profile-trigger:hover {
  background: var(--bg-input);
}

.profile-trigger__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
}

.profile-trigger__name {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-main);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-trigger__plan {
  margin-top: 0.1rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #44dff4;
  text-transform: uppercase;
}

.profile-trigger__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.9rem;
  background: linear-gradient(135deg, #190094 0%, #2b16c8 100%);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 900;
  border: 2px solid rgba(68, 223, 244, 0.65);
  box-shadow: 0 12px 22px rgba(25, 0, 148, 0.14);
}

.profile-trigger__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dropdown-container {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 248px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  box-shadow: var(--shadow-lg);
  z-index: 50;
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  transition: all 0.18s ease;
}

.dropdown-container.active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.dropdown-header {
  padding: 1rem 1.1rem;
  border-bottom: 1px solid var(--border-color);
}

.dropdown-header__label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-muted);
}

.dropdown-header__email {
  margin-top: 0.4rem;
  font-size: 1.02rem;
  font-weight: 900;
  color: var(--text-main);
  word-break: break-all;
}

.dropdown-item {
  width: 100%;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease;
  color: var(--text-main);
  font-size: 0.98rem;
  font-weight: 700;
  text-align: left;
}

.dropdown-item:hover {
  background: var(--bg-input);
}

.dropdown-item i {
  width: 18px;
  text-align: center;
  color: var(--text-muted);
}

.dropdown-muted {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.dropdown-footer {
  border-top: 1px solid var(--border-color);
  padding: 0.35rem 0;
}

.logout-item {
  color: var(--text-main);
}

.logout-item i {
  color: inherit;
}

@media (max-width: 1080px) {
  .header-search-wrap {
    max-width: min(32rem, 48vw);
  }
}

@media (max-width: 900px) {
  .header-container {
    padding: 0 1rem;
  }

  .profile-trigger__copy {
    display: none;
  }

  .profile-trigger {
    max-width: none;
  }
}

@media (max-width: 720px) {
  .header-container {
    flex-wrap: wrap;
    align-items: center;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .header-search-wrap {
    order: 2;
    flex-basis: 100%;
    max-width: 100%;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
