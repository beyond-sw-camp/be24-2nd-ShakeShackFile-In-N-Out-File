<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchSettingsProfile } from "@/api/featerApi";
import loadpost from "./workspace/loadpost";
import { EventSourcePolyfill } from 'event-source-polyfill';
import {
  FILE_SIZE_OPTIONS,
  FILE_STATUS_OPTIONS,
  getFileSearchScope,
  isFileSearchRoute,
  useHeaderSearchStore,
} from "@/stores/useHeaderSearchStore";
import {
  acceptGroupInvite,
  acceptRelationshipInvite,
  rejectGroupInvite,
  rejectRelationshipInvite,
} from "@/api/groupApi";
import { registerPushNotification } from "@/utils/pushNotification";
import ProfileModal from "./ProfileModal.vue";
import postApi from "@/api/postApi";

const emit = defineEmits(["toggle-chat", "toggle-theme", "switch-view"]);

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const headerSearchStore = useHeaderSearchStore();

const showNotifDropdown = ref(false);
const showProfileDropdown = ref(false);
const showSearchDropdown = ref(false);
const isProfileModalOpen = ref(false);

const notifications = ref([]);
const hasNewNotif = ref(false);

let broadcastChannel = null;
let sseEventSource = null;

const isDarkMode = ref(false);
const themeIcon = ref("fa-solid fa-moon");
const settingsTab = ref("profile");
const settingsProfile = ref(null);
const isSettingsLoading = ref(false);

const searchScope = computed(() => getFileSearchScope(route.name));
const canUseFileSearch = computed(() => isFileSearchRoute(route.name));
const searchState = computed(() => headerSearchStore.getScopeState(searchScope.value || "global"));
const extensionOptions = computed(() => searchState.value.availableExtensions || []);

const customSizeRangeLabel = computed(() => {
  if (searchState.value.sizeFilter !== "custom") return "";

  const min = searchState.value.customMinSize?.trim();
  const max = searchState.value.customMaxSize?.trim();

  if (!min && !max) return "\uBC94\uC704\uB97C \uC785\uB825\uD558\uC138\uC694";
  if (min && max) return `${min}MB ~ ${max}MB`;
  if (min) return `${min}MB \uC774\uC0C1`;
  return `${max}MB \uC774\uD558`;
});

const activeSearchFilterCount = computed(() => {
  if (!canUseFileSearch.value) return 0;

  let count = 0;
  if (searchState.value.searchQuery.trim()) count += 1;
  if (searchState.value.extensionFilter !== "all") count += 1;
  if (searchState.value.sizeFilter !== "all") count += 1;
  if (searchState.value.statusFilter !== "all") count += 1;

  return count;
});

const searchPlaceholder = computed(() => (
  canUseFileSearch.value
    ? "\uD30C\uC77C\uBA85, \uD655\uC7A5\uC790, \uACF5\uC720\uC790 \uC774\uBA54\uC77C\uC744 \uAC80\uC0C9\uD558\uC138\uC694"
    : "\uD30C\uC77C \uAC80\uC0C9\uC740 \uB4DC\uB77C\uC774\uBE0C \uD654\uBA74\uC5D0\uC11C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
));

const userName = computed(() => (
  settingsProfile.value?.displayName ||
  authStore.user?.userName ||
  authStore.user?.name ||
  "\uC0AC\uC6A9\uC790"
));

const userEmail = computed(() => (
  settingsProfile.value?.email ||
  authStore.user?.email ||
  authStore.user?.userEmail ||
  "\uC774\uBA54\uC77C \uC815\uBCF4 \uC5C6\uC74C"
));

const userLocaleLabel = computed(() => settingsProfile.value?.localeCode || "KO");
const membershipLabel = computed(() => settingsProfile.value?.membershipLabel || "FREE MEMBER");
const userProfileImage = computed(() => settingsProfile.value?.profileImageUrl || "");
const avatarInitials = computed(() => (
  (userName.value || "\uC0AC\uC6A9\uC790")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("") || "U"
));

const updateNotifBadge = () => {
  hasNewNotif.value = notifications.value.some((notification) => !notification.read);
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "\uBC29\uAE08 \uC804";

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "\uBC29\uAE08 \uC804";

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "\uBC29\uAE08 \uC804";
  if (minutes < 60) return `${minutes}\uBD84 \uC804`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}\uC2DC\uAC04 \uC804`;

  return `${Math.floor(hours / 24)}\uC77C \uC804`;
};

const toNotificationItem = (item = {}) => {
  const rawType = item.type ?? "general";
  const isChat = rawType === "message" || rawType === "NEW_MESSAGE";
  const type = isChat ? "chat" : rawType;
  const read = Boolean(item.read);
  const actionableTypes = ["invite", "group_invite", "relationship_invite"];
  const processed = actionableTypes.includes(type) && read;

  return {
    id: item.notificationId ?? item.idx ?? item.id ?? Date.now(),
    uuid: item.uuid ?? null,
    referenceId: item.referenceId ?? null,
    // 백엔드/SSE 페이로드 키가 버전마다 다를 수 있어 방 인덱스 매핑을 유연하게 처리
    roomIdx: item.roomIdx ?? item.roomId ?? item.chatRoomIdx ?? item.referenceId ?? null,
    type,
    title: item.title ?? (isChat ? "\uc0c8 \ucc44\ud305 \uba54\uc2dc\uc9c0" : "\uc54c\ub9bc"),
    message: item.message ?? item.contents ?? item.lastMsg ?? "",
    createdAt: item.createdAt ?? null,
    time: item.createdAt ? formatRelativeTime(item.createdAt) : "\uBC29\uAE08 \uC804",
    read,
    unreadCount: isChat ? (item.unreadCount ?? 1) : 0,
    processed,
    processedLabel: processed ? "이미 확인하셨습니다" : "",
  };
};

const findNotificationIndex = (target) => notifications.value.findIndex((item) => {
  if (target.type === "chat" && item.type === "chat") {
    if (target.roomIdx != null && item.roomIdx != null) return target.roomIdx === item.roomIdx;
    return target.title === item.title;
  }
  return (
    (target.id != null && item.id === target.id) ||
    (target.uuid && item.uuid === target.uuid)
  );
});

const fetchNotifications = async () => {
  if (!authStore.user?.idx) {
    notifications.value = [];
    updateNotifBadge();
    return;
  }

  try {
    const response = await postApi.getNotifications();
    const items = Array.isArray(response?.result?.body) ? response.result.body : [];
    const mapped = items.map(toNotificationItem);
    const seen = new Map();
    const grouped = [];
    for (const notif of mapped) {
      if (notif.type === "chat") {
        const key = notif.roomIdx != null ? `room_${notif.roomIdx}` : `title_${notif.title}`;
        if (seen.has(key)) {
          const existing = grouped[seen.get(key)];
          if (!notif.read) existing.unreadCount = (existing.unreadCount ?? 0) + 1;
        } else {
          seen.set(key, grouped.length);
          notif.unreadCount = notif.read ? 0 : 1;
          grouped.push(notif);
        }
      } else {
        grouped.push(notif);
      }
    }
    notifications.value = grouped;
    updateNotifBadge();
  } catch (error) {
    console.error("\uC54C\uB9BC \uBAA9\uB85D \uBD88\uB7EC\uC624\uAE30 \uC2E4\uD328:", error);
  }
};

const pushNewNotification = (data) => {
  if (!data) return;
  const allowed = ["invite", "general", "group_invite", "relationship_invite", "message", "NEW_MESSAGE"];
  if (data.type && !allowed.includes(data.type)) return;

  const incoming = toNotificationItem({ ...data, read: false });

  const existingIndex = findNotificationIndex(incoming);
  if (existingIndex >= 0) {
    const previous = notifications.value[existingIndex];
    if (incoming.type === "chat") {
      const prevUnread = previous.unreadCount ?? 0;
      notifications.value.splice(existingIndex, 1);
      notifications.value.unshift({
        ...incoming,
        id: previous.id,
        unreadCount: data.unreadCount ?? (prevUnread + 1),
      });
    } else {
      notifications.value[existingIndex] = {
        ...previous,
        ...incoming,
        processed: previous.processed,
        processedLabel: previous.processedLabel,
      };
    }
  } else {
    notifications.value.unshift(incoming);
  }

  updateNotifBadge();
};

const markNotificationAsRead = async (notification) => {
  if (!notification?.id && !notification?.uuid) return;

  try {
    await postApi.markNotificationAsRead({
      id: notification.id ?? null,
      uuid: notification.uuid ?? null,
    });
  } catch (error) {
    console.error("\uC54C\uB9BC \uC77D\uC74C \uCC98\uB9AC \uC2E4\uD328:", error);
  }
};

const applyProcessedState = async (notification, label) => {
  const index = findNotificationIndex(notification);
  if (index < 0) return;

  notifications.value[index] = {
    ...notifications.value[index],
    read: true,
    processed: true,
    processedLabel: label,
  };
  updateNotifBadge();

  await markNotificationAsRead(notifications.value[index]);
};

const getErrorMessage = (error) => {
  if (typeof error?.response?.data === "string" && error.response.data.trim()) {
    return error.response.data;
  }

  if (typeof error?.response?.data?.message === "string" && error.response.data.message.trim()) {
    return error.response.data.message;
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return "";
};

const handleInviteVerify = async (notification, type) => {
  if (!notification.uuid || notification.processed) return;

  try {
    await postApi.verifyEmail(notification.uuid, type);
    await applyProcessedState(notification, type === "accept" ? "\uC218\uB77D\uB428" : "\uAC70\uC808\uB428");
    await fetchNotifications();
    await loadpost.side_list();
  } catch (error) {
    const message = getErrorMessage(error);

    if (type === "reject" && (error?.response?.status === 500 || message.includes("\uAC70\uC808"))) {
      await applyProcessedState(notification, "\uAC70\uC808\uB428");
      await fetchNotifications();
      return;
    }

    console.error(type === "accept" ? "\uCD08\uB300 \uC218\uB77D \uC2E4\uD328:" : "\uCD08\uB300 \uAC70\uC808 \uC2E4\uD328:", error);
    await fetchNotifications();

    if (type === "accept" && message.includes("\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070")) {
      alert("\uC774\uBBF8 \uCC98\uB9AC\uB418\uC5C8\uAC70\uB098 \uB9CC\uB8CC\uB41C \uCD08\uB300\uC785\uB2C8\uB2E4.");
      return;
    }

    alert(message || (type === "accept" ? "\uCD08\uB300 \uC218\uB77D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." : "\uCD08\uB300 \uAC70\uC808\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."));
  }
};

const handleGroupInviteAction = async (notification, type) => {
  if (!notification.referenceId || notification.processed) return;

  try {
    if (type === "accept") {
      await acceptGroupInvite(notification.referenceId);
    } else {
      await rejectGroupInvite(notification.referenceId);
    }

    await applyProcessedState(notification, type === "accept" ? "\uC218\uB77D\uB428" : "\uAC70\uC808\uB428");
    await fetchNotifications();
  } catch (error) {
    console.error(type === "accept" ? "그룹 초대 수락 실패:" : "그룹 초대 거절 실패:", error);
    await fetchNotifications();
    alert(getErrorMessage(error) || (type === "accept" ? "그룹 초대 수락에 실패했습니다." : "그룹 초대 거절에 실패했습니다."));
  }
};

const handleRelationshipInviteAction = async (notification, type) => {
  if (!notification.referenceId || notification.processed) return;

  try {
    if (type === "accept") {
      await acceptRelationshipInvite(notification.referenceId);
    } else {
      await rejectRelationshipInvite(notification.referenceId);
    }

    await applyProcessedState(notification, type === "accept" ? "\uC218\uB77D\uB428" : "\uAC70\uC808\uB428");
    await fetchNotifications();
  } catch (error) {
    console.error(type === "accept" ? "연결 초대 수락 실패:" : "연결 초대 거절 실패:", error);
    await fetchNotifications();
    alert(getErrorMessage(error) || (type === "accept" ? "연결 초대 수락에 실패했습니다." : "연결 초대 거절에 실패했습니다."));
  }
};

const handleNotificationAction = async (notification, type) => {
  if (notification.type === "invite") {
    await handleInviteVerify(notification, type);
    return;
  }

  if (notification.type === "group_invite") {
    await handleGroupInviteAction(notification, type);
    return;
  }

  if (notification.type === "relationship_invite") {
    await handleRelationshipInviteAction(notification, type);
  }
};

const handleNotificationClick = async (notification) => {
  if (notification.type !== "chat") return;

  if (!notification.read) {
    notification.read = true;
    notification.unreadCount = 0;
    updateNotifBadge();
    await markNotificationAsRead(notification);
  }

  showNotifDropdown.value = false;

  // Chat.vue에 채팅 패널 열고 해당 방 선택 요청
  window.dispatchEvent(new CustomEvent("open-chat-room", {
    detail: { roomIdx: notification.roomIdx, roomTitle: notification.title }
  }));
};

const handleDeleteNotification = async (notification) => {
  try {
    if (notification?.id || notification?.uuid) {
      await postApi.deleteNotification({
        id: notification.id ?? null,
        uuid: notification.uuid ?? null,
      });
    }

    notifications.value = notifications.value.filter((item) => (
      !(notification.id != null && item.id === notification.id) &&
      !(notification.uuid && item.uuid === notification.uuid)
    ));
    updateNotifBadge();
  } catch (error) {
    console.error("\uC54C\uB9BC \uC0AD\uC81C \uC2E4\uD328:", error);
    alert("\uC54C\uB9BC \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const swDirectMessageHandler = (event) => {
  const data = event.data;
  if (!data) return;

  if (data.channel === "notification" && data.payload) {
    pushNewNotification(data.payload);
    return;
  }

  if (data.type === "NEW_MESSAGE") {
    pushNewNotification({ ...data, type: data.notifType ?? "message" });
    return;
  }

  if (["invite", "general", "group_invite", "relationship_invite", "message"].includes(data.type)) {
    pushNewNotification(data);
  }
};

const setupNotificationChannel = () => {
  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel("notif_channel");
    broadcastChannel.onmessage = (event) => {
      pushNewNotification(event.data);
    };
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", swDirectMessageHandler);
  }
};

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

const toggleNotifMenu = async () => {
  showNotifDropdown.value = !showNotifDropdown.value;
  showProfileDropdown.value = false;
  showSearchDropdown.value = false;

  if (showNotifDropdown.value) {
    await fetchNotifications();
  }
};

const toggleProfileMenu = () => {
  showProfileDropdown.value = !showProfileDropdown.value;
  showNotifDropdown.value = false;
  showSearchDropdown.value = false;
};

const toggleSearchMenu = () => {
  if (!canUseFileSearch.value) return;
  showSearchDropdown.value = !showSearchDropdown.value;
  showNotifDropdown.value = false;
  showProfileDropdown.value = false;
};

const resetSearchFilters = () => {
  if (!searchScope.value) return;
  headerSearchStore.resetScope(searchScope.value);
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

const handleLogout = async () => {
  if (confirm("\uB85C\uADF8\uC544\uC6C3 \uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) {
    await authStore.logout();
    router.push("/login");
  }
};

const handleToggleChat = () => emit("toggle-chat");

const handleClickOutside = (event) => {
  if (!event.target.closest("#profile-container")) showProfileDropdown.value = false;
  if (!event.target.closest("#notif-container")) showNotifDropdown.value = false;
  if (!event.target.closest("#header-search-container")) showSearchDropdown.value = false;
};

const stopSse = () => {
  if (sseEventSource) {
    sseEventSource.close();
    sseEventSource = null;
  }
};

const startSse = () => {
  stopSse();
  const token = localStorage.getItem('ACCESS_TOKEN');
  sseEventSource = new EventSourcePolyfill("http://localhost:8080/sse/connect", {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    withCredentials: true
  });

  // 알림 (invite, group_invite, relationship_invite, general)
  sseEventSource.addEventListener("notification", (e) => {
    try {
      const payload = JSON.parse(e.data);
      pushNewNotification(payload);
    } catch {}
  });

  // 채팅 메시지 알림
  sseEventSource.addEventListener("new-message", (e) => {
    try {
      const payload = JSON.parse(e.data);
      pushNewNotification(payload);
      // Chat.vue에도 채팅목록 갱신 참참시
      window.dispatchEvent(new CustomEvent("sse-new-message", { detail: payload }));
    } catch {}
  });

  sseEventSource.onerror = () => {
    stopSse();
    // 재연결 (5초 후)
    if (authStore.user?.idx) {
      setTimeout(() => startSse(), 5000);
    }
  };
};

watch(() => route.fullPath, () => {
  showSearchDropdown.value = false;
});

watch(
  () => authStore.user?.idx,
  async (userIdx) => {
    if (!userIdx) {
      stopSse();
      notifications.value = [];
      updateNotifBadge();
      return;
    }

    await fetchNotifications();
    startSse();

    try {
      await registerPushNotification();
    } catch (error) {
      console.error("\uC54C\uB9BC \uAD6C\uB3C5 \uC2E4\uD328:", error);
    }
  },
  { immediate: true },
);

onMounted(() => {
  initTheme();
  authStore.checkLogin();
  loadSettingsProfile();
  setupNotificationChannel();
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.removeEventListener("message", swDirectMessageHandler);
  }
  stopSse();
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
      <div class="header-search-wrap" id="header-search-container">
        <span class="search-icon"><i class="fa-solid fa-search"></i></span>
        <input v-model="searchState.searchQuery" type="search" :disabled="!canUseFileSearch" :placeholder="searchPlaceholder" class="search-input" />
        <button type="button" class="search-filter-button" :class="{ 'is-active': showSearchDropdown, 'has-filters': activeSearchFilterCount > 0 }" :disabled="!canUseFileSearch" @click="toggleSearchMenu">
          <i class="fa-solid fa-sliders"></i>
          <span>속성</span>
          <span v-if="activeSearchFilterCount > 0" class="search-filter-count">{{ activeSearchFilterCount }}</span>
        </button>

        <div v-if="canUseFileSearch && showSearchDropdown" class="search-dropdown">
          <div class="search-dropdown__header">
            <div>
              <p class="search-dropdown__eyebrow">상세 검색</p>
              <p class="search-dropdown__description">확장자, 상태, 크기 조건을 현재 화면에 바로 적용합니다.</p>
            </div>
            <button v-if="activeSearchFilterCount > 0" type="button" class="search-dropdown__reset" @click="resetSearchFilters">조건 초기화</button>
          </div>

          <div class="search-dropdown__grid">
            <label class="search-field">
              <span class="search-field__label">확장자</span>
              <select v-model="searchState.extensionFilter" class="search-field__control">
                <option value="all">전체</option>
                <option v-for="extension in extensionOptions" :key="extension" :value="extension">{{ extension.toUpperCase() }}</option>
              </select>
            </label>
            <label class="search-field">
              <span class="search-field__label">상태</span>
              <select v-model="searchState.statusFilter" class="search-field__control">
                <option v-for="option in FILE_STATUS_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <label class="search-field">
              <span class="search-field__label">크기</span>
              <select v-model="searchState.sizeFilter" class="search-field__control">
                <option v-for="option in FILE_SIZE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
          </div>

          <div v-if="searchState.sizeFilter === 'custom'" class="search-dropdown__grid search-dropdown__grid--custom">
            <label class="search-field">
              <span class="search-field__label">최소 크기 (MB)</span>
              <input v-model="searchState.customMinSize" type="number" min="0" class="search-field__control" placeholder="예: 50" />
            </label>
            <label class="search-field">
              <span class="search-field__label">최대 크기 (MB)</span>
              <input v-model="searchState.customMaxSize" type="number" min="0" class="search-field__control" placeholder="예: 500" />
            </label>
            <div class="search-field search-field--hint">
              <span class="search-field__label">적용 범위</span>
              <p class="search-field__hint">{{ customSizeRangeLabel }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <div class="relative" id="notif-container">
          <button @click="toggleNotifMenu" class="icon-button bell-button">
            <i class="fa-solid fa-bell"></i>
            <span v-if="hasNewNotif" class="notif-badge"></span>
          </button>

          <div v-if="showNotifDropdown" class="dropdown-container active">
            <div class="dropdown-header">
              <p class="dropdown-header__label">알림</p>
            </div>
            <div class="py-2 max-h-64 overflow-y-auto">
              <template v-if="notifications.length > 0">
                <!--
                  클래스 우선순위:
                    notif-processed  → 수락/거절 완료 (가장 어둡게)
                    notif-read       → 읽었지만 미처리 (약하게 흐리게)
                    notif-unread     → 아직 읽지 않음 (파란 강조)
                -->
                <div
                  v-for="n in notifications"
                  :key="n.id"
                  class="notification-item"
                  :class="{
                    'notif-processed': n.processed,
                    'notif-read':      n.read && !n.processed,
                    'notif-unread':    !n.read && !n.processed,
                    'cursor-pointer':  n.type === 'chat',
                  }"
                  @click="handleNotificationClick(n)"
                >
                  <div class="notification-item__top">
                    <div class="flex flex-col gap-1">
                      <div class="notif-title-row">
                        <p class="notif-title">{{ n.title }}</p>
                        <span v-if="n.type === 'chat' && !n.read && n.unreadCount > 0" class="notif-unread-count">{{ n.unreadCount > 99 ? '99+' : n.unreadCount }}</span>
                        <span v-else-if="n.read && !n.processed" class="notif-read-badge">읽음</span>
                      </div>
                      <p class="notif-message">{{ n.message }}</p>
                      <span class="notif-time">{{ n.time }}</span>
                    </div>
                    <button type="button" class="notif-delete-button" @click.stop="handleDeleteNotification(n)" aria-label="알림 삭제">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                  <div v-if="['invite', 'group_invite', 'relationship_invite'].includes(n.type)" class="notif-actions">
                    <template v-if="!n.processed">
                      <button type="button" class="notif-btn notif-btn--accept" @click.stop="handleNotificationAction(n, 'accept')">수락</button>
                      <button type="button" class="notif-btn notif-btn--reject" @click.stop="handleNotificationAction(n, 'reject')">거절</button>
                    </template>
                    <span v-else class="notif-processed-label">{{ n.processedLabel }}</span>
                  </div>
                </div>
              </template>
              <div v-else class="dropdown-item">
                <span class="dropdown-muted">새로운 알림이 없습니다</span>
              </div>
            </div>
          </div>
        </div>

        <button @click="handleToggleTheme" class="icon-button theme-button" :title="isDarkMode ? '라이트 모드로 변경' : '다크 모드로 변경'"><i :class="themeIcon" class="theme-icon"></i></button>
        <button @click="handleToggleChat" class="icon-button chat-button" title="작업 채팅"><i class="fa-solid fa-comments"></i></button>

        <div class="relative" id="profile-container">
          <button @click="toggleProfileMenu" class="profile-trigger">
            <div class="profile-trigger__copy">
              <p class="profile-trigger__name">{{ userName }}</p>
              <p class="profile-trigger__plan">{{ membershipLabel }}</p>
            </div>
            <div class="profile-trigger__avatar">
              <img v-if="userProfileImage" :src="userProfileImage" :alt="userName" class="profile-trigger__avatar-image" />
              <span v-else>{{ avatarInitials }}</span>
            </div>
          </button>

          <div v-if="showProfileDropdown" class="dropdown-container active profile-dropdown">
            <div class="dropdown-header">
              <p class="dropdown-header__label">로그인 계정</p>
              <p class="dropdown-header__email">{{ userEmail }}</p>
            </div>
            <div class="py-2">
              <button type="button" class="dropdown-item" @click="openSettings('profile')"><i class="fa-solid fa-user-gear"></i><span>개인 프로필 설정</span></button>
              <button type="button" class="dropdown-item" @click="openSettings('group')"><i class="fa-solid fa-user-group"></i><span>그룹 관리</span></button>
              <button type="button" class="dropdown-item" @click="openSettings('security')"><i class="fa-solid fa-shield-halved"></i><span>보안 및 비밀번호</span></button>
              <button type="button" class="dropdown-item" @click="openSettings('language')"><i class="fa-solid fa-language"></i><span>언어 설정 ({{ userLocaleLabel }})</span></button>
            </div>
            <div class="dropdown-footer">
              <button type="button" class="dropdown-item logout-item" @click="handleLogout"><i class="fa-solid fa-right-from-bracket"></i><span>로그아웃</span></button>
            </div>
          </div>
        </div>
      </div>
    </header>
  </div>
</template>


<style scoped>
/* 제공해주신 기존 스타일을 그대로 유지합니다 */
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

.notif-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background-color: #ff4d4f;
  border-radius: 50%;
  border: 1.5px solid var(--bg-main);
}

.notification-item {
  padding: 0.8rem 1.1rem;
  border-bottom: 1px solid var(--border-color);
  cursor: default;
  transition: background-color 0.15s ease, opacity 0.15s ease;
  border-left: 3px solid transparent; /* 기본: 투명 테두리 (레이아웃 고정) */
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

/* 읽지 않은 알림: 파란 강조 */
.notif-unread {
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-elevated) 93%);
  border-left-color: var(--accent);
}

/* ★ [이슈2] 읽은 알림: 살짝 흐리게 */
.notif-read {
  opacity: 0.65;
  border-left-color: transparent;
}

/* 수락/거절 처리된 알림: 더 어둡게 + 흑백 */
.notif-processed {
  opacity: 0.4;
  filter: grayscale(50%);
  border-left-color: transparent;
}

/* ★ 제목 행: 제목 + 읽음 뱃지 가로 배치 */
.notif-title-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

/* ★ [이슈2] 읽음 뱃지 */
.notif-read-badge {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.notif-unread-count {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: var(--accent, #2563eb);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0 0.32rem;
  line-height: 1;
}

.notif-delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.notif-delete-button:hover {
  background: var(--bg-input);
  color: var(--text-main);
}

.notif-actions {
  display: flex;
  gap: 0.45rem;
  margin-top: 0.55rem;
  align-items: center;
}

.notif-btn {
  flex: 1;
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.notif-btn--accept {
  background: color-mix(in srgb, #22c55e 16%, transparent);
  color: #16a34a;
  border: 1px solid color-mix(in srgb, #22c55e 30%, transparent);
}

.notif-btn--accept:hover {
  background: color-mix(in srgb, #22c55e 26%, transparent);
}

.notif-btn--reject {
  background: color-mix(in srgb, #ef4444 12%, transparent);
  color: #dc2626;
  border: 1px solid color-mix(in srgb, #ef4444 26%, transparent);
}

.notif-btn--reject:hover {
  background: color-mix(in srgb, #ef4444 22%, transparent);
}

/* 처리 완료 뱃지 */
.notif-processed-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
}

.notif-title {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-main);
}

.notif-message {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.3;
}

.notif-time {
  font-size: 0.65rem;
  color: #999;
  margin-top: 2px;
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
.header-container { position: relative; min-height: 4rem; background: color-mix(in srgb, var(--bg-main) 92%, var(--bg-secondary) 8%); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 clamp(1rem, 2vw, 2rem); transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 1px 0 color-mix(in srgb, var(--border-color) 72%, transparent); }
.header-search-wrap { position: relative; flex: 1 1 22rem; max-width: min(44rem, 58vw); min-width: 0; }
.search-input { width: 100%; background: color-mix(in srgb, var(--bg-elevated) 88%, var(--bg-input) 12%); border: 1px solid var(--border-color); border-radius: 1rem; padding: 0.82rem 8rem 0.82rem 3rem; outline: none; font-size: 0.92rem; color: var(--text-main); box-shadow: var(--shadow-sm); transition: all 0.2s ease; }
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent), var(--shadow-sm); background-color: var(--bg-main); }
.search-input:disabled { cursor: not-allowed; opacity: 0.68; }
.search-input::placeholder { color: var(--text-muted); }
.search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); opacity: 0.78; }
.search-filter-button { position: absolute; top: 50%; right: 0.6rem; transform: translateY(-50%); display: inline-flex; align-items: center; gap: 0.45rem; border: 1px solid color-mix(in srgb, var(--border-color) 86%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--bg-main) 68%, var(--bg-input) 32%); color: var(--text-secondary); padding: 0.48rem 0.82rem; font-size: 0.78rem; font-weight: 700; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-inverse) 8%, transparent); transition: all 0.18s ease; }
.search-filter-button:hover:not(:disabled), .search-filter-button.is-active { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 35%, transparent); color: var(--accent); }
.search-filter-button.has-filters { background: color-mix(in srgb, var(--accent) 18%, var(--bg-elevated) 82%); border-color: color-mix(in srgb, var(--accent) 38%, transparent); color: var(--accent); }
.search-filter-button:disabled { cursor: not-allowed; opacity: 0.5; }
.search-filter-count { display: inline-flex; align-items: center; justify-content: center; min-width: 1.25rem; height: 1.25rem; border-radius: 999px; background: var(--accent); color: var(--text-inverse); font-size: 0.72rem; line-height: 1; }
.search-dropdown { position: absolute; top: calc(100% + 0.7rem); left: 0; width: min(100%, 42rem); border-radius: 1.3rem; border: 1px solid var(--border-color); background: color-mix(in srgb, var(--bg-elevated) 94%, var(--bg-main) 6%); box-shadow: var(--shadow-lg); padding: 1rem; z-index: 60; backdrop-filter: blur(18px); }
.search-dropdown__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.search-dropdown__eyebrow { font-size: 0.76rem; font-weight: 800; letter-spacing: 0.08em; color: var(--accent); text-transform: uppercase; }
.search-dropdown__description { margin-top: 0.35rem; font-size: 0.85rem; color: var(--text-muted); }
.search-dropdown__reset { border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); padding: 0.45rem 0.8rem; font-size: 0.76rem; font-weight: 700; transition: background-color 0.18s ease, border-color 0.18s ease; }
.search-dropdown__reset:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); border-color: color-mix(in srgb, var(--accent) 42%, transparent); }
.search-dropdown__grid { display: grid; gap: 0.85rem; margin-top: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.search-field { display: flex; min-width: 0; flex-direction: column; gap: 0.45rem; }
.search-field__label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
.search-field__control { width: 100%; border: 1px solid var(--border-strong); border-radius: 0.9rem; background: color-mix(in srgb, var(--bg-main) 82%, var(--bg-input) 18%); padding: 0.7rem 0.85rem; font-size: 0.88rem; color: var(--text-main); outline: none; transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease; }
.search-field__control:focus { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent); }
.search-field--hint { justify-content: center; border-radius: 1rem; background: color-mix(in srgb, var(--bg-input) 84%, var(--bg-elevated) 16%); border: 1px solid color-mix(in srgb, var(--border-color) 82%, transparent); padding: 0.85rem 0.95rem; }
.search-field__hint { font-size: 0.88rem; font-weight: 700; color: var(--text-main); }
.header-actions { display: flex; align-items: center; gap: clamp(0.65rem, 1vw, 1.1rem); margin-left: auto; min-width: max-content; }
.icon-button { color: var(--text-secondary); transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease; background: transparent; border: 1px solid transparent; cursor: pointer; padding: 0.5rem; border-radius: 0.8rem; position: relative; }
@keyframes bell-swing { 0%, 100% { transform: rotate(0deg); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-10deg); } 45% { transform: rotate(7deg); } 60% { transform: rotate(-5deg); } 75% { transform: rotate(2deg); } }
.bell-button:hover, .theme-button:hover, .chat-button:hover { background-color: var(--bg-input); border-color: color-mix(in srgb, var(--border-color) 84%, transparent); color: var(--text-main); transform: translateY(-1px); }
.bell-button:hover i { animation: bell-swing 0.7s ease-in-out infinite; transform-origin: top center; }
.theme-icon { transition: transform 0.2s ease; }
.theme-button:hover .theme-icon { transform: scale(1.08); }
.profile-trigger { display: flex; align-items: center; gap: 0.8rem; border-radius: 1rem; padding: 0.25rem 0.35rem 0.25rem 0.6rem; transition: background-color 0.18s ease, border-color 0.18s ease; border: 1px solid transparent; max-width: min(18rem, 32vw); }
.profile-trigger:hover { background: var(--bg-input); border-color: color-mix(in srgb, var(--border-color) 84%, transparent); }
.profile-trigger__copy { display: flex; flex-direction: column; align-items: flex-end; min-width: 0; }
.profile-trigger__name { font-size: 0.95rem; font-weight: 800; color: var(--text-main); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-trigger__plan { margin-top: 0.1rem; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; color: var(--accent); text-transform: uppercase; }
.profile-trigger__avatar { display: inline-flex; align-items: center; justify-content: center; overflow: hidden; width: 2.55rem; height: 2.55rem; border-radius: 0.9rem; background: linear-gradient(135deg, #123d88 0%, #2563eb 100%); color: #fff; font-size: 0.95rem; font-weight: 900; border: 2px solid color-mix(in srgb, var(--accent) 54%, transparent); box-shadow: 0 14px 28px rgba(37, 99, 235, 0.18); }
.profile-trigger__avatar-image { width: 100%; height: 100%; object-fit: cover; }
.dropdown-container { position: absolute; top: calc(100% + 10px); right: 0; min-width: 248px; background: color-mix(in srgb, var(--bg-elevated) 95%, var(--bg-main) 5%); border: 1px solid var(--border-color); border-radius: 18px; box-shadow: var(--shadow-lg); z-index: 50; opacity: 0; transform: translateY(-8px); pointer-events: none; transition: all 0.18s ease; backdrop-filter: blur(18px); }
.dropdown-container.active { opacity: 1; transform: translateY(0); pointer-events: auto; }
.dropdown-header { padding: 1rem 1.1rem; border-bottom: 1px solid var(--border-color); }
.dropdown-header__label { font-size: 0.82rem; font-weight: 700; color: var(--text-muted); }
.dropdown-header__email { margin-top: 0.4rem; font-size: 1.02rem; font-weight: 900; color: var(--text-main); word-break: break-all; }
.dropdown-item { width: 100%; padding: 0.9rem 1rem; display: flex; align-items: center; gap: 0.85rem; cursor: pointer; transition: background 0.15s ease, color 0.15s ease; color: var(--text-main); font-size: 0.98rem; font-weight: 700; text-align: left; }
.dropdown-item:hover { background: var(--bg-input); }
.dropdown-item i { width: 18px; text-align: center; color: var(--text-muted); }
.dropdown-muted { font-size: 0.9rem; color: var(--text-muted); }
.dropdown-footer { border-top: 1px solid var(--border-color); padding: 0.35rem 0; }
.logout-item { color: var(--text-main); }
.logout-item i { color: inherit; }
@media (max-width: 1120px) { .header-search-wrap { max-width: min(34rem, 50vw); } .search-dropdown, .search-dropdown__grid { width: 100%; grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .header-container { padding: 0 1rem; } .profile-trigger__copy { display: none; } .profile-trigger { max-width: none; } }
@media (max-width: 720px) { .header-container { flex-wrap: wrap; align-items: center; padding-top: 0.75rem; padding-bottom: 0.75rem; } .header-search-wrap { order: 2; flex-basis: 100%; max-width: 100%; } .search-input { padding-right: 7.5rem; } .search-dropdown, .search-dropdown__grid { grid-template-columns: 1fr; } .header-actions { width: 100%; justify-content: flex-end; } }
</style>