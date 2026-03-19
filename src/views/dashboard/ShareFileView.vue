<script setup>
import { computed, ref } from "vue";
import BaseFileView from "@/components/BaseFileView.vue";
import { useFileStore } from "@/stores/useFileStore";

const SHARE_FILTERS = [
  { value: "received", label: "공유받음" },
  { value: "sent", label: "내가 공유함" },
  { value: "all", label: "전체" },
];

const fileStore = useFileStore();
const activeFilter = ref("received");

const getSortTimestamp = (file) => Math.max(
  new Date(file?.sharedAt || 0).getTime() || 0,
  Number(file?.lastModifiedMs || 0),
  new Date(file?.updatedAt || 0).getTime() || 0,
);

const sortByLatestShared = (files) => [...files].sort(
  (left, right) => getSortTimestamp(right) - getSortTimestamp(left),
);

const mergeUniqueFiles = (files) => {
  const fileMap = new Map();

  files.forEach((file) => {
    const fileId = String(file?.id ?? file?.idx ?? "");
    if (!fileId || fileMap.has(fileId)) {
      return;
    }

    fileMap.set(fileId, file);
  });

  return sortByLatestShared([...fileMap.values()]);
};

const receivedSharedFiles = computed(() => sortByLatestShared(fileStore.sharedFiles));
const sentSharedFiles = computed(() => sortByLatestShared(fileStore.sentSharedFiles));

const allSharedFiles = computed(() => mergeUniqueFiles([
  ...receivedSharedFiles.value,
  ...sentSharedFiles.value,
]));

const filterCounts = computed(() => ({
  received: receivedSharedFiles.value.length,
  sent: sentSharedFiles.value.length,
  all: allSharedFiles.value.length,
}));

const visibleSharedFiles = computed(() => {
  if (activeFilter.value === "sent") {
    return sentSharedFiles.value;
  }

  if (activeFilter.value === "all") {
    return allSharedFiles.value;
  }

  return receivedSharedFiles.value;
});
</script>

<template>
  <BaseFileView
    title="공유 문서함"
    :files="visibleSharedFiles"
    :shared-library="true"
  >
    <template #header-right>
      <div class="share-filter-group" role="tablist" aria-label="공유 파일 보기 필터">
        <button
          v-for="filter in SHARE_FILTERS"
          :key="filter.value"
          type="button"
          class="share-filter-button"
          :class="{ 'is-active': activeFilter === filter.value }"
          :aria-pressed="activeFilter === filter.value"
          @click="activeFilter = filter.value"
        >
          <span>{{ filter.label }}</span>
          <span class="share-filter-count">{{ filterCounts[filter.value] }}</span>
        </button>
      </div>
    </template>
  </BaseFileView>
</template>

<style scoped>
.share-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.share-filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border-color) 86%, transparent);
  background: color-mix(in srgb, var(--bg-main) 88%, var(--bg-input) 12%);
  padding: 0.55rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.share-filter-button:hover {
  background: color-mix(in srgb, var(--bg-input) 84%, var(--bg-main) 16%);
}

.share-filter-button.is-active {
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}

.share-filter-count {
  display: inline-flex;
  min-width: 1.7rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-input) 78%, var(--bg-main) 22%);
  padding: 0.2rem 0.45rem;
  font-size: 0.74rem;
  font-weight: 800;
  color: inherit;
}

.share-filter-button.is-active .share-filter-count {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
</style>
