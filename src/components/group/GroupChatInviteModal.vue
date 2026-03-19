<script setup>
import { computed, ref, watch } from "vue";
import api from "@/plugins/axiosinterceptor.js";
import { fetchChatShareOverview, shareChatsWithTargets } from "@/api/groupApi";
import GroupRecipientSelector from "@/components/group/GroupRecipientSelector.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: "invite",
  },
  roomId: {
    type: [Number, String],
    default: null,
  },
  roomName: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close", "completed"]);

const overview = ref(null);
const isOverviewLoading = ref(false);
const isSubmitting = ref(false);
const roomTitle = ref("");
const selectedUserIds = ref([]);
const selectedGroupIds = ref([]);
const emailInput = ref("");
const pendingInvites = ref([]);
const errorMessage = ref("");
const successMessage = ref("");

const isCreateMode = computed(() => props.mode === "create");
const modalTitle = computed(() => (
  isCreateMode.value ? "채팅방 만들기" : "채팅방 초대"
));
const modalDescription = computed(() => (
  isCreateMode.value
    ? "채팅방 이름을 정하고 사용자, 그룹, 이메일을 선택해 한 번에 초대할 수 있습니다."
    : "현재 채팅방에 사용자, 그룹, 이메일을 함께 초대할 수 있습니다."
));

const resetState = () => {
  roomTitle.value = "";
  selectedUserIds.value = [];
  selectedGroupIds.value = [];
  emailInput.value = "";
  pendingInvites.value = [];
  errorMessage.value = "";
  successMessage.value = "";
  overview.value = null;
};

const loadOverview = async () => {
  isOverviewLoading.value = true;
  errorMessage.value = "";

  try {
    overview.value = await fetchChatShareOverview();
  } catch (error) {
    overview.value = null;
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "공유 가능한 사용자와 그룹을 불러오지 못했습니다.";
  } finally {
    isOverviewLoading.value = false;
  }
};

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (!isOpen) {
      resetState();
      return;
    }

    resetState();
    roomTitle.value = isCreateMode.value ? "" : (props.roomName || "");
    await loadOverview();
  },
  { immediate: true },
);

const handleClose = () => {
  if (isSubmitting.value) return;
  emit("close");
};

const submitInvite = async () => {
  const title = roomTitle.value.trim();
  const recipientEmail = emailInput.value.trim();
  const userIds = selectedUserIds.value.filter(Boolean);
  const groupIds = selectedGroupIds.value.filter(Boolean);

  if (isCreateMode.value && !title) {
    errorMessage.value = "채팅방 이름을 입력해주세요.";
    return;
  }

  if (!recipientEmail && userIds.length === 0 && groupIds.length === 0) {
    errorMessage.value = "초대할 사용자, 그룹, 이메일 중 하나 이상을 선택해주세요.";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  let targetRoomId = Number(props.roomId);

  try {
    if (isCreateMode.value) {
      const createResponse = await api.post("/chatRoom/create", {
        title,
        participantsEmail: [],
      });
      targetRoomId = Number(createResponse?.data);
    }

    const result = await shareChatsWithTargets({
      roomId: targetRoomId,
      userIds,
      groupIds,
      emails: recipientEmail ? [recipientEmail] : [],
    });

    pendingInvites.value = result?.pendingInvites || [];
    selectedUserIds.value = [];
    selectedGroupIds.value = [];
    emailInput.value = "";
    if (isCreateMode.value) {
      roomTitle.value = "";
    }

    successMessage.value = isCreateMode.value
      ? "채팅방을 만들고 초대를 적용했습니다."
      : "채팅방 초대를 적용했습니다.";

    emit("completed", {
      mode: props.mode,
      roomId: targetRoomId,
    });
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      (isCreateMode.value
        ? "채팅방을 만들지 못했습니다."
        : "채팅방 초대에 실패했습니다.");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="group-chat-modal"
  >
    <div class="group-chat-modal__backdrop" @click="handleClose"></div>

    <div class="group-chat-modal__panel">
      <header class="group-chat-modal__header">
        <div>
          <p class="group-chat-modal__eyebrow">Group Share</p>
          <h2 class="group-chat-modal__title">{{ modalTitle }}</h2>
          <p class="group-chat-modal__description">{{ modalDescription }}</p>
        </div>

        <button
          type="button"
          class="group-chat-modal__close"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </header>

      <div class="group-chat-modal__body">
        <div v-if="isCreateMode" class="group-chat-modal__field">
          <label for="chat-room-title">채팅방 이름</label>
          <input
            id="chat-room-title"
            v-model="roomTitle"
            type="text"
            maxlength="100"
            placeholder="예: 디자인 협업방"
            :disabled="isSubmitting"
            @keydown.enter.prevent="submitInvite"
          />
        </div>

        <div v-else class="group-chat-modal__summary">
          <strong>{{ roomName || "현재 채팅방" }}</strong>
          <span>이 채팅방에 새 참여자를 추가합니다.</span>
        </div>

        <div class="group-chat-modal__field">
          <label for="chat-share-email">이메일 추가</label>
          <input
            id="chat-share-email"
            v-model="emailInput"
            type="email"
            placeholder="직접 입력할 이메일"
            :disabled="isSubmitting"
            @keydown.enter.prevent="submitInvite"
          />
        </div>

        <GroupRecipientSelector
          :overview="overview"
          :loading="isOverviewLoading"
          :disabled="isSubmitting"
          :selected-user-ids="selectedUserIds"
          :selected-group-ids="selectedGroupIds"
          @update:selected-user-ids="selectedUserIds = $event"
          @update:selected-group-ids="selectedGroupIds = $event"
        />

        <p v-if="errorMessage" class="group-chat-modal__feedback group-chat-modal__feedback--error">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="group-chat-modal__feedback group-chat-modal__feedback--success">
          {{ successMessage }}
        </p>

        <div
          v-if="pendingInvites.length"
          class="group-chat-modal__pending"
        >
          <p>회원이 아닌 이메일은 연결 초대로 저장되었습니다.</p>
          <ul>
            <li v-for="invite in pendingInvites" :key="invite.inviteId">
              {{ invite.email }}
            </li>
          </ul>
        </div>
      </div>

      <footer class="group-chat-modal__footer">
        <button
          type="button"
          class="group-chat-modal__secondary"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          닫기
        </button>
        <button
          type="button"
          class="group-chat-modal__primary"
          :disabled="isSubmitting"
          @click="submitInvite"
        >
          {{ isSubmitting ? "적용 중..." : (isCreateMode ? "채팅방 만들기" : "초대 적용") }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.group-chat-modal {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.group-chat-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
}

.group-chat-modal__panel {
  position: relative;
  width: min(840px, 100%);
  max-height: calc(100vh - 2rem);
  overflow: auto;
  border-radius: 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: var(--bg-main);
  box-shadow: 0 30px 60px rgba(15, 23, 42, 0.24);
}

.group-chat-modal__header,
.group-chat-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
}

.group-chat-modal__header {
  border-bottom: 1px solid var(--border-color);
}

.group-chat-modal__footer {
  border-top: 1px solid var(--border-color);
}

.group-chat-modal__eyebrow {
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0284c7;
}

.group-chat-modal__title {
  margin-top: 0.3rem;
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--text-main);
}

.group-chat-modal__description {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.group-chat-modal__close {
  width: 2.35rem;
  height: 2.35rem;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.group-chat-modal__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem 1.25rem 1.35rem;
}

.group-chat-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.group-chat-modal__field label {
  font-size: 0.84rem;
  font-weight: 800;
  color: var(--text-main);
}

.group-chat-modal__field input {
  width: 100%;
  border-radius: 0.95rem;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  padding: 0.8rem 0.95rem;
  color: var(--text-main);
}

.group-chat-modal__summary {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(59, 130, 246, 0.18);
  background: rgba(239, 246, 255, 0.9);
}

.group-chat-modal__summary strong {
  color: #1d4ed8;
  font-weight: 900;
}

.group-chat-modal__summary span {
  font-size: 0.82rem;
  color: #475569;
}

.group-chat-modal__feedback {
  border-radius: 0.95rem;
  padding: 0.85rem 0.95rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.group-chat-modal__feedback--error {
  background: rgba(254, 226, 226, 0.9);
  color: #b91c1c;
}

.group-chat-modal__feedback--success {
  background: rgba(220, 252, 231, 0.9);
  color: #15803d;
}

.group-chat-modal__pending {
  border-radius: 1rem;
  border: 1px solid rgba(251, 191, 36, 0.42);
  background: rgba(254, 249, 195, 0.78);
  padding: 0.95rem 1rem;
  color: #92400e;
  font-size: 0.84rem;
}

.group-chat-modal__pending p {
  font-weight: 800;
}

.group-chat-modal__pending ul {
  margin-top: 0.45rem;
  padding-left: 1rem;
  list-style: disc;
}

.group-chat-modal__secondary,
.group-chat-modal__primary {
  border-radius: 999px;
  padding: 0.78rem 1.05rem;
  font-size: 0.88rem;
  font-weight: 800;
}

.group-chat-modal__secondary {
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.group-chat-modal__primary {
  background: #0284c7;
  color: #fff;
}

.group-chat-modal__secondary:disabled,
.group-chat-modal__primary:disabled,
.group-chat-modal__close:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}
</style>
