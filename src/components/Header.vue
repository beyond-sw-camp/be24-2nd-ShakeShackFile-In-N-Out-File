<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { fetchSettingsProfile } from "@/api/featerApi";
import loadpost from "./workspace/loadpost";
import sseApi from "@/api/sseApi";
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
import { useFileStore } from "@/stores/useFileStore";
import { registerPushNotification } from "@/utils/pushNotification";
import ProfileModal from "./ProfileModal.vue";
import GamesHubModal from "@/components/games/GamesHubModal.vue";
import postApi from "@/api/postApi";

const emit = defineEmits(["toggle-chat", "toggle-theme", "switch-view"]);

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const fileStore = useFileStore();
const headerSearchStore = useHeaderSearchStore();

const showNotifDropdown = ref(false);
const showProfileDropdown = ref(false);
const showSearchDropdown = ref(false);
const isProfileModalOpen = ref(false);
const isGamesModalOpen = ref(false);

const notifications = ref([]);
const hasNewNotif = ref(false);

const emitGroupStateChanged = () => {
  window.dispatchEvent(new CustomEvent("group-state-changed"));
};

// ─── 캐시 제어 ────────────────────────────────────────────────────────────────
const lastFetchedAt = ref(0);
const CACHE_TTL_MS = 2 * 60 * 1000; // 2분

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

  if (!min && !max) return "범위를 입력하세요";
  if (min && max) return `${min}MB ~ ${max}MB`;
  if (min) return `${min}MB 이상`;
  return `${max}MB 이하`;
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
    ? "파일명, 확장자, 공유자 이메일을 검색하세요"
    : "파일 검색은 드라이브 화면에서 사용할 수 있습니다."
));

const userName = computed(() => (
  settingsProfile.value?.displayName ||
  authStore.user?.userName ||
  authStore.user?.name ||
  "사용자"
));

const userEmail = computed(() => (
  settingsProfile.value?.email ||
  authStore.user?.email ||
  authStore.user?.userEmail ||
  "이메일 정보 없음"
));

const userLocaleLabel = computed(() => settingsProfile.value?.localeCode || "KO");
const membershipLabel = computed(() => settingsProfile.value?.membershipLabel || "FREE MEMBER");
const canUseGames = computed(() => {
  const capability = fileStore.planCapabilities || {};
  const planCode = String(capability.planCode || "").toUpperCase();
  const settingsMembershipCode = String(settingsProfile.value?.membershipCode || "").toUpperCase();

  return (
    Boolean(capability.adminAccount) ||
    planCode === "PREMIUM" ||
    planCode === "ADMIN" ||
    settingsMembershipCode === "PREMIUM" ||
    settingsMembershipCode === "ADMIN"
  );
});
const userProfileImage = computed(() => settingsProfile.value?.profileImageUrl || "");
const avatarInitials = computed(() => (
  (userName.value || "사용자")
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
  if (!dateStr) return "방금 전";

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "방금 전";

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  return `${Math.floor(hours / 24)}일 전`;
};

const getChatNotificationMessage = (item = {}) => {
  const text = String(item.message ?? item.contents ?? item.lastMsg ?? "").trim();
  if (text) return text;

  const normalizedMessageType = String(item.messageType ?? "").toUpperCase();
  if (normalizedMessageType === "IMAGE") return "사진";
  if (normalizedMessageType === "FILE") return "문서";

  const normalizedFileType = String(item.fileType ?? "").toLowerCase();
  if (normalizedFileType.startsWith("image/")) return "사진";
  if (normalizedFileType) return "문서";

  const fileHint = String(item.fileName ?? item.fileUrl ?? "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileHint)) return "사진";
  if (fileHint) return "문서";

  return "";
};

const toNotificationItem = (item = {}) => {
  const rawType = item.type ?? item.notifType ?? "general";
  const isChat = rawType === "message" || rawType === "NEW_MESSAGE";
  const type = isChat ? "chat" : rawType;
  const read = Boolean(item.read);
  const actionableTypes = ["invite", "group_invite", "relationship_invite"];
  const processed = actionableTypes.includes(type) && read;
  const roomIdxForKey =
    item.roomIdx ?? item.roomId ?? item.chatRoomIdx ?? item.referenceId ?? null;
  const serverRowId = isChat
    ? (item.notificationId ?? item.notificationIdx ?? null)
    : (item.notificationId ?? item.idx ?? item.id ?? null);
  const displayId =
    serverRowId ??
    (isChat ? `local-chat-${roomIdxForKey ?? "na"}` : Date.now());

  return {
    id: displayId,
    serverRowId,
    uuid: item.uuid ?? null,
    referenceId: item.referenceId ?? null,
    // 백엔드/SSE 페이로드 키가 버전마다 다를 수 있어 방 인덱스 매핑을 유연하게 처리
    roomIdx: roomIdxForKey,
    type,
    title: item.title ?? "알림",
    message: isChat ? getChatNotificationMessage(item) : (item.message ?? item.contents ?? item.lastMsg ?? ""),
    createdAt: item.createdAt ?? null,
    time: item.createdAt ? formatRelativeTime(item.createdAt) : "방금 전",
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

const extractNotificationListPayload = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.result?.body)) return raw.result.body;
  if (Array.isArray(raw.result)) return raw.result;
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.body)) return raw.body;
  return [];
};

const chatNotificationDedupeKey = (notification) => {
  if (!notification || notification.type !== "chat") return null;
  return notification.roomIdx != null
    ? `room_${notification.roomIdx}`
    : `title_${notification.title}`;
};

// ─── 서버 조회 (최소화) ───────────────────────────────────────────────────────
// 호출 시점: ① 로그인 직후 1회  ② 드롭다운 열 때 (캐시 만료 시만)
//            ③ 수락/거절 직후 상태 동기화
const fetchNotifications = async () => {
  if (!authStore.user?.idx) {
    notifications.value = [];
    updateNotifBadge();
    return;
  }

  try {
    const response = await postApi.getNotifications();
    const items = extractNotificationListPayload(response);
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
    const serverChatKeys = new Set(
      grouped.map(chatNotificationDedupeKey).filter((key) => key != null)
    );
    const clientOnlyChats = notifications.value.filter((notification) => {
      const key = chatNotificationDedupeKey(notification);
      return notification.type === "chat" && key != null && !serverChatKeys.has(key);
    });

    notifications.value = [...clientOnlyChats, ...grouped];
    lastFetchedAt.value = Date.now();
    updateNotifBadge();
  } catch (error) {
    console.error("알림 목록 불러오기 실패:", error);
  }
};

const fetchNotificationsIfStale = async () => {
  const elapsed = Date.now() - lastFetchedAt.value;
  if (lastFetchedAt.value > 0 && elapsed < CACHE_TTL_MS) return;
  await fetchNotifications();
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
        serverRowId: previous.serverRowId ?? incoming.serverRowId,
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
  if (!notification?.serverRowId && !notification?.uuid) return;

  try {
    await postApi.markNotificationAsRead({
      id: notification.serverRowId ?? null,
      uuid: notification.uuid ?? null,
    });
  } catch (error) {
    console.error("알림 읽음 처리 실패:", error);
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
    await applyProcessedState(notification, type === "accept" ? "수락됨" : "거절됨");
    await fetchNotifications();
    await loadpost.side_list();
  } catch (error) {
    const message = getErrorMessage(error);

    if (type === "reject" && (error?.response?.status === 500 || message.includes("거절"))) {
      await applyProcessedState(notification, "거절됨");
      await fetchNotifications();
      return;
    }

    console.error(type === "accept" ? "초대 수락 실패:" : "초대 거절 실패:", error);
    await fetchNotifications();

    if (type === "accept" && message.includes("유효하지 않은 토큰")) {
      alert("이미 처리되었거나 만료된 초대입니다.");
      return;
    }

    alert(message || (type === "accept" ? "초대 수락에 실패했습니다." : "초대 거절에 실패했습니다."));
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

    await applyProcessedState(notification, type === "accept" ? "수락됨" : "거절됨");
    await fetchNotifications();
    emitGroupStateChanged();
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

    await applyProcessedState(notification, type === "accept" ? "수락됨" : "거절됨");
    await fetchNotifications();
    emitGroupStateChanged();
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

  window.dispatchEvent(new CustomEvent("open-chat-room", {
    detail: { roomIdx: notification.roomIdx, roomTitle: notification.title }
  }));
};

const handleDeleteNotification = async (notification) => {
  try {
    if (notification.type === "chat") {
      const index = findNotificationIndex(notification);
      if (index >= 0) {
        notifications.value.splice(index, 1);
      }
      updateNotifBadge();
      return;
    }

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
    console.error("알림 삭제 실패:", error);
    alert("알림 삭제에 실패했습니다.");
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
    await fetchNotificationsIfStale();
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

const openGamesHub = async () => {
  if (!fileStore.storageSummary && !fileStore.storageLoading) {
    try {
      await fileStore.fetchStorageSummary();
    } catch (error) {
      console.error("게임 권한 확인 실패:", error);
    }
  }

  if (!canUseGames.value) {
    return;
  }

  showProfileDropdown.value = false;
  isGamesModalOpen.value = true;
};

const handleCloseProfileModal = () => {
  isProfileModalOpen.value = false;
};

const handleCloseGamesModal = () => {
  isGamesModalOpen.value = false;
};

const handleSavedProfile = (savedProfile) => {
  settingsProfile.value = savedProfile;
};

const handleLogout = async () => {
  if (confirm("로그아웃 하시겠습니까?")) {
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

// ─── SSE ─────────────────────────────────────────────────────────────────────
const stopSse = () => {
  sseApi.closeSse(sseEventSource);
  sseEventSource = null;
};

const startSse = () => {
  stopSse();
  sseEventSource = sseApi.connectNotificationSse({
    onNotification: (payload) => {
      pushNewNotification(payload);
    },
    onNewMessage: (payload) => {
      pushNewNotification(payload);
      window.dispatchEvent(new CustomEvent("sse-new-message", { detail: payload }));
    },
    onError: () => {
      sseEventSource = null;
      if (authStore.user?.idx) {
        setTimeout(() => startSse(), 5000);
      }
    },
  });

  sseEventSource.addEventListener("chat-preview-update", (e) => {
    try {
      const payload = JSON.parse(e.data);
      window.dispatchEvent(new CustomEvent("sse-chat-preview-update", { detail: payload }));
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
      lastFetchedAt.value = 0;
      updateNotifBadge();
      return;
    }

    await fetchNotifications();
    startSse();

    if (!fileStore.storageSummary && !fileStore.storageLoading) {
      fileStore.fetchStorageSummary().catch(() => {});
    }

    try {
      await registerPushNotification();
    } catch (error) {
      console.error("알림 구독 실패:", error);
    }
  },
  { immediate: true },
);

onMounted(() => {
  initTheme();
  authStore.checkLogin();
  loadSettingsProfile();
  setupNotificationChannel();
  if (!fileStore.storageSummary && !fileStore.storageLoading) {
    fileStore.fetchStorageSummary().catch(() => {});
  }
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
    <GamesHubModal
      :is-open="isGamesModalOpen"
      :can-access="canUseGames"
      @close="handleCloseGamesModal"
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
              <button v-if="canUseGames" type="button" class="dropdown-item" @click="openGamesHub"><i class="fa-solid fa-gamepad"></i><span>Games</span></button>
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
  border-left: 3px solid transparent;
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

.notif-unread {
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-elevated) 93%);
  border-left-color: var(--accent);
}

.notif-read {
  opacity: 0.65;
  border-left-color: transparent;
}

.notif-processed {
  opacity: 0.4;
  filter: grayscale(50%);
  border-left-color: transparent;
}

.notif-title-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

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
.search-dropdown { position: absolute; top: calc(100% + 0.7rem); left: 0; width: min(100%, 42rem); border-radius: 1.3rem; border: 1px solid var(--border-color); background: color-mix(in srgb, var(--bg-elevated) 94%, var(--bg-main) 6%); box-shadow: var(--shadow-lg); padding: 1rem; z-index: 12000; backdrop-filter: blur(18px); }
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
.dropdown-container { position: absolute; top: calc(100% + 10px); right: 0; min-width: 248px; background: color-mix(in srgb, var(--bg-elevated) 95%, var(--bg-main) 5%); border: 1px solid var(--border-color); border-radius: 18px; box-shadow: var(--shadow-lg); z-index: 12000; opacity: 0; transform: translateY(-8px); pointer-events: none; transition: all 0.18s ease; backdrop-filter: blur(18px); }
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
