<script setup>
import { computed, onMounted, ref } from "vue";
import {
  fetchAdministratorDashboard,
  fetchAdministratorStorageAnalytics,
  updateAdministratorStorageCapacity,
  updateAdministratorUserStatus,
} from "@/api/administratorApi";

const dashboard = ref(null);
const storageAnalytics = ref(null);
const isLoading = ref(false);
const isStorageLoading = ref(false);
const isUpdating = ref(false);
const isCapacitySaving = ref(false);
const isCapacityEditing = ref(false);
const errorMessage = ref("");
const storageErrorMessage = ref("");
const searchQuery = ref("");
const statusFilter = ref("ALL");
const storageDisplayUnit = ref("GB");
const storageRangeCode = ref("24H");
const providerCapacityValue = ref("50");
const providerCapacityUnit = ref("TB");
const activeSection = ref("users");

const DISPLAY_UNITS = [
  { label: "B", value: "B", bytes: 1 },
  { label: "KB", value: "KB", bytes: 1024 },
  { label: "MB", value: "MB", bytes: 1024 ** 2 },
  { label: "GB", value: "GB", bytes: 1024 ** 3 },
  { label: "TB", value: "TB", bytes: 1024 ** 4 },
  { label: "PB", value: "PB", bytes: 1024 ** 5 },
];

const VISUAL_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444"];

const STORAGE_RANGE_OPTIONS = [
  { label: "1시간", value: "1H" },
  { label: "12시간", value: "12H" },
  { label: "24시간", value: "24H" },
  { label: "1일", value: "1D" },
  { label: "3일", value: "3D" },
  { label: "7일", value: "7D" },
  { label: "4주", value: "4W" },
];

const ADMIN_SECTIONS = [
  { value: "users", label: "사용자 관리" },
  { value: "storage", label: "스토리지 통계 및 분석" },
  { value: "plans", label: "플랜 / 결제 비중 통계 분석" },
];

const formatBytesAuto = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const formatBytesByUnit = (bytes, unit = storageDisplayUnit.value) => {
  const selectedUnit = DISPLAY_UNITS.find((item) => item.value === unit) || DISPLAY_UNITS[3];
  const size = Number(bytes || 0);
  if (!Number.isFinite(size)) {
    return `0 ${selectedUnit.label}`;
  }

  const value = size / selectedUnit.bytes;
  const fractionDigits = selectedUnit.value === "B" ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${selectedUnit.label}`;
};

const percentValue = (numerator, denominator) => {
  const safeDenominator = Number(denominator || 0);
  if (!Number.isFinite(safeDenominator) || safeDenominator <= 0) {
    return 0;
  }

  const safeNumerator = Number(numerator || 0);
  return Math.round((safeNumerator * 10000) / safeDenominator) / 100;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

const clampPercent = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numericValue));
};

const buildRingStyle = (percent, color) => ({
  background: `conic-gradient(${color} 0 ${clampPercent(percent)}%, var(--bg-input) ${clampPercent(percent)}% 100%)`,
});

const applyCapacityInputFromBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    providerCapacityValue.value = "50";
    providerCapacityUnit.value = "TB";
    return;
  }

  const preferredUnit = DISPLAY_UNITS.slice().reverse().find((unit) => size >= unit.bytes) || DISPLAY_UNITS[0];
  providerCapacityUnit.value = preferredUnit.value;
  providerCapacityValue.value = String(Number((size / preferredUnit.bytes).toFixed(preferredUnit.value === "B" ? 0 : 2)));
};

const summaryCards = computed(() => {
  const summary = dashboard.value?.summary;
  if (!summary) return [];

  return [
    { label: "전체 사용자", value: `${summary.totalUserCount}명` },
    { label: "활성 사용자", value: `${summary.activeUserCount}명` },
    { label: "정지 사용자", value: `${summary.suspendedUserCount}명` },
    { label: "차단 사용자", value: `${summary.bannedUserCount}명` },
    { label: "전체 사용 용량", value: formatBytesAuto(summary.totalUsedBytes) },
    { label: "전체 파일 수", value: `${summary.totalFileCount}개` },
    { label: "전체 폴더 수", value: `${summary.totalFolderCount}개` },
    { label: "전체 사용 비율", value: formatPercent(summary.overallUsagePercent) },
  ];
});

const storageSummaryCards = computed(() => {
  const summary = storageAnalytics.value?.summary;
  if (!summary) return [];

  return [
    { label: "집계 기간", value: storageAnalytics.value?.window?.rangeLabel || "-" },
    { label: "서비스 총 용량", value: formatBytesByUnit(summary.providerCapacityBytes) },
    { label: "현재 저장 데이터", value: formatBytesByUnit(summary.providerUsedBytes) },
    { label: "남은 서비스 용량", value: formatBytesByUnit(summary.providerRemainingBytes) },
    { label: "서비스 사용률", value: formatPercent(summary.providerUsagePercent) },
    { label: "일반 사용자 할당 총량", value: formatBytesByUnit(summary.allocatedUserQuotaBytes) },
    { label: "일반 사용자 사용량", value: formatBytesByUnit(summary.allocatedUserUsedBytes) },
    { label: "총 입력량", value: formatBytesByUnit(summary.totalIngressBytes) },
    { label: "총 출력량", value: formatBytesByUnit(summary.totalEgressBytes) },
    { label: "완료 업로드량", value: formatBytesByUnit(summary.completedIngressBytes) },
    { label: "취소/정리 업로드량", value: formatBytesByUnit(summary.canceledIngressBytes) },
  ];
});

const storageBreakdownCards = computed(() => {
  return (storageAnalytics.value?.storageBreakdown || []).map((item) => ({
    ...item,
    formattedBytes: formatBytesByUnit(item.storedBytes),
  }));
});

const transferBreakdownRows = computed(() => {
  return (storageAnalytics.value?.transferBreakdown || []).map((item) => ({
    ...item,
    formattedBytes: formatBytesByUnit(item.bytes),
  }));
});

const storageVisualSummary = computed(() => {
  const summary = storageAnalytics.value?.summary;
  if (!summary) return null;

  const ingressBytes = Number(summary.totalIngressBytes || 0);
  const egressBytes = Number(summary.totalEgressBytes || 0);
  const totalTrafficBytes = ingressBytes + egressBytes;

  return {
    providerUsagePercent: clampPercent(summary.providerUsagePercent),
    allocationPercent: clampPercent(percentValue(summary.allocatedUserQuotaBytes, summary.providerCapacityBytes)),
    ingressPercent: clampPercent(percentValue(ingressBytes, totalTrafficBytes)),
    egressPercent: clampPercent(percentValue(egressBytes, totalTrafficBytes)),
    completedIngressPercent: clampPercent(percentValue(summary.completedIngressBytes, ingressBytes)),
    canceledIngressPercent: clampPercent(percentValue(summary.canceledIngressBytes, ingressBytes)),
    providerUsedLabel: formatBytesByUnit(summary.providerUsedBytes),
    providerRemainingLabel: formatBytesByUnit(summary.providerRemainingBytes),
    providerCapacityLabel: formatBytesByUnit(summary.providerCapacityBytes),
    allocatedQuotaLabel: formatBytesByUnit(summary.allocatedUserQuotaBytes),
    ingressLabel: formatBytesByUnit(ingressBytes),
    egressLabel: formatBytesByUnit(egressBytes),
    completedIngressLabel: formatBytesByUnit(summary.completedIngressBytes),
    canceledIngressLabel: formatBytesByUnit(summary.canceledIngressBytes),
  };
});

const storageBreakdownVisuals = computed(() => {
  const items = storageBreakdownCards.value;
  const totalBytes = items.reduce((sum, item) => sum + Number(item.storedBytes || 0), 0);

  return items.map((item, index) => ({
    ...item,
    sharePercent: clampPercent(percentValue(item.storedBytes, totalBytes)),
    barWidth: item.storedBytes > 0 ? Math.max(8, clampPercent(percentValue(item.storedBytes, totalBytes))) : 0,
    color: VISUAL_COLORS[index % VISUAL_COLORS.length],
  }));
});

const transferVisualGroups = computed(() => {
  const grouped = transferBreakdownRows.value.reduce((map, row) => {
    const directionKey = row.direction || "UNKNOWN";
    if (!map.has(directionKey)) {
      map.set(directionKey, []);
    }
    map.get(directionKey).push(row);
    return map;
  }, new Map());

  return Array.from(grouped.entries()).map(([direction, rows], directionIndex) => {
    const totalBytes = rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);

    return {
      direction,
      totalBytes,
      totalLabel: formatBytesByUnit(totalBytes),
      items: rows
        .slice()
        .sort((left, right) => Number(right.bytes || 0) - Number(left.bytes || 0))
        .map((row, rowIndex) => ({
          ...row,
          sharePercent: clampPercent(percentValue(row.bytes, totalBytes)),
          barWidth: row.bytes > 0 ? Math.max(8, clampPercent(percentValue(row.bytes, totalBytes))) : 0,
          color: VISUAL_COLORS[(directionIndex + rowIndex) % VISUAL_COLORS.length],
        })),
    };
  });
});

const topStorageUsers = computed(() => {
  const users = storageUsers.value
    .slice()
    .sort((left, right) => Number(right.currentStoredBytes || 0) - Number(left.currentStoredBytes || 0))
    .slice(0, 5);

  const maxStoredBytes = users.reduce((maxValue, user) => (
    Math.max(maxValue, Number(user.currentStoredBytes || 0))
  ), 0);

  return users.map((user, index) => ({
    ...user,
    sharePercent: clampPercent(percentValue(user.currentStoredBytes, maxStoredBytes)),
    barWidth: user.currentStoredBytes > 0 ? Math.max(8, clampPercent(percentValue(user.currentStoredBytes, maxStoredBytes))) : 0,
    combinedTrafficLabel: formatBytesByUnit(Number(user.totalIngressBytes || 0) + Number(user.totalEgressBytes || 0)),
    color: VISUAL_COLORS[index % VISUAL_COLORS.length],
  }));
});

const filteredUsers = computed(() => {
  const users = dashboard.value?.users || [];
  const query = searchQuery.value.trim().toLowerCase();

  return users
    .filter((user) => {
      if (statusFilter.value !== "ALL" && user.accountStatus !== statusFilter.value) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.id, user.name, user.role, user.planLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((left, right) => Number(right.usedBytes || 0) - Number(left.usedBytes || 0));
});

const storageUsers = computed(() => {
  return (storageAnalytics.value?.users || []).map((user) => ({
    ...user,
    quotaLabel: formatBytesByUnit(user.quotaBytes),
    storedLabel: formatBytesByUnit(user.currentStoredBytes),
    ingressLabel: formatBytesByUnit(user.totalIngressBytes),
    completedIngressLabel: formatBytesByUnit(user.completedIngressBytes),
    canceledIngressLabel: formatBytesByUnit(user.canceledIngressBytes),
    egressLabel: formatBytesByUnit(user.totalEgressBytes),
  }));
});

const planStats = computed(() => {
  return (dashboard.value?.planStats || [])
    .filter((plan) => plan.planCode !== "ADMIN")
    .sort((left, right) => Number(right.userCount || 0) - Number(left.userCount || 0));
});

const planSummaryCards = computed(() => {
  const plans = planStats.value;
  if (!plans.length) {
    return [];
  }

  const totalUsers = plans.reduce((sum, plan) => sum + Number(plan.userCount || 0), 0);
  const paidUsers = plans
    .filter((plan) => plan.planCode !== "FREE")
    .reduce((sum, plan) => sum + Number(plan.userCount || 0), 0);
  const freeUsers = plans
    .filter((plan) => plan.planCode === "FREE")
    .reduce((sum, plan) => sum + Number(plan.userCount || 0), 0);
  const paidUsedBytes = plans
    .filter((plan) => plan.planCode !== "FREE")
    .reduce((sum, plan) => sum + Number(plan.usedBytes || 0), 0);
  const paidQuotaBytes = plans
    .filter((plan) => plan.planCode !== "FREE")
    .reduce((sum, plan) => sum + Number(plan.quotaBytes || 0), 0);

  return [
    { label: "분석 대상 사용자", value: `${totalUsers}명` },
    { label: "무료 플랜 사용자", value: `${freeUsers}명` },
    { label: "유료 플랜 사용자", value: `${paidUsers}명` },
    { label: "결제 전환 비중", value: formatPercent(percentValue(paidUsers, totalUsers)) },
    { label: "유료 플랜 사용량", value: formatBytesAuto(paidUsedBytes) },
    { label: "유료 플랜 할당량", value: formatBytesAuto(paidQuotaBytes) },
  ];
});

const paymentMixCards = computed(() => {
  const plans = planStats.value;
  if (!plans.length) {
    return [];
  }

  const totalUsers = plans.reduce((sum, plan) => sum + Number(plan.userCount || 0), 0);
  const freeUsers = plans
    .filter((plan) => plan.planCode === "FREE")
    .reduce((sum, plan) => sum + Number(plan.userCount || 0), 0);
  const paidUsers = plans
    .filter((plan) => plan.planCode !== "FREE")
    .reduce((sum, plan) => sum + Number(plan.userCount || 0), 0);
  const freeUsedBytes = plans
    .filter((plan) => plan.planCode === "FREE")
    .reduce((sum, plan) => sum + Number(plan.usedBytes || 0), 0);
  const paidUsedBytes = plans
    .filter((plan) => plan.planCode !== "FREE")
    .reduce((sum, plan) => sum + Number(plan.usedBytes || 0), 0);

  return [
    {
      label: "무료 사용자 비중",
      subLabel: `${freeUsers}명`,
      usageLabel: formatPercent(percentValue(freeUsers, totalUsers)),
      detail: formatBytesAuto(freeUsedBytes),
    },
    {
      label: "유료 사용자 비중",
      subLabel: `${paidUsers}명`,
      usageLabel: formatPercent(percentValue(paidUsers, totalUsers)),
      detail: formatBytesAuto(paidUsedBytes),
    },
  ];
});

const planRows = computed(() => {
  return planStats.value.map((plan) => ({
    ...plan,
    planTypeLabel: plan.planCode === "FREE" ? "무료" : "유료",
    userPercentLabel: formatPercent(plan.userPercent),
    usagePercentLabel: formatPercent(plan.usagePercent),
    usedBytesLabel: formatBytesAuto(plan.usedBytes),
    quotaBytesLabel: formatBytesAuto(plan.quotaBytes),
  }));
});

const loadDashboard = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    dashboard.value = await fetchAdministratorDashboard();
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "관리자 대시보드를 불러오지 못했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const loadStorageAnalytics = async () => {
  isStorageLoading.value = true;
  storageErrorMessage.value = "";

  try {
    const result = await fetchAdministratorStorageAnalytics(storageRangeCode.value);
    storageAnalytics.value = result;
    applyCapacityInputFromBytes(result?.summary?.providerCapacityBytes);
    isCapacityEditing.value = false;
  } catch (error) {
    storageErrorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "스토리지 통계를 불러오지 못했습니다.";
  } finally {
    isStorageLoading.value = false;
  }
};

const handleStorageRangeChange = async () => {
  await loadStorageAnalytics();
};

const loadAll = async () => {
  await Promise.all([loadDashboard(), loadStorageAnalytics()]);
};

const applyUpdatedUserToDashboard = (updatedUser) => {
  if (!updatedUser?.idx || !dashboard.value?.users) {
    return;
  }

  const previousUser = dashboard.value.users.find((user) => user.idx === updatedUser.idx);
  if (!previousUser) {
    return;
  }

  const users = dashboard.value.users.map((user) =>
    user.idx === updatedUser.idx ? { ...user, ...updatedUser } : user,
  );

  let summary = dashboard.value.summary;
  const previousStatus = previousUser.accountStatus || "ACTIVE";
  const nextStatus = updatedUser.accountStatus || previousStatus;

  if (summary && previousStatus !== nextStatus) {
    summary = { ...summary };

    const decrementKeyByStatus = {
      ACTIVE: "activeUserCount",
      SUSPENDED: "suspendedUserCount",
      BANNED: "bannedUserCount",
    };
    const incrementKeyByStatus = decrementKeyByStatus;

    const previousKey = decrementKeyByStatus[previousStatus];
    const nextKey = incrementKeyByStatus[nextStatus];

    if (previousKey && typeof summary[previousKey] === "number") {
      summary[previousKey] = Math.max(0, summary[previousKey] - 1);
    }
    if (nextKey && typeof summary[nextKey] === "number") {
      summary[nextKey] += 1;
    }
  }

  dashboard.value = {
    ...dashboard.value,
    users,
    summary,
  };
};

const handleStatusChange = async (user, nextStatus) => {
  if (!user?.idx || user.accountStatus === nextStatus || user.id === "administrator@administrator.adm") {
    return;
  }

  isUpdating.value = true;
  errorMessage.value = "";

  try {
    const updatedUser = await updateAdministratorUserStatus(user.idx, nextStatus);
    applyUpdatedUserToDashboard(updatedUser);
    await loadDashboard();
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "사용자 상태를 변경하지 못했습니다.";
  } finally {
    isUpdating.value = false;
  }
};

const startCapacityEditing = () => {
  applyCapacityInputFromBytes(storageAnalytics.value?.summary?.providerCapacityBytes);
  isCapacityEditing.value = true;
};

const cancelCapacityEditing = () => {
  applyCapacityInputFromBytes(storageAnalytics.value?.summary?.providerCapacityBytes);
  isCapacityEditing.value = false;
};

const handleCapacitySave = async () => {
  const numericValue = Number(providerCapacityValue.value);
  const unit = DISPLAY_UNITS.find((item) => item.value === providerCapacityUnit.value);
  if (!Number.isFinite(numericValue) || numericValue <= 0 || !unit) {
    storageErrorMessage.value = "서비스 총 용량 값을 올바르게 입력해 주세요.";
    return;
  }

  isCapacitySaving.value = true;
  storageErrorMessage.value = "";

  try {
    const result = await updateAdministratorStorageCapacity(
      Math.round(numericValue * unit.bytes),
      storageRangeCode.value,
    );
    storageAnalytics.value = result;
    applyCapacityInputFromBytes(result?.summary?.providerCapacityBytes);
    isCapacityEditing.value = false;
  } catch (error) {
    storageErrorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "서비스 총 용량을 저장하지 못했습니다.";
  } finally {
    isCapacitySaving.value = false;
  }
};

const statusBadgeClass = (status) => {
  switch (status) {
    case "ACTIVE":
      return "admin-badge admin-badge--active";
    case "SUSPENDED":
      return "admin-badge admin-badge--suspended";
    case "BANNED":
      return "admin-badge admin-badge--banned";
    default:
      return "admin-badge";
  }
};

onMounted(() => {
  loadAll();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Administrator</p>
        <h1 class="admin-page__title">관리자 페이지</h1>
        <p class="admin-page__description">
          사용자 관리, 스토리지 통계 및 분석, 플랜 및 결제 비중 통계를 각각 선택해서 확인할 수 있습니다.
        </p>
      </div>

      <button
        type="button"
        class="admin-page__refresh"
        :disabled="isLoading || isStorageLoading || isUpdating || isCapacitySaving"
        @click="loadAll"
      >
        새로고침
      </button>
    </div>

    <section class="admin-panel admin-panel--selector">
      <div class="admin-view-tabs">
        <button
          v-for="section in ADMIN_SECTIONS"
          :key="section.value"
          type="button"
          class="admin-tab"
          :class="{ 'admin-tab--active': activeSection === section.value }"
          @click="activeSection = section.value"
        >
          {{ section.label }}
        </button>
      </div>
    </section>

    <div v-if="errorMessage" class="admin-alert">
      {{ errorMessage }}
    </div>

    <div v-if="storageErrorMessage" class="admin-alert admin-alert--info">
      {{ storageErrorMessage }}
    </div>

    <div v-if="(isLoading && !dashboard) || (isStorageLoading && !storageAnalytics)" class="admin-panel admin-panel--empty">
      관리자 데이터를 불러오는 중입니다.
    </div>

    <template v-else>
      <section v-if="activeSection === 'users' && dashboard" class="admin-layout admin-layout--stack">
        <section class="admin-summary-grid">
          <article v-for="card in summaryCards" :key="card.label" class="admin-card">
            <p class="admin-card__label">{{ card.label }}</p>
            <p class="admin-card__value">{{ card.value }}</p>
          </article>
        </section>

        <section class="admin-panel">
          <div class="admin-panel__header">
            <div>
              <h2 class="admin-panel__title">사용자 관리</h2>
              <p class="admin-panel__description">
                계정 상태와 플랜, 용량 사용률을 확인하고 활성, 정지, 차단 상태를 관리합니다.
              </p>
            </div>
          </div>

          <div class="admin-toolbar">
            <input
              v-model="searchQuery"
              type="search"
              class="admin-input"
              placeholder="email, 이름, 역할, 플랜 검색"
            />

            <select v-model="statusFilter" class="admin-select">
              <option value="ALL">전체 상태</option>
              <option value="ACTIVE">활성</option>
              <option value="SUSPENDED">정지</option>
              <option value="BANNED">차단</option>
            </select>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>이름</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>플랜</th>
                  <th>용량</th>
                  <th>파일/폴더</th>
                  <th>공유</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in filteredUsers" :key="user.idx">
                  <td class="admin-table__strong">{{ user.id }}</td>
                  <td>{{ user.name || "-" }}</td>
                  <td>{{ user.role }}</td>
                  <td>
                    <span :class="statusBadgeClass(user.accountStatus)">{{ user.accountStatus }}</span>
                  </td>
                  <td>{{ user.planLabel }}</td>
                  <td>
                    <div>{{ formatBytesAuto(user.usedBytes) }}</div>
                    <div class="admin-table__muted">{{ formatPercent(user.usagePercent) }}</div>
                  </td>
                  <td>{{ user.fileCount }} / {{ user.folderCount }}</td>
                  <td>{{ user.sharedFileCount }}</td>
                  <td>
                    <div class="admin-actions">
                      <button
                        type="button"
                        class="admin-action admin-action--active"
                        :disabled="isUpdating || user.id === 'administrator@administrator.adm' || user.accountStatus === 'ACTIVE'"
                        @click="handleStatusChange(user, 'ACTIVE')"
                      >
                        활성
                      </button>
                      <button
                        type="button"
                        class="admin-action admin-action--suspended"
                        :disabled="isUpdating || user.id === 'administrator@administrator.adm' || user.accountStatus === 'SUSPENDED'"
                        @click="handleStatusChange(user, 'SUSPENDED')"
                      >
                        정지
                      </button>
                      <button
                        type="button"
                        class="admin-action admin-action--banned"
                        :disabled="isUpdating || user.id === 'administrator@administrator.adm' || user.accountStatus === 'BANNED'"
                        @click="handleStatusChange(user, 'BANNED')"
                      >
                        차단
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section v-else-if="activeSection === 'storage' && storageAnalytics" class="admin-panel">
        <div class="admin-panel__header">
          <div>
            <h2 class="admin-panel__title">스토리지 통계 및 분석</h2>
            <p class="admin-panel__description">
              MinIO 업로드 데이터와 백엔드 추적 다운로드 데이터를 기준으로 실제 스토리지 사용량과 입출력량을 집계합니다.
            </p>
          </div>

          <div class="admin-toolbar admin-toolbar--compact">
            <label class="admin-field">
              <span class="admin-field__label">집계 기간</span>
              <select v-model="storageRangeCode" class="admin-select" @change="handleStorageRangeChange">
                <option v-for="range in STORAGE_RANGE_OPTIONS" :key="range.value" :value="range.value">{{ range.label }}</option>
              </select>
            </label>
            <label class="admin-field">
              <span class="admin-field__label">표시 단위</span>
              <select v-model="storageDisplayUnit" class="admin-select">
                <option v-for="unit in DISPLAY_UNITS" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="admin-storage-grid">
          <article v-for="card in storageSummaryCards" :key="card.label" class="admin-card">
            <p class="admin-card__label">{{ card.label }}</p>
            <p class="admin-card__value">{{ card.value }}</p>
          </article>
        </div>

        <div v-if="storageVisualSummary" class="admin-visual-grid">
          <article class="admin-panel admin-panel--inset admin-visual-card">
            <div class="admin-panel__header">
              <div>
                <h3 class="admin-panel__title">가용 가능한 총량</h3>
                <p class="admin-panel__description">
                  시스템에서 설정해서 가용가능한 총량을 정리.
                </p>
              </div>
            </div>

            <div class="admin-visual-card__body admin-visual-card__body--split">
              <div class="admin-visual-ring" :style="buildRingStyle(storageVisualSummary.providerUsagePercent, VISUAL_COLORS[0])">
                <div class="admin-visual-ring__inner">
                  <span class="admin-visual-ring__value">{{ formatPercent(storageVisualSummary.providerUsagePercent) }}</span>
                  <span class="admin-visual-ring__label">used</span>
                </div>
              </div>

              <div class="admin-visual-stats">
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Used</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.providerUsedLabel }}</span>
                </div>
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Remaining</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.providerRemainingLabel }}</span>
                </div>
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Allocated quota</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.allocatedQuotaLabel }}</span>
                </div>
              </div>
            </div>

            <div class="admin-visual-meter">
              <div class="admin-visual-meter__meta">
                <span>실제 사용 총량</span>
                <span>{{ storageVisualSummary.providerUsedLabel }} / {{ storageVisualSummary.providerCapacityLabel }}</span>
              </div>
              <div class="admin-progress admin-progress--thick">
                <div class="admin-progress__bar" :style="{ width: `${storageVisualSummary.providerUsagePercent}%` }"></div>
              </div>
            </div>

            <div class="admin-visual-meter">
              <div class="admin-visual-meter__meta">
                <span>할당된 총량</span>
                <span>{{ formatPercent(storageVisualSummary.allocationPercent) }}</span>
              </div>
              <div class="admin-progress admin-progress--thick admin-progress--teal">
                <div class="admin-progress__bar" :style="{ width: `${storageVisualSummary.allocationPercent}%` }"></div>
              </div>
            </div>
          </article>

          <article class="admin-panel admin-panel--inset admin-visual-card">
            <div class="admin-panel__header">
              <div>
                <h3 class="admin-panel__title">저장 장소 방식</h3>
                <p class="admin-panel__description">
                  현재 저장된 데이터의 구분
                </p>
              </div>
            </div>

            <div class="admin-visual-list">
              <div v-for="item in storageBreakdownVisuals" :key="item.source" class="admin-visual-row">
                <div class="admin-visual-row__meta">
                  <div>
                    <p class="admin-visual-row__label">{{ item.label }}</p>
                    <p class="admin-visual-row__sub">{{ item.formattedBytes }}</p>
                  </div>
                  <span class="admin-visual-row__percent">{{ formatPercent(item.sharePercent) }}</span>
                </div>
                <div class="admin-visual-track">
                  <div class="admin-visual-track__bar" :style="{ width: `${item.barWidth}%`, background: item.color }"></div>
                </div>
              </div>
            </div>
          </article>

          <article class="admin-panel admin-panel--inset admin-visual-card">
            <div class="admin-panel__header">
              <div>
                <h3 class="admin-panel__title">데아터 트래픽 흐름</h3>
                <p class="admin-panel__description">
                  선택한 기간의 입력 및 출력 볼륨을 시각적으로 비교할 수 있습니다.
                </p>
              </div>
            </div>

            <div class="admin-visual-card__body admin-visual-card__body--split">
              <div class="admin-visual-ring" :style="buildRingStyle(storageVisualSummary.ingressPercent, VISUAL_COLORS[1])">
                <div class="admin-visual-ring__inner">
                  <span class="admin-visual-ring__value">{{ formatPercent(storageVisualSummary.ingressPercent) }}</span>
                  <span class="admin-visual-ring__label">ingress</span>
                </div>
              </div>

              <div class="admin-visual-stats">
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Ingress</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.ingressLabel }}</span>
                </div>
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Egress</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.egressLabel }}</span>
                </div>
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Completed upload</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.completedIngressLabel }}</span>
                </div>
                <div class="admin-visual-stat">
                  <span class="admin-visual-stat__label">Canceled upload</span>
                  <span class="admin-visual-stat__value">{{ storageVisualSummary.canceledIngressLabel }}</span>
                </div>
              </div>
            </div>

            <div class="admin-visual-meter">
              <div class="admin-visual-meter__meta">
                <span>Completed ingress share</span>
                <span>{{ formatPercent(storageVisualSummary.completedIngressPercent) }}</span>
              </div>
              <div class="admin-progress admin-progress--thick">
                <div class="admin-progress__bar" :style="{ width: `${storageVisualSummary.completedIngressPercent}%` }"></div>
              </div>
            </div>

            <div class="admin-visual-meter">
              <div class="admin-visual-meter__meta">
                <span>Canceled ingress share</span>
                <span>{{ formatPercent(storageVisualSummary.canceledIngressPercent) }}</span>
              </div>
              <div class="admin-progress admin-progress--thick admin-progress--warm">
                <div class="admin-progress__bar" :style="{ width: `${storageVisualSummary.canceledIngressPercent}%` }"></div>
              </div>
            </div>

            <div class="admin-visual-group-list">
              <div v-for="group in transferVisualGroups" :key="group.direction" class="admin-visual-group">
                <div class="admin-visual-group__header">
                  <span>{{ group.direction }}</span>
                  <span>{{ group.totalLabel }}</span>
                </div>
                <div class="admin-visual-list admin-visual-list--compact">
                  <div v-for="item in group.items" :key="`${group.direction}-${item.source}-${item.status}`" class="admin-visual-row">
                    <div class="admin-visual-row__meta">
                      <div>
                        <p class="admin-visual-row__label">{{ item.label }}</p>
                        <p class="admin-visual-row__sub">{{ item.status }} · {{ item.formattedBytes }}</p>
                      </div>
                      <span class="admin-visual-row__percent">{{ formatPercent(item.sharePercent) }}</span>
                    </div>
                    <div class="admin-visual-track">
                      <div class="admin-visual-track__bar" :style="{ width: `${item.barWidth}%`, background: item.color }"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article class="admin-panel admin-panel--inset admin-visual-card">
            <div class="admin-panel__header">
              <div>
                <h3 class="admin-panel__title">최고 사용 유저</h3>
                <p class="admin-panel__description">
                  가장 큰 사용량을 가진 유저를 확인
                </p>
              </div>
            </div>

            <div class="admin-visual-list">
              <div v-for="user in topStorageUsers" :key="user.idx" class="admin-visual-row">
                <div class="admin-visual-row__meta">
                  <div>
                    <p class="admin-visual-row__label">{{ user.name || user.id }}</p>
                    <p class="admin-visual-row__sub">{{ user.storedLabel }} · traffic {{ user.combinedTrafficLabel }}</p>
                  </div>
                  <span class="admin-visual-row__percent">{{ formatPercent(user.sharePercent) }}</span>
                </div>
                <div class="admin-visual-track">
                  <div class="admin-visual-track__bar" :style="{ width: `${user.barWidth}%`, background: user.color }"></div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="admin-capacity">
          <div>
            <h3 class="admin-subtitle">서비스 총 용량 설정</h3>
            <p class="admin-subtext">
              기본값은 50TB이며, 이 값을 기준으로 현재 시스템의 전체 사용량과 잔여 용량을 계산합니다.
            </p>
          </div>

          <div v-if="!isCapacityEditing" class="admin-capacity__readonly">
            <div class="admin-capacity__value">
              {{ formatBytesAuto(storageAnalytics.summary?.providerCapacityBytes) }}
            </div>
            <button type="button" class="admin-page__refresh" @click="startCapacityEditing">
              수정하기
            </button>
          </div>

          <div v-else class="admin-capacity__controls">
            <input
              v-model="providerCapacityValue"
              type="number"
              min="1"
              step="0.01"
              class="admin-input admin-input--narrow"
            />
            <select v-model="providerCapacityUnit" class="admin-select admin-select--narrow">
              <option v-for="unit in DISPLAY_UNITS.slice(1)" :key="unit.value" :value="unit.value">{{ unit.label }}</option>
            </select>
            <button type="button" class="admin-page__refresh" :disabled="isCapacitySaving" @click="handleCapacitySave">
              {{ isCapacitySaving ? "저장 중..." : "저장" }}
            </button>
            <button type="button" class="admin-page__secondary" :disabled="isCapacitySaving" @click="cancelCapacityEditing">
              취소
            </button>
          </div>
        </div>

        <div v-if="storageAnalytics.integrity" class="admin-integrity">
          <div
            class="admin-integrity__status"
            :class="storageAnalytics.integrity.healthy ? 'admin-integrity__status--healthy' : 'admin-integrity__status--warning'"
          >
            {{ storageAnalytics.integrity.healthy ? "무결성 정상" : "무결성 점검 필요" }}
          </div>
          <p class="admin-subtext">
            대기 중인 드라이브 예약 용량: {{ formatBytesByUnit(storageAnalytics.integrity.pendingDriveReservationBytes) }}
          </p>
          <ul v-if="storageAnalytics.integrity.issues?.length" class="admin-integrity__list">
            <li v-for="issue in storageAnalytics.integrity.issues" :key="issue">{{ issue }}</li>
          </ul>
          <p v-else class="admin-subtext">
            완료 업로드는 MinIO 실제 객체 크기, 취소 및 만료 업로드는 삭제 직전 실제 남은 크기, 다운로드는 백엔드 스트리밍 전송 바이트 기준으로 집계됩니다.
          </p>
        </div>

        <div class="admin-layout admin-layout--three">
          <div class="admin-panel admin-panel--inset">
            <div class="admin-panel__header">
              <div>
                <h3 class="admin-panel__title">현재 저장 데이터 분포</h3>
                <p class="admin-panel__description">
                  드라이브, 워크스페이스 첨부, 채팅 첨부 기준으로 현재 보관 중인 데이터입니다.
                </p>
              </div>
            </div>

            <div class="admin-plan-list">
              <article v-for="item in storageBreakdownCards" :key="item.source" class="admin-plan-card">
                <div class="admin-plan-card__top">
                  <div>
                    <p class="admin-plan-card__label">{{ item.label }}</p>
                    <p class="admin-plan-card__sub">{{ item.source }}</p>
                  </div>
                  <p class="admin-plan-card__usage">{{ item.formattedBytes }}</p>
                </div>
              </article>
            </div>
          </div>

          <div class="admin-panel admin-panel--inset admin-panel--span-2">
            <div class="admin-panel__header">
              <div>
                <h3 class="admin-panel__title">데이터 입출력 집계</h3>
                <p class="admin-panel__description">
                  업로드 완료, 업로드 취소, 다운로드 전송량을 이벤트 단위로 집계한 표입니다.
                </p>
              </div>
            </div>

            <div class="admin-table-wrap">
              <table class="admin-table admin-table--compact">
                <thead>
                  <tr>
                    <th>방향</th>
                    <th>구분</th>
                    <th>상태</th>
                    <th>이벤트 수</th>
                    <th>데이터량</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in transferBreakdownRows" :key="`${row.direction}-${row.source}-${row.status}`">
                    <td>{{ row.direction }}</td>
                    <td>{{ row.label }}</td>
                    <td>{{ row.status }}</td>
                    <td>{{ row.eventCount }}</td>
                    <td class="admin-table__strong">{{ row.formattedBytes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="admin-panel admin-panel--inset">
          <div class="admin-panel__header">
            <div>
              <h3 class="admin-panel__title">사용자별 스토리지 / 입출력 통계</h3>
              <p class="admin-panel__description">
                관리자 제외 사용자 기준으로 할당량, 현재 저장량, 총 입력량, 총 출력량을 확인합니다.
              </p>
            </div>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>이름</th>
                  <th>플랜</th>
                  <th>할당량</th>
                  <th>현재 저장량</th>
                  <th>총 입력량</th>
                  <th>완료 업로드</th>
                  <th>취소/정리 업로드</th>
                  <th>총 출력량</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in storageUsers" :key="user.idx">
                  <td class="admin-table__strong">{{ user.id }}</td>
                  <td>{{ user.name || "-" }}</td>
                  <td>{{ user.planLabel }}</td>
                  <td>{{ user.quotaLabel }}</td>
                  <td>{{ user.storedLabel }}</td>
                  <td>{{ user.ingressLabel }}</td>
                  <td>{{ user.completedIngressLabel }}</td>
                  <td>{{ user.canceledIngressLabel }}</td>
                  <td>{{ user.egressLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-else-if="activeSection === 'plans' && dashboard" class="admin-layout admin-layout--stack">
        <section class="admin-summary-grid">
          <article v-for="card in planSummaryCards" :key="card.label" class="admin-card">
            <p class="admin-card__label">{{ card.label }}</p>
            <p class="admin-card__value">{{ card.value }}</p>
          </article>
        </section>

        <section class="admin-layout">
          <div class="admin-panel">
            <div class="admin-panel__header">
              <div>
                <h2 class="admin-panel__title">플랜 비중</h2>
                <p class="admin-panel__description">
                  무료와 유료 사용자 비중, 사용량 분포를 한눈에 확인할 수 있습니다.
                </p>
              </div>
            </div>

            <div class="admin-plan-list">
              <article v-for="item in paymentMixCards" :key="item.label" class="admin-plan-card">
                <div class="admin-plan-card__top">
                  <div>
                    <p class="admin-plan-card__label">{{ item.label }}</p>
                    <p class="admin-plan-card__sub">{{ item.subLabel }}</p>
                  </div>
                  <p class="admin-plan-card__usage">{{ item.usageLabel }}</p>
                </div>
                <div class="admin-plan-card__stats">
                  <span>사용량 {{ item.detail }}</span>
                </div>
              </article>
            </div>
          </div>

          <div class="admin-panel">
            <div class="admin-panel__header">
              <div>
                <h2 class="admin-panel__title">플랜별 사용 현황</h2>
                <p class="admin-panel__description">
                  플랜별 사용자 수와 할당량 대비 사용률을 카드 형태로 확인합니다.
                </p>
              </div>
            </div>

            <div class="admin-plan-list">
              <article v-for="plan in planRows" :key="plan.planCode" class="admin-plan-card">
                <div class="admin-plan-card__top">
                  <div>
                    <p class="admin-plan-card__label">{{ plan.planLabel }}</p>
                    <p class="admin-plan-card__sub">{{ plan.userCount }}명 / 사용자 비중 {{ plan.userPercentLabel }}</p>
                  </div>
                  <p class="admin-plan-card__usage">{{ plan.usagePercentLabel }}</p>
                </div>

                <div class="admin-progress">
                  <div class="admin-progress__bar" :style="{ width: `${Math.min(100, Number(plan.usagePercent || 0))}%` }"></div>
                </div>

                <div class="admin-plan-card__stats">
                  <span>{{ plan.usedBytesLabel }}</span>
                  <span>/ {{ plan.quotaBytesLabel }}</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="admin-panel">
          <div class="admin-panel__header">
            <div>
              <h2 class="admin-panel__title">플랜 / 결제 비중 상세 표</h2>
              <p class="admin-panel__description">
                무료와 유료 플랜 기준으로 사용자 비중과 용량 사용률을 상세하게 비교합니다.
              </p>
            </div>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>플랜 코드</th>
                  <th>플랜명</th>
                  <th>구분</th>
                  <th>사용자 수</th>
                  <th>사용자 비중</th>
                  <th>사용량</th>
                  <th>할당량</th>
                  <th>사용률</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="plan in planRows" :key="plan.planCode">
                  <td class="admin-table__strong">{{ plan.planCode }}</td>
                  <td>{{ plan.planLabel }}</td>
                  <td>{{ plan.planTypeLabel }}</td>
                  <td>{{ plan.userCount }}</td>
                  <td>{{ plan.userPercentLabel }}</td>
                  <td>{{ plan.usedBytesLabel }}</td>
                  <td>{{ plan.quotaBytesLabel }}</td>
                  <td>{{ plan.usagePercentLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-page__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.admin-page__eyebrow {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.admin-page__title {
  margin: 0.25rem 0 0;
  color: var(--text-main);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
}

.admin-page__description {
  margin: 0.75rem 0 0;
  color: var(--text-secondary);
  max-width: 48rem;
  line-height: 1.6;
}

.admin-page__refresh,
.admin-page__secondary {
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-main);
  padding: 0.85rem 1.2rem;
  border-radius: 999px;
  font-weight: 700;
}

.admin-page__secondary {
  background: var(--bg-secondary);
}

.admin-alert,
.admin-panel {
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  border-radius: 1.5rem;
  padding: 1.25rem;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}

.admin-alert {
  color: #b91c1c;
  background: color-mix(in srgb, var(--bg-main) 84%, #fecaca 16%);
}

.admin-alert--info {
  color: var(--text-main);
  background: color-mix(in srgb, var(--bg-main) 92%, #e0f2fe 8%);
}

.admin-panel--empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 3rem 1.5rem;
}

.admin-panel--selector {
  padding: 0.8rem;
}

.admin-panel--inset {
  background: color-mix(in srgb, var(--bg-main) 97%, #eff6ff 3%);
  box-shadow: none;
}

.admin-summary-grid,
.admin-storage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.admin-card {
  border: 1px solid var(--border-color);
  border-radius: 1.35rem;
  padding: 1rem 1.1rem;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-main) 90%, #eff6ff 10%), var(--bg-main));
}

.admin-card__label {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.admin-card__value {
  margin: 0.5rem 0 0;
  color: var(--text-main);
  font-size: 1.4rem;
  font-weight: 800;
}

.admin-view-tabs {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.admin-tab {
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 0.9rem 1.1rem;
  border-radius: 999px;
  font-weight: 700;
}

.admin-tab--active {
  background: color-mix(in srgb, var(--bg-main) 88%, #dbeafe 12%);
  color: var(--text-main);
  border-color: color-mix(in srgb, var(--border-color) 70%, #60a5fa 30%);
}

.admin-layout {
  display: grid;
  gap: 1.5rem;
}

.admin-layout--stack {
  grid-template-columns: 1fr;
}

.admin-layout--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.admin-panel--span-2 {
  grid-column: span 2;
}

.admin-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.admin-panel__title,
.admin-subtitle {
  margin: 0;
  color: var(--text-main);
  font-size: 1.05rem;
  font-weight: 800;
}

.admin-panel__description,
.admin-subtext {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.admin-plan-list {
  display: grid;
  gap: 0.85rem;
}

.admin-plan-card {
  border: 1px solid var(--border-color);
  border-radius: 1.2rem;
  padding: 1rem;
  background: var(--bg-secondary);
}

.admin-plan-card__top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.admin-plan-card__label,
.admin-table__strong {
  color: var(--text-main);
  font-weight: 700;
}

.admin-plan-card__sub,
.admin-table__muted {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.admin-plan-card__usage {
  color: var(--text-main);
  font-weight: 800;
}

.admin-progress {
  margin-top: 0.85rem;
  height: 0.6rem;
  background: var(--bg-input);
  border-radius: 999px;
  overflow: hidden;
}

.admin-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.admin-plan-card__stats {
  margin-top: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.admin-toolbar--compact {
  margin-bottom: 0;
}

.admin-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.admin-field__label {
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 700;
}

.admin-capacity {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-top: 1.25rem;
}

.admin-capacity__readonly,
.admin-capacity__controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.admin-capacity__value {
  min-width: 10rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  background: var(--bg-input);
  color: var(--text-main);
  font-weight: 700;
}

.admin-input,
.admin-select {
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-main);
  border-radius: 1rem;
  padding: 0.85rem 1rem;
}

.admin-input {
  flex: 1 1 18rem;
}

.admin-input--narrow,
.admin-select--narrow {
  min-width: 8rem;
}

.admin-select {
  min-width: 11rem;
}

.admin-integrity {
  margin-top: 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 1.2rem;
  padding: 1rem;
  background: var(--bg-secondary);
}

.admin-integrity__status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font-weight: 700;
  font-size: 0.82rem;
}

.admin-integrity__status--healthy {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.admin-integrity__status--warning {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.admin-integrity__list {
  margin: 0.85rem 0 0;
  padding-left: 1.1rem;
  color: var(--text-secondary);
}

.admin-table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 960px;
}

.admin-table--compact {
  min-width: 720px;
}

.admin-table th,
.admin-table td {
  border-top: 1px solid var(--border-color);
  padding: 0.95rem 0.75rem;
  text-align: left;
  color: var(--text-secondary);
  vertical-align: middle;
}

.admin-table th {
  color: var(--text-muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-top: none;
}

.admin-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 6rem;
  border-radius: 999px;
  padding: 0.36rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 700;
  background: var(--bg-input);
  color: var(--text-main);
}

.admin-badge--active {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.admin-badge--suspended {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.admin-badge--banned {
  background: rgba(244, 63, 94, 0.14);
  color: #be123c;
}

.admin-actions {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.admin-action {
  border: none;
  border-radius: 999px;
  padding: 0.52rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-action:disabled,
.admin-page__refresh:disabled,
.admin-page__secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-action--active {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.admin-action--suspended {
  background: rgba(245, 158, 11, 0.16);
  color: #b45309;
}

.admin-action--banned {
  background: rgba(244, 63, 94, 0.14);
  color: #be123c;
}

.admin-visual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.admin-visual-card {
  padding: 1.15rem;
}

.admin-visual-card__body {
  display: flex;
  gap: 1rem;
}

.admin-visual-card__body--split {
  align-items: center;
}

.admin-visual-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 8.5rem;
  height: 8.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.admin-visual-ring::after {
  content: "";
  position: absolute;
  inset: 0.8rem;
  border-radius: inherit;
  background: var(--bg-main);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-color) 72%, transparent);
}

.admin-visual-ring__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.admin-visual-ring__value {
  color: var(--text-main);
  font-size: 1.1rem;
  font-weight: 800;
}

.admin-visual-ring__label {
  color: var(--text-muted);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-visual-stats {
  display: grid;
  gap: 0.7rem;
  width: 100%;
}

.admin-visual-stat {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.admin-visual-stat__label {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.admin-visual-stat__value {
  color: var(--text-main);
  font-weight: 700;
  text-align: right;
}

.admin-visual-meter {
  margin-top: 0.95rem;
}

.admin-visual-meter__meta,
.admin-visual-group__header,
.admin-visual-row__meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}

.admin-visual-meter__meta,
.admin-visual-group__header {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.admin-progress--thick {
  height: 0.72rem;
}

.admin-progress--teal .admin-progress__bar {
  background: linear-gradient(90deg, #14b8a6, #0ea5e9);
}

.admin-progress--warm .admin-progress__bar {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

.admin-visual-list {
  display: grid;
  gap: 0.8rem;
}

.admin-visual-list--compact {
  margin-top: 0.65rem;
  gap: 0.65rem;
}

.admin-visual-row__label {
  margin: 0;
  color: var(--text-main);
  font-weight: 700;
}

.admin-visual-row__sub {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.admin-visual-row__percent {
  color: var(--text-main);
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
}

.admin-visual-track {
  margin-top: 0.55rem;
  height: 0.56rem;
  border-radius: 999px;
  background: var(--bg-input);
  overflow: hidden;
}

.admin-visual-track__bar {
  height: 100%;
  border-radius: inherit;
}

.admin-visual-group-list {
  margin-top: 1rem;
  display: grid;
  gap: 0.9rem;
}

.admin-visual-group {
  border-top: 1px solid color-mix(in srgb, var(--border-color) 72%, transparent);
  padding-top: 0.9rem;
}

@media (min-width: 1200px) {
  .admin-layout {
    grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.45fr);
  }

  .admin-layout--stack {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1199px) {
  .admin-layout--three {
    grid-template-columns: 1fr;
  }

  .admin-panel--span-2 {
    grid-column: auto;
  }

  .admin-visual-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .admin-visual-card__body--split {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-visual-ring {
    width: 7.25rem;
    height: 7.25rem;
  }
}
</style>
