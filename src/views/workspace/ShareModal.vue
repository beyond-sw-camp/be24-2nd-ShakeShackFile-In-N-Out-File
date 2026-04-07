<script setup>
import { computed, ref, watch } from "vue";
import postApi from "@/api/postApi";
import loadpost from "@/components/workspace/loadpost";
import { fetchGroupOverview, shareWorkspacesWithTargets } from "@/api/groupApi";
import GroupRecipientSelector from "@/components/group/GroupRecipientSelector.vue";

const props = defineProps({
  isOpen: Boolean,
  postIdx: [Number, String],
  uuid: String,
  initialStatus: String,
});

const emit = defineEmits(["close", "refresh"]);

const privacyStatus = ref(props.initialStatus || "Private");
const overview = ref(null);
const isOverviewLoading = ref(false);
const shareEmail = ref("");
const selectedUserIds = ref([]);
const selectedGroupIds = ref([]);
const pendingInvites = ref([]);
const shareError = ref("");
const shareSuccess = ref("");
const isSharing = ref(false);
const isSavingStatus = ref(false);

const inviteUrl = computed(() => (
  `${typeof window !== "undefined" ? window.location.origin : ""}/workspace/invite?uuid=${props.uuid || ""}`
));

const resetShareState = () => {
  shareEmail.value = "";
  selectedUserIds.value = [];
  selectedGroupIds.value = [];
  pendingInvites.value = [];
  shareError.value = "";
  shareSuccess.value = "";
  overview.value = null;
};

const loadOverview = async () => {
  isOverviewLoading.value = true;
  shareError.value = "";

  try {
    overview.value = await fetchGroupOverview();
  } catch (error) {
    overview.value = null;
    shareError.value =
      error?.response?.data?.message ||
      error?.message ||
      "공유 대상을 불러오지 못했습니다.";
  } finally {
    isOverviewLoading.value = false;
  }
};

watch(
  [() => props.isOpen, () => props.initialStatus],
  async ([isOpen, nextStatus]) => {
    if (!isOpen) {
      resetShareState();
      return;
    }

    resetShareState();
    privacyStatus.value = nextStatus || "Private";
    await loadOverview();
  },
  { immediate: true },
);

const copyLink = async () => {
  if (privacyStatus.value !== "Public") return;
  await navigator.clipboard.writeText(inviteUrl.value);
  window.alert("링크가 클립보드에 복사되었습니다.");
};

const handleShareTargets = async () => {
  const recipientEmail = shareEmail.value.trim();
  const userIds = selectedUserIds.value.filter(Boolean);
  const groupIds = selectedGroupIds.value.filter(Boolean);

  if (!recipientEmail && userIds.length === 0 && groupIds.length === 0) {
    shareError.value = "공유할 사용자, 그룹, 이메일 중 하나 이상을 선택해주세요.";
    return;
  }

  isSharing.value = true;
  shareError.value = "";
  shareSuccess.value = "";

  try {
    if (privacyStatus.value === "Private") {
      await postApi.updateShareStatus(props.postIdx, "Shared");
      privacyStatus.value = "Shared";
    }

    const result = await shareWorkspacesWithTargets({
      workspaceId: props.postIdx,
      userIds,
      groupIds,
      emails: recipientEmail ? [recipientEmail] : [],
    });

    selectedUserIds.value = [];
    selectedGroupIds.value = [];
    shareEmail.value = "";
    pendingInvites.value = result?.pendingInvites || [];
    shareSuccess.value = "워크스페이스 공유 대상을 적용했습니다.";

    if (loadpost?.side_list) {
      await loadpost.side_list();
    }
    emit("refresh");
  } catch (error) {
    shareError.value =
      error?.response?.data?.message ||
      error?.message ||
      "워크스페이스를 공유하지 못했습니다.";
  } finally {
    isSharing.value = false;
  }
};

const handleSaveStatus = async () => {
  isSavingStatus.value = true;

  try {
    await postApi.updateShareStatus(props.postIdx, privacyStatus.value);
    if (loadpost?.side_list) {
      await loadpost.side_list();
    }
    emit("refresh");
    window.alert("공유 설정이 저장되었습니다.");
    emit("close");
  } catch (error) {
    console.error("Save Status Error:", error);
    window.alert("설정 저장 중 오류가 발생했습니다.");
  } finally {
    isSavingStatus.value = false;
  }
};
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[1000] flex items-center justify-center px-4"
  >
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative flex h-[min(82vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-main)] shadow-2xl">
      <div class="shrink-0 border-b border-[var(--border-color)] p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-[var(--text-main)]">워크스페이스 공유</h2>
          <p class="mt-1 text-sm text-[var(--text-muted)]">
            공개 링크를 관리하고, 사용자와 그룹을 선택해 워크스페이스를 공유할 수 있습니다.
          </p>
        </div>

        <div class="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] p-1">
          <button
            v-for="status in ['Private', 'Shared', 'Public']"
            :key="status"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
            :class="privacyStatus === status ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-700' : 'text-[var(--text-muted)]'"
            @click="privacyStatus = status"
          >
            {{ status === "Private" ? "개인" : status === "Shared" ? "공유" : "공개" }}
          </button>
        </div>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div class="space-y-6 pr-1">
        <section class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)]/60 p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm font-extrabold text-[var(--text-main)]">공개 링크</p>
              <p class="mt-1 text-xs text-[var(--text-muted)]">
                공개 상태일 때만 링크로 바로 입장할 수 있습니다.
              </p>
            </div>
            <span class="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[var(--text-muted)] dark:bg-slate-800/70">
              현재 상태: {{ privacyStatus === "Private" ? "개인" : privacyStatus === "Shared" ? "공유" : "공개" }}
            </span>
          </div>

          <div class="mt-4 flex gap-2">
            <input
              type="text"
              readonly
              :value="inviteUrl"
              :disabled="privacyStatus !== 'Public'"
              class="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2.5 text-sm font-semibold text-[var(--text-main)] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-700/80"
              :disabled="privacyStatus !== 'Public'"
              @click="copyLink"
            >
              링크 복사
            </button>
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-base font-black text-[var(--text-main)]">멤버 공유</p>
              <p class="mt-1 text-sm text-[var(--text-muted)]">
                사용자, 그룹, 이메일을 함께 선택할 수 있습니다. 개인 상태에서 공유하면 자동으로 공유 상태로 전환됩니다.
              </p>
            </div>
          </div>

          <GroupRecipientSelector
            :overview="overview"
            :loading="isOverviewLoading"
            :disabled="isSharing"
            :selected-user-ids="selectedUserIds"
            :selected-group-ids="selectedGroupIds"
            @update:selected-user-ids="selectedUserIds = $event"
            @update:selected-group-ids="selectedGroupIds = $event"
          />

          <p v-if="shareError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {{ shareError }}
          </p>
          <p v-if="shareSuccess" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {{ shareSuccess }}
          </p>

          <div
            v-if="pendingInvites.length"
            class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
          >
            <p class="font-bold">회원이 아닌 이메일은 연결 초대로 저장되었습니다.</p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li v-for="invite in pendingInvites" :key="invite.inviteId">
                {{ invite.email }}
              </li>
            </ul>
            
          </div>

          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              v-model="shareEmail"
              type="email"
              class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-main)] outline-none"
              placeholder="직접 입력할 이메일"
              :disabled="isSharing"
              @keydown.enter.prevent="handleShareTargets"
            />
            <button
              type="button"
              class="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="isSharing"
              @click="handleShareTargets"
            >
              {{ isSharing ? "공유 중..." : "공유 적용" }}
            </button>
          </div>
        </section>
        </div>
      </div>

      <div class="flex shrink-0 justify-end gap-3 border-t border-[var(--border-color)] bg-[var(--bg-input)] p-4">
        <button
          type="button"
          class="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
          @click="$emit('close')"
        >
          취소
        </button>
        <button
          type="button"
          class="rounded-xl bg-blue-600 px-7 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          :disabled="isSavingStatus"
          @click="handleSaveStatus"
        >
          {{ isSavingStatus ? "저장 중..." : "설정 저장" }}
        </button>
      </div>
    </div>
  </div>
</template>
