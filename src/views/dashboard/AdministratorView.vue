<script setup>
import { computed, onMounted, ref } from "vue";
import { fetchAdministratorDashboard, updateAdministratorUserStatus } from "@/api/administratorApi";

const dashboard = ref(null);
const isLoading = ref(false);
const isUpdating = ref(false);
const errorMessage = ref("");
const searchQuery = ref("");
const statusFilter = ref("ALL");

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

const summaryCards = computed(() => {
  const summary = dashboard.value?.summary;
  if (!summary) return [];

  return [
    { label: "전체 유저", value: `${summary.totalUserCount}명` },
    { label: "활성 유저", value: `${summary.activeUserCount}명` },
    { label: "정지 유저", value: `${summary.suspendedUserCount}명` },
    { label: "밴 유저", value: `${summary.bannedUserCount}명` },
    { label: "전체 사용 용량", value: formatBytes(summary.totalUsedBytes) },
    { label: "전체 파일 수", value: `${summary.totalFileCount}개` },
    { label: "전체 폴더 수", value: `${summary.totalFolderCount}개` },
    { label: "전체 저장 비율", value: formatPercent(summary.overallUsagePercent) },
  ];
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

const loadDashboard = async () => {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    dashboard.value = await fetchAdministratorDashboard();
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "관리자 데이터를 불러오지 못했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const handleStatusChange = async (user, nextStatus) => {
  if (!user?.idx || user.accountStatus === nextStatus || user.id === "administrator@administrator.adm") {
    return;
  }

  isUpdating.value = true;
  errorMessage.value = "";

  try {
    await updateAdministratorUserStatus(user.idx, nextStatus);
    await loadDashboard();
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      "유저 상태를 변경하지 못했습니다.";
  } finally {
    isUpdating.value = false;
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
  loadDashboard();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page__header">
      <div>
        <p class="admin-page__eyebrow">Administrator</p>
        <h1 class="admin-page__title">관리자 페이지</h1>
        <p class="admin-page__description">
          전체 유저의 저장 용량, 플랜 분포, 사용 비율, 계정 상태를 확인하고 정지/밴 처리를 관리합니다.
        </p>
      </div>

      <button type="button" class="admin-page__refresh" :disabled="isLoading || isUpdating" @click="loadDashboard">
        새로고침
      </button>
    </div>

    <div v-if="errorMessage" class="admin-alert">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading && !dashboard" class="admin-panel admin-panel--empty">
      관리자 데이터를 불러오는 중입니다.
    </div>

    <template v-else-if="dashboard">
      <section class="admin-summary-grid">
        <article v-for="card in summaryCards" :key="card.label" class="admin-card">
          <p class="admin-card__label">{{ card.label }}</p>
          <p class="admin-card__value">{{ card.value }}</p>
        </article>
      </section>

      <section class="admin-layout">
        <div class="admin-panel">
          <div class="admin-panel__header">
            <div>
              <h2 class="admin-panel__title">플랜 / 결제 비율</h2>
              <p class="admin-panel__description">무료, 유료, 관리자 플랜별 유저 수와 용량 사용 현황입니다.</p>
            </div>
          </div>

          <div class="admin-plan-list">
            <article v-for="plan in dashboard.planStats || []" :key="plan.planCode" class="admin-plan-card">
              <div class="admin-plan-card__top">
                <div>
                  <p class="admin-plan-card__label">{{ plan.planLabel }}</p>
                  <p class="admin-plan-card__sub">{{ plan.userCount }}명 · 전체 유저의 {{ formatPercent(plan.userPercent) }}</p>
                </div>
                <p class="admin-plan-card__usage">{{ formatPercent(plan.usagePercent) }}</p>
              </div>

              <div class="admin-progress">
                <div class="admin-progress__bar" :style="{ width: `${Math.min(100, Number(plan.usagePercent || 0))}%` }"></div>
              </div>

              <div class="admin-plan-card__stats">
                <span>{{ formatBytes(plan.usedBytes) }}</span>
                <span>/ {{ formatBytes(plan.quotaBytes) }}</span>
              </div>
            </article>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel__header">
            <div>
              <h2 class="admin-panel__title">유저 관리</h2>
              <p class="admin-panel__description">민감한 개인정보는 제외하고 계정 상태와 사용 현황만 보여줍니다.</p>
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
              <option value="BANNED">밴</option>
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
                    <div>{{ formatBytes(user.usedBytes) }}</div>
                    <div class="admin-table__muted">{{ formatPercent(user.usagePercent) }}</div>
                  </td>
                  <td>{{ user.fileCount }} / {{ user.folderCount }}</td>
                  <td>{{ user.sharedFileCount }}</td>
                  <td>
                    <div class="admin-actions">
                      <button type="button" class="admin-action admin-action--active" :disabled="isUpdating || user.id === 'administrator@administrator.adm' || user.accountStatus === 'ACTIVE'" @click="handleStatusChange(user, 'ACTIVE')">
                        활성
                      </button>
                      <button type="button" class="admin-action admin-action--suspended" :disabled="isUpdating || user.id === 'administrator@administrator.adm' || user.accountStatus === 'SUSPENDED'" @click="handleStatusChange(user, 'SUSPENDED')">
                        정지
                      </button>
                      <button type="button" class="admin-action admin-action--banned" :disabled="isUpdating || user.id === 'administrator@administrator.adm' || user.accountStatus === 'BANNED'" @click="handleStatusChange(user, 'BANNED')">
                        밴
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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

.admin-page__refresh {
  border: 1px solid var(--border-color);
  background: var(--bg-main);
  color: var(--text-main);
  padding: 0.85rem 1.2rem;
  border-radius: 999px;
  font-weight: 700;
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

.admin-panel--empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 3rem 1.5rem;
}

.admin-summary-grid {
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
  font-size: 1.5rem;
  font-weight: 800;
}

.admin-layout {
  display: grid;
  gap: 1.5rem;
}

.admin-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.admin-panel__title {
  margin: 0;
  color: var(--text-main);
  font-size: 1.05rem;
  font-weight: 800;
}

.admin-panel__description {
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

.admin-select {
  min-width: 11rem;
}

.admin-table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 960px;
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
.admin-page__refresh:disabled {
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

@media (min-width: 1200px) {
  .admin-layout {
    grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.45fr);
  }
}
</style>
