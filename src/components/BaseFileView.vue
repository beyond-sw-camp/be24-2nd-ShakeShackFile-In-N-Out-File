<script setup>
import { computed, onMounted, ref } from "vue";
import FilePreviewModal from "@/components/FilePreviewModal.vue";
import FileTable from "@/components/FileTable.vue";
import { useFileStore } from "@/stores/useFileStore";
import { useViewStore } from "@/stores/viewStore";

const FILE_ROOT_LABEL = "내 드라이브";

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
  deleteMode: {
    type: String,
    default: "trash",
  },
  showFolderNavigation: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["delete"]);
const fileStore = useFileStore();
const { viewMode, gridSize, setViewMode, setGridSize } = useViewStore();

const searchQuery = ref("");
const extensionFilter = ref("all");
const sizeFilter = ref("all");
const sortOption = ref("updatedAt-desc");

const renameTarget = ref(null);
const renameValue = ref("");
const renameError = ref("");
const isRenaming = ref(false);

const propertyTarget = ref(null);
const propertySummary = ref(null);
const propertyError = ref("");
const isPropertyLoading = ref(false);
const previewTarget = ref(null);

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

const formatBytes = (totalSize) => {
  const size = Number(totalSize || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "-";

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

const totalSizeLabel = computed(() => {
  const totalSize = filteredFiles.value.reduce(
    (sum, file) => sum + Number(file?.sizeBytes || 0),
    0,
  );

  return formatBytes(totalSize);
});

const folderPathSegments = computed(() => {
  return [
    { id: null, name: FILE_ROOT_LABEL },
    ...fileStore.currentFolderPath.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
  ];
});

const folderPathLabel = computed(() => {
  return folderPathSegments.value.map((segment) => segment.name).join(" / ");
});

const propertyPathLabel = computed(() => {
  if (!propertyTarget.value?.id) {
    return FILE_ROOT_LABEL;
  }

  return [
    FILE_ROOT_LABEL,
    ...fileStore.getFolderPath(propertyTarget.value.id).map((folder) => folder.name),
  ].join(" / ");
});

const currentFolderVisibleSummary = computed(() => {
  if (!fileStore.currentFolder) {
    return null;
  }

  const visibleFiles = props.files.filter((file) => file?.type !== "folder");
  const visibleFolders = props.files.filter((file) => file?.type === "folder");
  const visibleSize = visibleFiles.reduce(
    (sum, file) => sum + Number(file?.sizeBytes || 0),
    0,
  );

  return {
    visibleChildCount: props.files.length,
    visibleFileCount: visibleFiles.length,
    visibleFolderCount: visibleFolders.length,
    visibleSizeLabel: formatBytes(visibleSize),
  };
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

const navigateToFolder = (folderId) => {
  fileStore.navigateToFolder(folderId);
};

const openRenameFolder = (folder) => {
  if (!folder || folder.type !== "folder") {
    return;
  }

  renameTarget.value = folder;
  renameValue.value = folder.name || folder.fileOriginName || "";
  renameError.value = "";
};

const closeRenameModal = () => {
  renameTarget.value = null;
  renameValue.value = "";
  renameError.value = "";
  isRenaming.value = false;
};

const submitRenameFolder = async () => {
  const normalizedName = renameValue.value.trim();
  if (!renameTarget.value?.id) {
    return;
  }

  if (!normalizedName) {
    renameError.value = "폴더 이름을 입력해 주세요.";
    return;
  }

  isRenaming.value = true;
  renameError.value = "";

  try {
    await fileStore.renameFolder(renameTarget.value.id, normalizedName);
    closeRenameModal();
  } catch (error) {
    renameError.value =
      error?.response?.data?.message ||
      error?.message ||
      "폴더 이름을 변경하지 못했습니다.";
  } finally {
    isRenaming.value = false;
  }
};

const openFolderProperties = async (folder) => {
  if (!folder || folder.type !== "folder") {
    return;
  }

  propertyTarget.value = folder;
  propertySummary.value = null;
  propertyError.value = "";
  isPropertyLoading.value = true;

  try {
    propertySummary.value = await fileStore.fetchFolderProperties(folder.id);
  } catch (error) {
    propertyError.value =
      error?.response?.data?.message ||
      error?.message ||
      "폴더 속성을 불러오지 못했습니다.";
  } finally {
    isPropertyLoading.value = false;
  }
};

const closePropertyModal = () => {
  propertyTarget.value = null;
  propertySummary.value = null;
  propertyError.value = "";
  isPropertyLoading.value = false;
};

const openFilePreview = (file) => {
  if (!file || file.type === "folder") {
    return;
  }

  previewTarget.value = file;
};

const closeFilePreview = () => {
  previewTarget.value = null;
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

    <div
      v-if="showFolderNavigation"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
    >
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">현재 위치</p>
        <div class="mt-1 flex flex-wrap items-center gap-1 text-sm font-semibold text-gray-700">
          <template v-for="(segment, index) in folderPathSegments" :key="`${segment.id ?? 'root'}-${index}`">
            <button
              type="button"
              class="rounded-full px-2 py-1 transition hover:bg-slate-100"
              :class="{ 'text-blue-600': index !== folderPathSegments.length - 1 }"
              @click="navigateToFolder(segment.id)"
            >
              {{ segment.name }}
            </button>
            <span v-if="index < folderPathSegments.length - 1" class="text-gray-300">/</span>
          </template>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="fileStore.currentFolder"
          type="button"
          class="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          @click="openRenameFolder(fileStore.currentFolder)"
        >
          이름 변경
        </button>
        <button
          v-if="fileStore.currentFolder"
          type="button"
          class="rounded-full border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          @click="openFolderProperties(fileStore.currentFolder)"
        >
          속성 보기
        </button>
        <button
          v-if="fileStore.currentFolder"
          type="button"
          class="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          @click="fileStore.goBack()"
        >
          상위 폴더로
        </button>
      </div>
    </div>

    <div
      v-if="showFolderNavigation && currentFolderVisibleSummary"
      class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div class="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">현재 폴더 항목</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ currentFolderVisibleSummary.visibleChildCount }}
        </p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">현재 폴더 파일</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ currentFolderVisibleSummary.visibleFileCount }}
        </p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">현재 폴더 하위 폴더</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ currentFolderVisibleSummary.visibleFolderCount }}
        </p>
      </div>
      <div class="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">현재 폴더 파일 크기</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ currentFolderVisibleSummary.visibleSizeLabel }}
        </p>
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
              <option value="xsmall">최소 카드</option>
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
      <FileTable
        :files="filteredFiles"
        :delete-mode="deleteMode"
        :show-parent-navigator="showFolderNavigation && Boolean(fileStore.currentFolder)"
        :parent-folder-target-id="fileStore.currentFolder?.parentId ?? null"
        @delete-file="handleDelete"
        @rename-folder="openRenameFolder"
        @show-folder-properties="openFolderProperties"
        @preview-file="openFilePreview"
      />
    </div>

    <div
      v-else-if="showEmpty"
      class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-400"
    >
      표시할 파일이 없습니다.
    </div>

    <div
      v-if="renameTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeRenameModal"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">폴더 이름 변경</p>
            <h3 class="mt-1 text-xl font-bold text-gray-900">{{ renameTarget.name }}</h3>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600"
            @click="closeRenameModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label class="mt-5 block">
          <span class="mb-2 block text-sm font-semibold text-gray-600">새 폴더 이름</span>
          <input
            v-model="renameValue"
            type="text"
            maxlength="100"
            class="file-filter__input"
            placeholder="폴더 이름을 입력하세요"
            @keydown.enter.prevent="submitRenameFolder"
          />
        </label>

        <p v-if="renameError" class="mt-3 text-sm text-rose-500">
          {{ renameError }}
        </p>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            @click="closeRenameModal"
          >
            취소
          </button>
          <button
            type="button"
            class="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            :disabled="isRenaming"
            @click="submitRenameFolder"
          >
            {{ isRenaming ? "변경 중..." : "이름 저장" }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="propertyTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closePropertyModal"
    >
      <div class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">폴더 속성</p>
            <h3 class="mt-1 text-xl font-bold text-gray-900">
              {{ propertySummary?.folderName || propertyTarget.name }}
            </h3>
            <p class="mt-2 text-sm text-gray-500">{{ propertyPathLabel }}</p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600"
            @click="closePropertyModal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          v-if="isPropertyLoading"
          class="mt-6 rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-10 text-center text-sm text-gray-500"
        >
          폴더 속성을 불러오는 중입니다.
        </div>

        <div
          v-else-if="propertyError"
          class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600"
        >
          {{ propertyError }}
        </div>

        <div v-else-if="propertySummary" class="mt-6 space-y-6">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">직접 포함 항목</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ propertySummary.directChildCount }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">전체 하위 항목</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ propertySummary.totalChildCount }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">직접 포함 파일 크기</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ formatBytes(propertySummary.directSize) }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">전체 파일 크기</p>
              <p class="mt-2 text-2xl font-bold text-gray-900">{{ formatBytes(propertySummary.totalSize) }}</p>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-gray-200 px-4 py-4">
              <p class="text-sm font-semibold text-gray-900">직접 포함 정보</p>
              <dl class="mt-4 space-y-3 text-sm text-gray-600">
                <div class="flex items-center justify-between gap-4">
                  <dt>파일 수</dt>
                  <dd class="font-semibold text-gray-900">{{ propertySummary.directFileCount }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>폴더 수</dt>
                  <dd class="font-semibold text-gray-900">{{ propertySummary.directFolderCount }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>마지막 수정</dt>
                  <dd class="font-semibold text-gray-900">{{ formatDisplayDate(propertySummary.lastModifyDate) }}</dd>
                </div>
              </dl>
            </div>

            <div class="rounded-2xl border border-gray-200 px-4 py-4">
              <p class="text-sm font-semibold text-gray-900">전체 하위 정보</p>
              <dl class="mt-4 space-y-3 text-sm text-gray-600">
                <div class="flex items-center justify-between gap-4">
                  <dt>전체 파일 수</dt>
                  <dd class="font-semibold text-gray-900">{{ propertySummary.totalFileCount }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>전체 폴더 수</dt>
                  <dd class="font-semibold text-gray-900">{{ propertySummary.totalFolderCount }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>생성 시간</dt>
                  <dd class="font-semibold text-gray-900">{{ formatDisplayDate(propertySummary.uploadDate) }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <FilePreviewModal
      :file="previewTarget"
      @close="closeFilePreview"
    />
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
