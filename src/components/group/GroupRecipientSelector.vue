<script setup>
import { computed } from "vue";

const props = defineProps({
  overview: {
    type: Object,
    default: () => ({
      groups: [],
      groupDetails: [],
      uncategorizedRelationships: [],
    }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  selectedUserIds: {
    type: Array,
    default: () => [],
  },
  selectedGroupIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "update:selectedUserIds",
  "update:selectedGroupIds",
]);

const users = computed(() => {
  const relationshipMap = new Map();
  const directRelationships = props.overview?.uncategorizedRelationships || [];
  const groupedRelationships = (props.overview?.groupDetails || [])
    .flatMap((group) => group.relationships || []);

  [...directRelationships, ...groupedRelationships].forEach((relationship) => {
    const targetUserId = Number(relationship?.targetUser?.userId);
    if (!Number.isFinite(targetUserId) || relationshipMap.has(targetUserId)) {
      return;
    }

    relationshipMap.set(targetUserId, relationship);
  });

  return [...relationshipMap.values()];
});

const groups = computed(() => props.overview?.groups || []);
const groupDetailById = computed(() => {
  const entries = new Map();
  (props.overview?.groupDetails || []).forEach((group) => {
    if (group?.groupId != null) {
      entries.set(group.groupId, group);
    }
  });
  return entries;
});

const normalizedUserIds = computed(() => (
  (props.selectedUserIds || []).map((value) => Number(value)).filter(Number.isFinite)
));

const normalizedGroupIds = computed(() => (
  (props.selectedGroupIds || []).map((value) => Number(value)).filter(Number.isFinite)
));

const toggleValue = (source, value) => {
  const next = new Set(source);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return [...next.values()];
};

const handleToggleUser = (userId) => {
  const normalized = Number(userId);
  if (!Number.isFinite(normalized) || props.disabled) return;
  emit("update:selectedUserIds", toggleValue(normalizedUserIds.value, normalized));
};

const handleToggleGroup = (groupId) => {
  const normalized = Number(groupId);
  if (!Number.isFinite(normalized) || props.disabled) return;
  emit("update:selectedGroupIds", toggleValue(normalizedGroupIds.value, normalized));
};

const isUserSelected = (userId) => normalizedUserIds.value.includes(Number(userId));
const isGroupSelected = (groupId) => normalizedGroupIds.value.includes(Number(groupId));
</script>

<template>
  <div class="recipient-selector">
    <div class="recipient-selector__header">
      <div>
        <p class="recipient-selector__title">공유 대상 선택</p>
        <p class="recipient-selector__description">사용자와 그룹을 함께 선택할 수 있습니다.</p>
      </div>
      <div class="recipient-selector__summary">
        <span>사용자 {{ users.length }}명</span>
        <span>그룹 {{ groups.length }}개</span>
      </div>
    </div>

    <div
      v-if="loading"
      class="recipient-selector__empty"
    >
      공유 가능한 사용자와 그룹을 불러오는 중입니다.
    </div>

    <div v-else class="recipient-selector__grid">
      <section class="recipient-selector__card">
        <header class="recipient-selector__card-header">
          <p>사용자</p>
          <span>{{ users.length }}명</span>
        </header>

        <div v-if="users.length" class="recipient-selector__list">
          <button
            v-for="relationship in users"
            :key="relationship.targetUser?.userId || relationship.relationshipId"
            type="button"
            class="recipient-selector__item"
            :class="{ 'is-selected': isUserSelected(relationship.targetUser?.userId) }"
            :disabled="disabled"
            @click="handleToggleUser(relationship.targetUser?.userId)"
          >
            <span class="recipient-selector__checkbox">
              <i
                v-if="isUserSelected(relationship.targetUser?.userId)"
                class="fa-solid fa-check"
              ></i>
            </span>
            <span class="recipient-selector__copy">
              <strong>{{ relationship.targetUser?.name || "이름 없음" }}</strong>
              <span>{{ relationship.targetUser?.email || "-" }}</span>
            </span>
          </button>
        </div>
        <div v-else class="recipient-selector__empty recipient-selector__empty--compact">
          선택 가능한 사용자가 없습니다.
        </div>
      </section>

      <section class="recipient-selector__card">
        <header class="recipient-selector__card-header">
          <p>그룹</p>
          <span>{{ groups.length }}개</span>
        </header>

        <div v-if="groups.length" class="recipient-selector__list">
          <article
            v-for="group in groups"
            :key="group.groupId"
            class="recipient-selector__group-entry"
          >
            <button
              type="button"
              class="recipient-selector__item"
              :class="{ 'is-selected': isGroupSelected(group.groupId) }"
              :disabled="disabled"
              @click="handleToggleGroup(group.groupId)"
            >
              <span class="recipient-selector__checkbox">
                <i
                  v-if="isGroupSelected(group.groupId)"
                  class="fa-solid fa-check"
                ></i>
              </span>
              <span class="recipient-selector__copy">
                <strong>{{ group.name }}</strong>
                <span>{{ group.relationshipCount || 0 }}명 연결</span>
              </span>
            </button>

            <div
              v-if="(groupDetailById.get(group.groupId)?.relationships || []).length"
              class="recipient-selector__group-members"
            >
              <span class="recipient-selector__group-members-title">포함 사용자</span>
              <div class="recipient-selector__group-member-chips">
                <span
                  v-for="member in groupDetailById.get(group.groupId)?.relationships || []"
                  :key="`${group.groupId}-${member.targetUser?.userId || member.relationshipId}`"
                  class="recipient-selector__group-member-chip"
                >
                  {{ member.targetUser?.name || "이름 없음" }}
                </span>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="recipient-selector__empty recipient-selector__empty--compact">
          생성된 그룹이 없습니다.
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.recipient-selector {
  border-radius: 1.2rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(248, 250, 252, 0.96);
  padding: 1rem;
}

.recipient-selector__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.recipient-selector__title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-main);
}

.recipient-selector__description {
  margin-top: 0.2rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

.recipient-selector__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.recipient-selector__grid {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.9rem;
}

@media (min-width: 960px) {
  .recipient-selector__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.recipient-selector__card {
  border-radius: 1rem;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  padding: 0.9rem;
}

.recipient-selector__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.recipient-selector__card-header p {
  font-size: 0.88rem;
  font-weight: 800;
  color: #0f172a;
}

.recipient-selector__card-header span {
  font-size: 0.78rem;
  color: #64748b;
}

.recipient-selector__list {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 16rem;
  overflow-y: auto;
}

.recipient-selector__group-entry {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.recipient-selector__item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: #f8fafc;
  padding: 0.8rem 0.85rem;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
}

.recipient-selector__item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(14, 165, 233, 0.55);
}

.recipient-selector__item.is-selected {
  border-color: rgba(2, 132, 199, 0.55);
  background: rgba(224, 242, 254, 0.88);
}

.recipient-selector__item:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.recipient-selector__checkbox {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  border-radius: 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.85);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.15rem;
  color: #0284c7;
  font-size: 0.68rem;
}

.recipient-selector__copy {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.recipient-selector__copy strong {
  color: #0f172a;
  font-size: 0.88rem;
  font-weight: 800;
}

.recipient-selector__copy span {
  color: #475569;
  font-size: 0.78rem;
  word-break: break-all;
}

.recipient-selector__empty {
  margin-top: 0.9rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.94);
  border: 1px dashed rgba(148, 163, 184, 0.5);
  padding: 1.3rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.84rem;
}

.recipient-selector__empty--compact {
  margin-top: 0.75rem;
  padding: 1rem 0.9rem;
}

.recipient-selector__group-members {
  margin-top: 0.1rem;
  padding: 0 0.2rem 0 0.1rem;
}

.recipient-selector__group-members-title {
  font-size: 0.72rem;
  font-weight: 800;
  color: #64748b;
}

.recipient-selector__group-member-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.recipient-selector__group-member-chip {
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
  padding: 0.24rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #334155;
}
</style>
