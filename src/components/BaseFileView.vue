<script setup>
import { computed, onMounted, ref } from "vue";
import FileTable from "@/components/FileTable.vue";
import { useFileStore } from "@/stores/useFileStore";
import { useViewStore } from "@/stores/viewStore";

const props = defineProps({
  title: {
    type: String,
    default: "",
  },
  files: {
    type: Array,
    default: () => [],
  },
  showEmpty: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["delete"]);
const fileStore = useFileStore();
const { viewMode, gridSize, setViewMode, setGridSize } = useViewStore();

const searchQuery = ref("");
const extensionFilter = ref("all");
const sizeFilter = ref("all");
const sortOption = ref("updatedAt-desc");

const sizeOptions = [
  { label: "전체 크기", value: "all" },
  { label: "10MB 이하", value: "small" },
  { label: "10MB ~ 100MB", value: "medium" },
  { label: "100MB 이상", value: "large" },
];

const sortOptions = [
  { label: "최근 수정순", value: "updatedAt-desc" },
  { label: "오래된 순", value: "updatedAt-asc" },
  { label: "이름 오름차순", value: "name-asc" },
  { label: "이름 내림차순", value: "name-desc" },
  { label: "큰 파일순", value: "size-desc" },
  { label: "작은 파일순", value: "size-asc" },
];

const extensionOptions = computed(() => {
  const extensions = props.files
    .map((file) => file?.extension || file?.fileFormat || "")
    .filter(Boolean)
    .map((extension) => extension.toLowerCase());

  return ["all", ...new Set(extensions).values()];
});

const totalSizeLabel = computed(() => {
  const totalSize = filteredFiles.value.reduce(
    (sum, file) => sum + Number(file?.sizeBytes || 0),
    0,
  );

  if (totalSize <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(totalSize) / Math.log(1024)),
    units.length - 1,
  );
  const value = totalSize / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
});

const hasActiveFilters = computed(() => {
  return (
    searchQuery.value.trim() !== "" ||
    extensionFilter.value !== "all" ||
    sizeFilter.value !== "all" ||
    sortOption.value !== "updatedAt-desc"
  );
});

const filteredFiles = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  const [sortBy, sortDirection] = sortOption.value.split("-");

  const filtered = props.files.filter((file) => {
    const fileName = String(file?.name || file?.fileOriginName || "").toLowerCase();
    const extension = String(file?.extension || file?.fileFormat || "").toLowerCase();
    const sizeBytes = Number(file?.sizeBytes || file?.fileSize || 0);

    const matchesKeyword =
      !keyword ||
      fileName.includes(keyword) ||
      extension.includes(keyword);
    const matchesExtension =
      extensionFilter.value === "all" || extension === extensionFilter.value;
    const matchesSize =
      sizeFilter.value === "all" ||
      (sizeFilter.value === "small" && sizeBytes <= 10 * 1024 * 1024) ||
      (sizeFilter.value === "medium" &&
        sizeBytes > 10 * 1024 * 1024 &&
        sizeBytes < 100 * 1024 * 1024) ||
      (sizeFilter.value === "large" && sizeBytes >= 100 * 1024 * 1024);

    return matchesKeyword && matchesExtension && matchesSize;
  });

  return filtered.sort((left, right) => {
    let leftValue;
    let rightValue;

    if (sortBy === "name") {
      leftValue = String(left?.name || left?.fileOriginName || "").toLowerCase();
      rightValue = String(right?.name || right?.fileOriginName || "").toLowerCase();
    } else if (sortBy === "size") {
      leftValue = Number(left?.sizeBytes || left?.fileSize || 0);
      rightValue = Number(right?.sizeBytes || right?.fileSize || 0);
    } else {
      leftValue = Number(left?.lastModifiedMs || new Date(left?.updatedAt || 0).getTime() || 0);
      rightValue = Number(right?.lastModifiedMs || new Date(right?.updatedAt || 0).getTime() || 0);
    }

    if (leftValue < rightValue) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return sortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });
});

const resetFilters = () => {
  searchQuery.value = "";
  extensionFilter.value = "all";
  sizeFilter.value = "all";
  sortOption.value = "updatedAt-desc";
};

const handleDelete = (fileId) => {
  emit("delete", fileId);
};

onMounted(() => {
  if (!fileStore.hasLoaded && !fileStore.isLoading) {
    fileStore.fetchFiles().catch(() => {});
  }
});
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-4">
        <h2 class="shrink-0 text-xl font-bold leading-none text-gray-800">{{ title }}</h2>
        <p class="text-sm text-gray-500">
          {{ filteredFiles.length }}개 파일 · {{ totalSizeLabel }}
        </p>
        <slot name="header-left"></slot>
      </div>

      <div class="flex items-center gap-2">
        <slot name="header-right"></slot>
      </div>
    </div>

    <div class="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
        <label class="file-filter">
          <span class="file-filter__label">검색</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="파일명 또는 확장자 검색"
            class="file-filter__input"
          />
        </label>

        <label class="file-filter">
          <span class="file-filter__label">확장자</span>
          <select v-model="extensionFilter" class="file-filter__input">
            <option value="all">전체</option>
            <option
              v-for="extension in extensionOptions.filter((value) => value !== 'all')"
              :key="extension"
              :value="extension"
            >
              {{ extension.toUpperCase() }}
            </option>
          </select>
        </label>

        <label class="file-filter">
          <span class="file-filter__label">크기</span>
          <select v-model="sizeFilter" class="file-filter__input">
            <option
              v-for="option in sizeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="file-filter">
          <span class="file-filter__label">정렬</span>
          <select v-model="sortOption" class="file-filter__input">
            <option
              v-for="option in sortOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <div class="file-filter">
          <span class="file-filter__label">보기</span>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="view-toggle"
              :class="{ 'is-active': viewMode === 'table' }"
              @click="setViewMode('table')"
            >
              리스트
            </button>
            <button
              type="button"
              class="view-toggle"
              :class="{ 'is-active': viewMode === 'grid' }"
              @click="setViewMode('grid')"
            >
              바둑판
            </button>
            <select
              v-if="viewMode === 'grid'"
              :value="gridSize"
              class="file-filter__input min-w-[108px]"
              @change="setGridSize($event.target.value)"
            >
              <option value="large">큰 카드</option>
              <option value="medium">중간 카드</option>
              <option value="small">작은 카드</option>
            </select>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>
          검색, 확장자, 크기 필터를 동시에 적용할 수 있습니다.
        </p>

        <button
          v-if="hasActiveFilters"
          type="button"
          class="rounded-full px-3 py-1 font-semibold text-blue-600 transition hover:bg-blue-50"
          @click="resetFilters"
        >
          필터 초기화
        </button>
      </div>
    </div>

    <slot name="header-bottom"></slot>

    <div
      v-if="fileStore.isLoading && fileStore.allFiles.length === 0"
      class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-500"
    >
      파일 목록을 불러오는 중입니다.
    </div>

    <div
      v-else-if="fileStore.loadError"
      class="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600"
    >
      {{ fileStore.loadError }}
    </div>

    <div v-else-if="filteredFiles.length > 0">
      <FileTable :files="filteredFiles" @delete-file="handleDelete" />
    </div>

    <div
      v-else-if="showEmpty"
      class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-400"
    >
      표시할 파일이 없습니다.
    </div>
  </div>
</template>

<style scoped>
.file-filter {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.45rem;
}

.file-filter__label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
}

.file-filter__input {
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid #d1d5db;
  background: #fff;
  padding: 0.7rem 0.9rem;
  font-size: 0.9rem;
  color: #111827;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.file-filter__input:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.16);
}

.view-toggle {
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #fff;
  padding: 0.68rem 0.95rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: #4b5563;
  transition: all 0.18s ease;
}

.view-toggle.is-active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}
</style>
