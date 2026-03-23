<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  acceptGroupInvite,
  acceptRelationshipInvite,
  addRelationshipToGroup,
  createGroup,
  createGroupInvite,
  createRelationshipInvite,
  deleteGroup,
  deleteRelationship,
  fetchGroupOverview,
  fetchRelationships,
  rejectGroupInvite,
  rejectRelationshipInvite,
  removeRelationshipFromGroup,
  renameGroup,
} from "@/api/groupApi";

const REQUEST_PAGE_SIZE = 6;

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  focusSection: {
    type: String,
    default: "manage",
  },
});

const overview = ref(null);
const relationshipState = ref(null);
const isLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const inviteEmail = ref("");
const groupName = ref("");
const incomingRequestPage = ref(1);
const outgoingRequestPage = ref(1);
const requestSectionRef = ref(null);
const inviteSectionRef = ref(null);
const createSectionRef = ref(null);
const manageSectionRef = ref(null);
const activeActionKey = ref("");
const uncategorizedSelections = ref({});
const groupCandidateSelections = ref({});
const editingGroupId = ref(null);
const editingGroupName = ref("");

const groups = computed(() => overview.value?.groups || []);
const groupDetails = computed(() => overview.value?.groupDetails || []);
const uncategorizedRelationships = computed(() => overview.value?.uncategorizedRelationships || []);
const allRelationships = computed(() => relationshipState.value?.relationships || []);
const incomingInvites = computed(() => relationshipState.value?.incomingInvites || []);
const outgoingInvites = computed(() => relationshipState.value?.outgoingInvites || []);
const incomingGroupInvites = computed(() => overview.value?.incomingGroupInvites || []);
const outgoingGroupInvites = computed(() => overview.value?.outgoingGroupInvites || []);

const groupDetailMap = computed(() => {
  const map = new Map();
  groupDetails.value.forEach((group) => map.set(group.groupId, group));
  return map;
});

const requestItems = computed(() => {
  const relationshipRequests = [
    ...incomingInvites.value.map((invite) => ({
      id: `relationship-incoming-${invite.inviteId}`,
      kind: "relationship",
      direction: "received",
      status: invite.status,
      createdAt: invite.createdAt,
      inviteId: invite.inviteId,
      title: "새 연결 요청",
      summary: `${invite.fromUser?.name || invite.email || "알 수 없는 사용자"}님이 연결 요청을 보냈습니다.`,
      detail: invite.fromUser?.email || invite.email || "-",
    })),
    ...outgoingInvites.value.map((invite) => ({
      id: `relationship-outgoing-${invite.inviteId}`,
      kind: "relationship",
      direction: "sent",
      status: invite.status,
      createdAt: invite.createdAt,
      inviteId: invite.inviteId,
      title: "보낸 연결 요청",
      summary: `${invite.toUser?.name || invite.email || "상대"}님에게 연결 요청을 보냈습니다.`,
      detail: invite.toUser?.email || invite.email || "-",
    })),
  ];

  const groupRequests = [
    ...incomingGroupInvites.value.map((invite) => ({
      id: `group-incoming-${invite.groupInviteId}`,
      kind: "group",
      direction: "received",
      status: invite.status,
      createdAt: invite.createdAt,
      inviteId: invite.groupInviteId,
      title: "그룹 초대 요청",
      summary: `${invite.fromUser?.name || "알 수 없는 사용자"}님이 [${invite.groupName}] 그룹으로 초대했습니다.`,
      detail: invite.fromUser?.email || "-",
    })),
    ...outgoingGroupInvites.value.map((invite) => ({
      id: `group-outgoing-${invite.groupInviteId}`,
      kind: "group",
      direction: "sent",
      status: invite.status,
      createdAt: invite.createdAt,
      inviteId: invite.groupInviteId,
      title: "보낸 그룹 초대",
      summary: `${invite.toUser?.name || "상대"}님에게 [${invite.groupName}] 그룹 초대를 보냈습니다.`,
      detail: invite.toUser?.email || "-",
    })),
  ];

  return [...relationshipRequests, ...groupRequests].sort((left, right) => (
    new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  ));
});

const pendingRequestItems = computed(() => requestItems.value.filter((item) => item.status === "PENDING"));
const incomingPendingRequestItems = computed(() => pendingRequestItems.value.filter((item) => item.direction === "received"));
const outgoingPendingRequestItems = computed(() => pendingRequestItems.value.filter((item) => item.direction === "sent"));

const incomingRequestPageCount = computed(() => Math.max(1, Math.ceil(incomingPendingRequestItems.value.length / REQUEST_PAGE_SIZE)));
const outgoingRequestPageCount = computed(() => Math.max(1, Math.ceil(outgoingPendingRequestItems.value.length / REQUEST_PAGE_SIZE)));

const pagedIncomingRequestItems = computed(() => {
  const start = (incomingRequestPage.value - 1) * REQUEST_PAGE_SIZE;
  return incomingPendingRequestItems.value.slice(start, start + REQUEST_PAGE_SIZE);
});

const pagedOutgoingRequestItems = computed(() => {
  const start = (outgoingRequestPage.value - 1) * REQUEST_PAGE_SIZE;
  return outgoingPendingRequestItems.value.slice(start, start + REQUEST_PAGE_SIZE);
});

const groupCount = computed(() => groups.value.length);
const relationshipCount = computed(() => allRelationships.value.length);
const uncategorizedCount = computed(() => uncategorizedRelationships.value.length);
const pendingRequestCount = computed(() => pendingRequestItems.value.length);

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const setActionKey = (key) => {
  activeActionKey.value = key;
};

const clearFeedback = () => {
  errorMessage.value = "";
  successMessage.value = "";
};

const isBusy = (key) => activeActionKey.value === key;

const loadData = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const [overviewResult, relationshipResult] = await Promise.all([
      fetchGroupOverview(),
      fetchRelationships(),
    ]);

    overview.value = overviewResult;
    relationshipState.value = relationshipResult;
    incomingRequestPage.value = Math.min(incomingRequestPage.value, incomingRequestPageCount.value);
    outgoingRequestPage.value = Math.min(outgoingRequestPage.value, outgoingRequestPageCount.value);
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹 정보를 불러오지 못했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const scrollToFocusSection = async () => {
  const sectionMap = {
    requests: requestSectionRef,
    invite: inviteSectionRef,
    create: createSectionRef,
    manage: manageSectionRef,
  };

  const targetRef = sectionMap[props.focusSection] || manageSectionRef;
  await nextTick();
  targetRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const refreshData = async (message = "") => {
  await loadData();
  if (message) {
    successMessage.value = message;
  }
};

const handleExternalGroupStateChange = async () => {
  if (!props.active || isLoading.value) {
    return;
  }

  await loadData();
};

const handleCreateInvite = async () => {
  const email = inviteEmail.value.trim();
  if (!email) {
    errorMessage.value = "초대할 이메일을 입력해 주세요.";
    return;
  }

  clearFeedback();
  setActionKey("create-invite");

  try {
    await createRelationshipInvite({ email, type: "FRIEND" });
    inviteEmail.value = "";
    await refreshData("연결 요청을 보냈습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "연결 요청을 보내지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleCreateGroup = async () => {
  const name = groupName.value.trim();
  if (!name) {
    errorMessage.value = "그룹 이름을 입력해 주세요.";
    return;
  }

  clearFeedback();
  setActionKey("create-group");

  try {
    await createGroup(name);
    groupName.value = "";
    await refreshData("그룹을 만들었습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹을 만들지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleRequestAction = async (item, action) => {
  clearFeedback();
  setActionKey(`${action}-${item.id}`);

  try {
    if (item.kind === "relationship") {
      if (action === "accept") {
        await acceptRelationshipInvite(item.inviteId);
      } else {
        await rejectRelationshipInvite(item.inviteId);
      }
    } else if (action === "accept") {
      await acceptGroupInvite(item.inviteId);
    } else {
      await rejectGroupInvite(item.inviteId);
    }

    await refreshData(action === "accept" ? "요청을 수락했습니다." : "요청을 거절했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "요청을 처리하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleAddRelationshipToGroup = async (relationshipId, groupId) => {
  if (!groupId) {
    errorMessage.value = "추가할 그룹을 선택해 주세요.";
    return;
  }

  clearFeedback();
  setActionKey(`add-${relationshipId}-${groupId}`);

  try {
    await addRelationshipToGroup(relationshipId, Number(groupId));
    delete uncategorizedSelections.value[relationshipId];
    await refreshData("그룹에 인원을 추가했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹에 추가하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleRemoveRelationshipFromGroup = async (relationshipId, groupId) => {
  clearFeedback();
  setActionKey(`remove-${relationshipId}-${groupId}`);

  try {
    await removeRelationshipFromGroup(relationshipId, groupId);
    await refreshData("그룹에서 인원을 제거했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹에서 제거하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleDeleteRelationship = async (relationship) => {
  if (!window.confirm(`${relationship.targetUser?.name || "이 사용자"}와의 연결을 해제하시겠습니까?`)) {
    return;
  }

  clearFeedback();
  setActionKey(`delete-${relationship.relationshipId}`);

  try {
    await deleteRelationship(relationship.relationshipId);
    await refreshData("연결을 해제했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "연결을 해제하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const startRenameGroup = (group) => {
  editingGroupId.value = group.groupId;
  editingGroupName.value = group.name || "";
};

const cancelRenameGroup = () => {
  editingGroupId.value = null;
  editingGroupName.value = "";
};

const handleRenameGroup = async (groupId) => {
  const name = editingGroupName.value.trim();
  if (!name) {
    errorMessage.value = "새 그룹 이름을 입력해 주세요.";
    return;
  }

  clearFeedback();
  setActionKey(`rename-${groupId}`);

  try {
    await renameGroup(groupId, name);
    cancelRenameGroup();
    await refreshData("그룹 이름을 변경했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹 이름을 변경하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleDeleteGroup = async (group) => {
  if (!window.confirm(`[${group.name}] 그룹을 삭제하시겠습니까?`)) {
    return;
  }

  clearFeedback();
  setActionKey(`delete-group-${group.groupId}`);

  try {
    await deleteGroup(group.groupId);
    await refreshData("그룹을 삭제했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹을 삭제하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const availableGroupsForRelationship = (relationship) => {
  const currentIds = new Set((relationship?.groups || []).map((group) => group.groupId));
  return groups.value.filter((group) => !currentIds.has(group.groupId));
};

const availableRelationshipsForGroup = (groupId) => {
  const group = groupDetailMap.value.get(groupId);
  const groupedIds = new Set((group?.relationships || []).map((relationship) => relationship.relationshipId));
  return allRelationships.value.filter((relationship) => !groupedIds.has(relationship.relationshipId));
};

const handleAddPersonToGroupCard = async (groupId) => {
  const relationshipId = Number(groupCandidateSelections.value[groupId]);
  if (!relationshipId) {
    errorMessage.value = "추가할 인원을 선택해 주세요.";
    return;
  }

  clearFeedback();
  setActionKey(`group-card-add-${groupId}`);

  try {
    await addRelationshipToGroup(relationshipId, groupId);
    delete groupCandidateSelections.value[groupId];
    await refreshData("그룹에 인원을 추가했습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹에 추가하지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

const handleSendGroupInvite = async (groupId) => {
  const relationshipId = Number(groupCandidateSelections.value[groupId]);
  const relationship = allRelationships.value.find((item) => item.relationshipId === relationshipId);
  const targetUserId = relationship?.targetUser?.userId;

  if (!targetUserId) {
    errorMessage.value = "초대할 인원을 선택해 주세요.";
    return;
  }

  clearFeedback();
  setActionKey(`group-invite-${groupId}`);

  try {
    await createGroupInvite({ groupId, toUserId: targetUserId });
    await refreshData("그룹 초대를 보냈습니다.");
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || error?.message || "그룹 초대를 보내지 못했습니다.";
  } finally {
    setActionKey("");
  }
};

watch(() => props.active, async (active) => {
  if (!active) {
    return;
  }

  await loadData();
  await scrollToFocusSection();
}, { immediate: true });

watch(() => props.focusSection, async () => {
  if (!props.active) {
    return;
  }

  await scrollToFocusSection();
});

watch(incomingPendingRequestItems, () => {
  incomingRequestPage.value = 1;
});

watch(outgoingPendingRequestItems, () => {
  outgoingRequestPage.value = 1;
});

onMounted(() => {
  window.addEventListener("group-state-changed", handleExternalGroupStateChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("group-state-changed", handleExternalGroupStateChange);
});
</script>

<template>
  <div class="space-y-5">
    <section class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Group Center</p>
          <h3 class="mt-2 text-2xl font-bold text-slate-900">그룹과 연결 관리</h3>
          <p class="mt-2 text-sm text-slate-500">연결된 사람을 분류 없이 보관하고, 필요한 그룹에만 나눠서 관리할 수 있습니다.</p>
        </div>
        <div class="grid min-w-[240px] flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs font-semibold text-slate-400">연결</p>
            <p class="mt-2 text-2xl font-bold text-slate-900">{{ relationshipCount }}</p>
          </article>
          <article class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs font-semibold text-slate-400">그룹</p>
            <p class="mt-2 text-2xl font-bold text-slate-900">{{ groupCount }}</p>
          </article>
          <article class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs font-semibold text-slate-400">미분류</p>
            <p class="mt-2 text-2xl font-bold text-slate-900">{{ uncategorizedCount }}</p>
          </article>
          <article class="rounded-2xl bg-slate-50 px-4 py-3">
            <p class="text-xs font-semibold text-slate-400">대기 중 요청</p>
            <p class="mt-2 text-2xl font-bold text-slate-900">{{ pendingRequestCount }}</p>
          </article>
        </div>
      </div>
      <p v-if="successMessage" class="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{{ successMessage }}</p>
      <p v-if="errorMessage" class="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{{ errorMessage }}</p>
    </section>

    <section ref="requestSectionRef" class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 class="text-lg font-bold text-slate-900">요청 현황</h4>
          <p class="mt-1 text-sm text-slate-500">대기 중인 요청만 표시됩니다. 수락하거나 거절되면 목록에서 바로 사라집니다.</p>
        </div>
        <span class="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">대기중 {{ pendingRequestCount }}</span>
      </div>

      <div v-if="isLoading" class="mt-4 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">요청 정보를 불러오는 중입니다.</div>
      <div v-else class="mt-4 grid gap-4 xl:grid-cols-2">
        <article class="rounded-2xl border border-slate-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h5 class="text-base font-semibold text-slate-900">받은 요청</h5>
              <p class="mt-1 text-sm text-slate-500">연결 요청과 그룹 초대를 바로 처리할 수 있습니다.</p>
            </div>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{{ incomingPendingRequestItems.length }}건</span>
          </div>

          <div v-if="pagedIncomingRequestItems.length === 0" class="mt-4 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">대기 중인 받은 요청이 없습니다.</div>
          <div v-else class="mt-4 space-y-3">
            <article v-for="item in pagedIncomingRequestItems" :key="item.id" class="rounded-2xl border border-slate-200 px-4 py-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{{ item.kind === "relationship" ? "연결" : "그룹" }}</span>
                    <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">대기중</span>
                    <span class="text-xs text-slate-400">{{ formatDate(item.createdAt) }}</span>
                  </div>
                  <h6 class="mt-2 text-base font-semibold text-slate-900">{{ item.title }}</h6>
                  <p class="mt-1 text-sm text-slate-600">{{ item.summary }}</p>
                  <p class="mt-1 text-xs text-slate-400">{{ item.detail }}</p>
                </div>
                <div class="flex gap-2">
                  <button type="button" class="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-300" :disabled="isBusy(`accept-${item.id}`)" @click="handleRequestAction(item, 'accept')">{{ isBusy(`accept-${item.id}`) ? "처리 중..." : "수락" }}</button>
                  <button type="button" class="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60" :disabled="isBusy(`reject-${item.id}`)" @click="handleRequestAction(item, 'reject')">{{ isBusy(`reject-${item.id}`) ? "처리 중..." : "거절" }}</button>
                </div>
              </div>
            </article>
          </div>

          <div v-if="incomingRequestPageCount > 1" class="mt-4 flex items-center justify-end gap-2">
            <button type="button" class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-40" :disabled="incomingRequestPage === 1" @click="incomingRequestPage -= 1">이전</button>
            <span class="text-sm font-semibold text-slate-500">{{ incomingRequestPage }} / {{ incomingRequestPageCount }}</span>
            <button type="button" class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-40" :disabled="incomingRequestPage === incomingRequestPageCount" @click="incomingRequestPage += 1">다음</button>
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h5 class="text-base font-semibold text-slate-900">보낸 요청</h5>
              <p class="mt-1 text-sm text-slate-500">상대가 아직 처리하지 않은 요청만 표시됩니다.</p>
            </div>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{{ outgoingPendingRequestItems.length }}건</span>
          </div>

          <div v-if="pagedOutgoingRequestItems.length === 0" class="mt-4 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">대기 중인 보낸 요청이 없습니다.</div>
          <div v-else class="mt-4 space-y-3">
            <article v-for="item in pagedOutgoingRequestItems" :key="item.id" class="rounded-2xl border border-slate-200 px-4 py-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{{ item.kind === "relationship" ? "연결" : "그룹" }}</span>
                    <span class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">대기중</span>
                    <span class="text-xs text-slate-400">{{ formatDate(item.createdAt) }}</span>
                  </div>
                  <h6 class="mt-2 text-base font-semibold text-slate-900">{{ item.title }}</h6>
                  <p class="mt-1 text-sm text-slate-600">{{ item.summary }}</p>
                  <p class="mt-1 text-xs text-slate-400">{{ item.detail }}</p>
                </div>
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">상대 응답 대기</span>
              </div>
            </article>
          </div>

          <div v-if="outgoingRequestPageCount > 1" class="mt-4 flex items-center justify-end gap-2">
            <button type="button" class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-40" :disabled="outgoingRequestPage === 1" @click="outgoingRequestPage -= 1">이전</button>
            <span class="text-sm font-semibold text-slate-500">{{ outgoingRequestPage }} / {{ outgoingRequestPageCount }}</span>
            <button type="button" class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-40" :disabled="outgoingRequestPage === outgoingRequestPageCount" @click="outgoingRequestPage += 1">다음</button>
          </div>
        </article>
      </div>
    </section>

    <div class="grid gap-5 xl:grid-cols-2">
      <section ref="inviteSectionRef" class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h4 class="text-lg font-bold text-slate-900">새 연결 초대</h4>
        <p class="mt-1 text-sm text-slate-500">이메일로 연결을 요청하면 수락 전까지는 미분류 인원으로 대기합니다.</p>
        <form class="mt-4 space-y-3" @submit.prevent="handleCreateInvite">
          <input v-model="inviteEmail" type="email" maxlength="120" class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="초대할 이메일" />
          <button type="submit" class="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-sky-300" :disabled="isBusy('create-invite')">{{ isBusy("create-invite") ? "보내는 중..." : "연결 요청 보내기" }}</button>
        </form>
      </section>

      <section ref="createSectionRef" class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h4 class="text-lg font-bold text-slate-900">새 그룹 만들기</h4>
        <p class="mt-1 text-sm text-slate-500">그룹은 내 계정 기준으로만 분류되며, 미분류 인원을 원하는 그룹으로 따로 나눌 수 있습니다.</p>
        <form class="mt-4 space-y-3" @submit.prevent="handleCreateGroup">
          <input v-model="groupName" type="text" maxlength="80" class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="예: 디자인팀, 자주 협업" />
          <button type="submit" class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400" :disabled="isBusy('create-group')">{{ isBusy("create-group") ? "생성 중..." : "그룹 만들기" }}</button>
        </form>
      </section>
    </div>

    <section ref="manageSectionRef" class="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-lg font-bold text-slate-900">미분류 인원</h4>
            <p class="mt-1 text-sm text-slate-500">연결은 되었지만 아직 어떤 그룹에도 속하지 않은 인원입니다.</p>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{{ uncategorizedRelationships.length }}명</span>
        </div>

        <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h5 class="text-base font-semibold text-slate-900">연결된 사람</h5>
              <p class="mt-1 text-sm text-slate-500">현재 연결된 사람은 여기서 바로 연결 해제를 할 수 있습니다.</p>
            </div>
            <span class="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">{{ allRelationships.length }}명</span>
          </div>

          <div v-if="allRelationships.length === 0" class="mt-4 rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500">아직 연결된 사람이 없습니다.</div>
          <div v-else class="mt-4 space-y-2">
            <article v-for="relationship in allRelationships" :key="`all-${relationship.relationshipId}`" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-slate-900">{{ relationship.targetUser?.name || "이름 없음" }}</p>
                <p class="mt-1 truncate text-xs text-slate-500">{{ relationship.targetUser?.email || "-" }}</p>
              </div>
              <button type="button" class="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60" :disabled="isBusy(`delete-${relationship.relationshipId}`)" @click="handleDeleteRelationship(relationship)">{{ isBusy(`delete-${relationship.relationshipId}`) ? "해제 중..." : "연결 해제" }}</button>
            </article>
          </div>
        </div>

        <div v-if="uncategorizedRelationships.length === 0" class="mt-4 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">미분류 인원이 없습니다.</div>
        <div v-else class="mt-4 space-y-3">
          <article v-for="relationship in uncategorizedRelationships" :key="relationship.relationshipId" class="rounded-2xl border border-slate-200 px-4 py-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h5 class="text-base font-semibold text-slate-900">{{ relationship.targetUser?.name || "이름 없음" }}</h5>
                <p class="mt-1 text-sm text-slate-500">{{ relationship.targetUser?.email || "-" }}</p>
                <p class="mt-1 text-xs text-slate-400">연결일 {{ formatDate(relationship.createdAt) }}</p>
              </div>
              <button type="button" class="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60" :disabled="isBusy(`delete-${relationship.relationshipId}`)" @click="handleDeleteRelationship(relationship)">{{ isBusy(`delete-${relationship.relationshipId}`) ? "해제 중..." : "연결 해제" }}</button>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <select v-model="uncategorizedSelections[relationship.relationshipId]" class="min-w-[180px] rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300">
                <option value="">추가할 그룹 선택</option>
                <option v-for="group in availableGroupsForRelationship(relationship)" :key="group.groupId" :value="group.groupId">{{ group.name }}</option>
              </select>
              <button type="button" class="rounded-2xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-sky-300" :disabled="isBusy(`add-${relationship.relationshipId}-${uncategorizedSelections[relationship.relationshipId]}`)" @click="handleAddRelationshipToGroup(relationship.relationshipId, uncategorizedSelections[relationship.relationshipId])">그룹에 추가</button>
            </div>
          </article>
        </div>
      </div>

      <div class="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-lg font-bold text-slate-900">그룹 관리</h4>
            <p class="mt-1 text-sm text-slate-500">그룹 이름 변경, 삭제, 인원 추가/제외, 승인 요청 초대까지 한 곳에서 관리합니다.</p>
          </div>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{{ groups.length }}개</span>
        </div>

        <div v-if="groups.length === 0" class="mt-4 rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">먼저 그룹을 만들어 주세요.</div>
        <div v-else class="mt-4 space-y-4">
          <article v-for="group in groups" :key="group.groupId" class="rounded-[1.4rem] border border-slate-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <template v-if="editingGroupId === group.groupId">
                  <div class="flex flex-wrap gap-2">
                    <input v-model="editingGroupName" type="text" maxlength="80" class="min-w-[220px] flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300" />
                    <button type="button" class="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-400" :disabled="isBusy(`rename-${group.groupId}`)" @click="handleRenameGroup(group.groupId)">{{ isBusy(`rename-${group.groupId}`) ? "저장 중..." : "저장" }}</button>
                    <button type="button" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50" @click="cancelRenameGroup">취소</button>
                  </div>
                </template>
                <template v-else>
                  <div class="flex flex-wrap items-center gap-2">
                    <h5 class="truncate text-base font-semibold text-slate-900">{{ group.name }}</h5>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{{ group.relationshipCount }}명</span>
                  </div>
                  <p class="mt-1 text-xs text-slate-400">생성일 {{ formatDate(group.createdAt) }}</p>
                </template>
              </div>
              <div class="flex flex-wrap gap-2">
                <button v-if="editingGroupId !== group.groupId" type="button" class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50" @click="startRenameGroup(group)">이름 변경</button>
                <button type="button" class="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60" :disabled="isBusy(`delete-group-${group.groupId}`)" @click="handleDeleteGroup(group)">{{ isBusy(`delete-group-${group.groupId}`) ? "삭제 중..." : "그룹 삭제" }}</button>
              </div>
            </div>

            <div class="mt-4 rounded-2xl bg-slate-50 p-3">
              <div class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <select v-model="groupCandidateSelections[group.groupId]" class="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300">
                  <option value="">추가할 인원 선택</option>
                  <option v-for="relationship in availableRelationshipsForGroup(group.groupId)" :key="relationship.relationshipId" :value="relationship.relationshipId">{{ relationship.targetUser?.name }} · {{ relationship.targetUser?.email }}</option>
                </select>
                <button type="button" class="rounded-2xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:bg-sky-300" :disabled="isBusy(`group-card-add-${group.groupId}`)" @click="handleAddPersonToGroupCard(group.groupId)">{{ isBusy(`group-card-add-${group.groupId}`) ? "추가 중..." : "바로 추가" }}</button>
                <button type="button" class="rounded-2xl border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60" :disabled="isBusy(`group-invite-${group.groupId}`)" @click="handleSendGroupInvite(group.groupId)">{{ isBusy(`group-invite-${group.groupId}`) ? "전송 중..." : "승인 요청" }}</button>
              </div>
            </div>

            <div v-if="(groupDetailMap.get(group.groupId)?.relationships || []).length === 0" class="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">아직 이 그룹에 배정된 사람이 없습니다.</div>
            <div v-else class="mt-4 space-y-3">
              <article v-for="relationship in groupDetailMap.get(group.groupId)?.relationships || []" :key="`${group.groupId}-${relationship.relationshipId}`" class="rounded-2xl border border-slate-200 px-4 py-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h6 class="text-sm font-semibold text-slate-900">{{ relationship.targetUser?.name || "이름 없음" }}</h6>
                    <p class="mt-1 text-sm text-slate-500">{{ relationship.targetUser?.email || "-" }}</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span v-for="tag in relationship.groups || []" :key="`${relationship.relationshipId}-${tag.groupId}`" class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {{ tag.groupName }}
                        <button type="button" class="text-slate-400 hover:text-rose-500" :disabled="isBusy(`remove-${relationship.relationshipId}-${tag.groupId}`)" @click="handleRemoveRelationshipFromGroup(relationship.relationshipId, tag.groupId)">x</button>
                      </span>
                    </div>
                  </div>
                  <button type="button" class="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60" :disabled="isBusy(`delete-${relationship.relationshipId}`)" @click="handleDeleteRelationship(relationship)">{{ isBusy(`delete-${relationship.relationshipId}`) ? "해제 중..." : "연결 해제" }}</button>
                </div>
              </article>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
