<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import FilePreviewModal from "@/components/FilePreviewModal.vue";
import FileCollectionView from "@/components/file/FileCollectionView.vue";
import { downloadFileAsset } from "@/api/filesApi.js";
import { fetchGroupOverview, shareFilesWithTargets } from "@/api/groupApi";
import { useFileStore } from "@/stores/useFileStore";
import { useViewStore } from "@/stores/viewStore";
import {
  FILE_SIZE_OPTIONS,
  FILE_STATUS_OPTIONS,
  getFileSearchScope,
  useHeaderSearchStore,
} from "@/stores/useHeaderSearchStore";

const FILE_ROOT_LABEL = "홈";

const props = defineProps({
  title: { type: String, default: "" },
  files: { type: Array, default: () => [] },
  showEmpty: { type: Boolean, default: true },
  deleteMode: { type: String, default: "trash" },
  showFolderNavigation: { type: Boolean, default: false },
  sharedLibrary: { type: Boolean, default: false },
});

const emit = defineEmits(["delete"]);

const fileStore = useFileStore();
const route = useRoute();
const headerSearchStore = useHeaderSearchStore();
const {
  viewMode,
  layoutPreset,
  customLayoutColumns,
  customLayoutRows,
  resolvedPageSize,
  setViewMode,
  setLayoutPreset,
  setCustomLayoutColumns,
  setCustomLayoutRows,
} = useViewStore();

const searchScope = computed(() => getFileSearchScope(route.name) || "files");
const searchState = computed(() => headerSearchStore.getScopeState(searchScope.value));
const useServerPaging = computed(() => props.showFolderNavigation && !props.sharedLibrary && props.deleteMode !== "permanent");
const effectiveFiles = computed(() => props.files);

const sortOption = ref("updatedAt-desc");
const pageSize = computed(() => resolvedPageSize.value);
const currentPage = ref(1);
const selectedIds = ref([]);

const renameTarget = ref(null);
const renameValue = ref("");
const renameError = ref("");
const isRenaming = ref(false);
const propertyTarget = ref(null);
const propertySummary = ref(null);
const propertyError = ref("");
const isPropertyLoading = ref(false);
const previewTarget = ref(null);
const shareTargets = ref([]);
const shareInfo = ref([]);
const shareEmail = ref("");
const shareCancelEmail = ref("");
const shareError = ref("");
const isSharing = ref(false);
const isShareInfoLoading = ref(false);
const shareGroupOverview = ref(null);
const isShareGroupOverviewLoading = ref(false);
const shareTargetUserIds = ref([]);
const shareTargetGroupIds = ref([]);
const sharePendingInvites = ref([]);

const sizeOptions = FILE_SIZE_OPTIONS;
const statusOptions = FILE_STATUS_OPTIONS;
const sortOptions = [
  { label: "\uCD5C\uADFC \uC218\uC815\uC21C", value: "updatedAt-desc" },
  { label: "\uC624\uB798\uB41C \uC218\uC815\uC21C", value: "updatedAt-asc" },
  { label: "\uC774\uB984 \uC624\uB984\uCC28\uC21C", value: "name-asc" },
  { label: "\uC774\uB984 \uB0B4\uB9BC\uCC28\uC21C", value: "name-desc" },
  { label: "\uD070 \uD30C\uC77C \uC21C", value: "size-desc" },
  { label: "\uC791\uC740 \uD30C\uC77C \uC21C", value: "size-asc" },
  { label: "\uCD5C\uADFC \uACF5\uC720\uC21C", value: "sharedAt-desc" },
];
const layoutPresetOptions = [
  { value: "10", label: "10개" },
  { value: "20", label: "20개" },
  { value: "30", label: "30개" },
  { value: "custom", label: "사용자 설정" },
];
const sizeOptionLabelMap = Object.fromEntries(sizeOptions.map((option) => [option.value, option.label]));
const visibleLayoutPresetOptions = computed(() => layoutPresetOptions.filter((option) => option.value !== "custom"));
const statusOptionLabelMap = Object.fromEntries(statusOptions.map((option) => [option.value, option.label]));

const formatBytes = (totalSize) => {
  const size = Number(totalSize || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const triggerDownload = async (file) => {
  if (!file?.downloadUrl && !file?.presignedDownloadUrl) return;

  try {
    await downloadFileAsset(file);
  } catch (error) {
    window.alert(error?.message || "\uD30C\uC77C\uC744 \uB2E4\uC6B4\uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const extensionOptions = computed(() => {
  if (useServerPaging.value) {
    return fileStore.driveAvailableExtensions || [];
  }

  const extensions = effectiveFiles.value
    .map((file) => file?.extension || file?.fileFormat || "")
    .filter(Boolean)
    .map((extension) => extension.toLowerCase());
  return [...new Set(extensions).values()].sort((left, right) => left.localeCompare(right));
});

const folderPathSegments = computed(() => [
  { id: null, name: FILE_ROOT_LABEL },
  ...fileStore.currentFolderPath.map((folder) => ({ id: folder.id, name: folder.name })),
]);

const propertyPathLabel = computed(() => {
  if (!propertyTarget.value?.id) return FILE_ROOT_LABEL;
  return [FILE_ROOT_LABEL, ...fileStore.getFolderPath(propertyTarget.value.id).map((folder) => folder.name)].join(" / ");
});

const currentFolderVisibleSummary = computed(() => {
  if (!fileStore.currentFolder) return null;
  const visibleFiles = effectiveFiles.value.filter((file) => file?.type !== "folder");
  const visibleFolders = effectiveFiles.value.filter((file) => file?.type === "folder");
  const visibleSize = visibleFiles.reduce((sum, file) => sum + Number(file?.sizeBytes || 0), 0);
  return {
    visibleChildCount: effectiveFiles.value.length,
    visibleFileCount: visibleFiles.length,
    visibleFolderCount: visibleFolders.length,
    visibleSizeLabel: formatBytes(visibleSize),
  };
});
const folderSummaryCards = computed(() => {
  if (!currentFolderVisibleSummary.value) {
    return [];
  }

  return [
    { key: "items", label: "현재 폴더 항목", value: currentFolderVisibleSummary.value.visibleChildCount },
    { key: "files", label: "현재 폴더 파일", value: currentFolderVisibleSummary.value.visibleFileCount },
    { key: "folders", label: "현재 폴더 하위 폴더", value: currentFolderVisibleSummary.value.visibleFolderCount },
    { key: "size", label: "현재 폴더 파일 크기", value: currentFolderVisibleSummary.value.visibleSizeLabel },
  ];
});
const planCapabilities = computed(() => fileStore.planCapabilities);
const canCreateShares = computed(() => Boolean(planCapabilities.value?.shareEnabled));
const canCreateLocks = computed(() => Boolean(planCapabilities.value?.fileLockEnabled));
const shareOverviewGroups = computed(() => shareGroupOverview.value?.groups || []);
const shareOverviewUsers = computed(() => {
  const directRelationships = shareGroupOverview.value?.uncategorizedRelationships || [];
  const groupedRelationships = (shareGroupOverview.value?.groupDetails || [])
    .flatMap((group) => group.relationships || []);
  const relationshipMap = new Map();

  [...directRelationships, ...groupedRelationships].forEach((relationship) => {
    if (!relationship?.relationshipId || relationshipMap.has(relationship.relationshipId)) {
      return;
    }
    relationshipMap.set(relationship.relationshipId, relationship);
  });

  return [...relationshipMap.values()];
});

const customSizeRangeLabel = computed(() => {
  if (searchState.value.sizeFilter !== "custom") return "";
  const min = searchState.value.customMinSize?.trim();
  const max = searchState.value.customMaxSize?.trim();
  if (!min && !max) return "\uBC94\uC704\uB97C \uC785\uB825\uD558\uC138\uC694.";
  if (min && max) return `${min}MB ~ ${max}MB`;
  if (min) return min + "MB \uC774\uC0C1";
  return max + "MB \uC774\uD558";
});

const hasSearchFilters = computed(() => (
  searchState.value.searchQuery.trim() !== "" ||
  searchState.value.extensionFilter !== "all" ||
  searchState.value.sizeFilter !== "all" ||
  searchState.value.statusFilter !== "all"
));

const hasActiveFilters = computed(() => hasSearchFilters.value || sortOption.value !== "updatedAt-desc");
const layoutGuideLabel = "배치";
const layoutGuideSummary = computed(() => (
  `${pageSize.value}`
));
const layoutGuideHint = computed(() => (
  `현재 한 페이지에 ${pageSize.value}개씩 표시됩니다.`
));
const resetFiltersLabel = "\uC870\uAC74 \uCD08\uAE30\uD654";
const customSizeChipPrefix = "\uC0AC\uC6A9\uC790 \uD06C\uAE30";
const hasVisibleToolbarChips = computed(() => (
  activeFilterChips.value.length > 0 || searchState.value.sizeFilter === "custom"
));
const activeFilterChips = computed(() => {
  const chips = [];
  if (searchState.value.searchQuery.trim()) chips.push("\uAC80\uC0C9: " + searchState.value.searchQuery.trim());
  if (searchState.value.extensionFilter !== "all") chips.push("\uD655\uC7A5\uC790: " + searchState.value.extensionFilter.toUpperCase());
  if (searchState.value.sizeFilter !== "all") chips.push("\uD06C\uAE30: " + (sizeOptionLabelMap[searchState.value.sizeFilter] || "\uC0AC\uC6A9\uC790 \uC124\uC815"));
  if (searchState.value.statusFilter !== "all") chips.push("\uC0C1\uD0DC: " + (statusOptionLabelMap[searchState.value.statusFilter] || "\uC0AC\uC6A9\uC790 \uC124\uC815"));
  if (sortOption.value !== "updatedAt-desc") chips.push("\uC815\uB82C: " + (sortOptions.find((option) => option.value === sortOption.value)?.label || "\uC0AC\uC6A9\uC790 \uC124\uC815"));
  return chips;
});
const matchesSizeFilter = (file) => {
  if (file?.type === "folder") return true;
  const sizeMb = Number(file?.sizeBytes || 0) / (1024 * 1024);
  if (searchState.value.sizeFilter === "all") return true;
  if (searchState.value.sizeFilter === "lte10") return sizeMb <= 10;
  if (searchState.value.sizeFilter === "lte100") return sizeMb <= 100;
  if (searchState.value.sizeFilter === "lte1000") return sizeMb <= 1000;
  if (searchState.value.sizeFilter === "lte100000") return sizeMb <= 100000;
  if (searchState.value.sizeFilter === "gte100001") return sizeMb >= 100001;
  if (searchState.value.sizeFilter === "custom") {
    const min = Number(searchState.value.customMinSize);
    const max = Number(searchState.value.customMaxSize);
    const hasMin = Number.isFinite(min) && searchState.value.customMinSize !== "";
    const hasMax = Number.isFinite(max) && searchState.value.customMaxSize !== "";
    if (hasMin && sizeMb < min) return false;
    if (hasMax && sizeMb > max) return false;
    return true;
  }
  return true;
};

const localFilteredFiles = computed(() => {
  const keyword = searchState.value.searchQuery.trim().toLowerCase();
  const [sortBy, sortDirection] = sortOption.value.split("-");
  const filtered = effectiveFiles.value.filter((file) => {
    const fileName = String(file?.name || file?.fileOriginName || "").toLowerCase();
    const extension = String(file?.extension || file?.fileFormat || "").toLowerCase();
    const ownerName = String(file?.ownerName || "").toLowerCase();
    const ownerEmail = String(file?.ownerEmail || "").toLowerCase();
    const matchesKeyword = !keyword || fileName.includes(keyword) || extension.includes(keyword) || ownerName.includes(keyword) || ownerEmail.includes(keyword);
    const matchesExtension = searchState.value.extensionFilter === "all" || extension === searchState.value.extensionFilter;
    const matchesStatus = searchState.value.statusFilter === "all" ||
      (searchState.value.statusFilter === "shared" && (file?.sharedFile || file?.sharedWithMe)) ||
      (searchState.value.statusFilter === "shared-owned" && file?.sharedFile && !file?.sharedWithMe) ||
      (searchState.value.statusFilter === "shared-with-me" && file?.sharedWithMe) ||
      (searchState.value.statusFilter === "locked" && file?.lockedFile) ||
      (searchState.value.statusFilter === "unlocked" && !file?.lockedFile);
    return matchesKeyword && matchesExtension && matchesStatus && matchesSizeFilter(file);
  });

  return filtered.sort((left, right) => {
    let leftValue;
    let rightValue;
    if (sortBy === "name") {
      leftValue = String(left?.name || left?.fileOriginName || "").toLowerCase();
      rightValue = String(right?.name || right?.fileOriginName || "").toLowerCase();
    } else if (sortBy === "size") {
      leftValue = Number(left?.sizeBytes || 0);
      rightValue = Number(right?.sizeBytes || 0);
    } else if (sortBy === "sharedAt") {
      leftValue = Number(new Date(left?.sharedAt || 0).getTime() || 0);
      rightValue = Number(new Date(right?.sharedAt || 0).getTime() || 0);
    } else {
      leftValue = Number(left?.lastModifiedMs || new Date(left?.updatedAt || 0).getTime() || 0);
      rightValue = Number(right?.lastModifiedMs || new Date(right?.updatedAt || 0).getTime() || 0);
    }
    if (leftValue < rightValue) return sortDirection === "asc" ? -1 : 1;
    if (leftValue > rightValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
});

const filteredFiles = computed(() => (
  useServerPaging.value ? effectiveFiles.value : localFilteredFiles.value
));
const totalSizeLabel = computed(() => formatBytes(filteredFiles.value.reduce((sum, file) => sum + Number(file?.sizeBytes || 0), 0)));
const toolbarMetaLabel = computed(() => {
  if (useServerPaging.value) {
    const totalCount = Number(fileStore.drivePageInfo?.totalCount || 0);
    return `총 ${totalCount}개 항목 · 현재 페이지 ${filteredFiles.value.length}개 · 총 ${totalSizeLabel.value}`;
  }

  return `${filteredFiles.value.length}개 항목 · 총 ${totalSizeLabel.value}`;
});
const selectedFiles = computed(() => {
  const selectedSet = new Set(selectedIds.value.map((id) => String(id)));
  return filteredFiles.value.filter((file) => selectedSet.has(String(file.id)));
});
const isOwnedSharedFile = (file) => Boolean(file?.sharedFile && !file?.sharedWithMe);
const selectedDownloadableFiles = computed(() => selectedFiles.value.filter((file) => file?.type !== "folder" && !file?.lockedFile && (file?.downloadUrl || file?.presignedDownloadUrl)));
const selectedSharedFiles = computed(() => selectedFiles.value.filter((file) => file?.sharedWithMe && !file?.lockedFile));
const selectedOwnedShareableFiles = computed(() => selectedFiles.value.filter((file) => !file?.sharedWithMe && !file?.lockedFile && file?.type !== "folder" && !file?.isTrash && (canCreateShares.value || file?.sharedFile)));
const selectedCancelableSentSharedFiles = computed(() => selectedFiles.value.filter((file) => props.sharedLibrary && file?.sharedFile && !file?.sharedWithMe && file?.type !== "folder"));
const selectedLockableFiles = computed(() => selectedFiles.value.filter((file) => !file?.sharedWithMe && file?.type !== "folder" && !file?.isTrash));
const selectedLockCandidates = computed(() => selectedLockableFiles.value.filter((file) => !file?.lockedFile));
const selectedLockedFiles = computed(() => selectedLockableFiles.value.filter((file) => file?.lockedFile));
const pageCount = computed(() => (
  useServerPaging.value
    ? Math.max(1, Number(fileStore.drivePageInfo?.totalPage || 0) || 1)
    : Math.max(1, Math.ceil(filteredFiles.value.length / pageSize.value))
));
const paginatedFiles = computed(() => (
  useServerPaging.value
    ? filteredFiles.value
    : filteredFiles.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
));
const pageNumbers = computed(() => {
  const pages = [];
  const start = Math.max(1, currentPage.value - 2);
  const end = Math.min(pageCount.value, start + 4);
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
});
const serverListQuery = computed(() => {
  if (!useServerPaging.value) {
    return null;
  }

  return {
    parentId: fileStore.currentFolderId ?? null,
    page: Math.max(0, currentPage.value - 1),
    size: pageSize.value,
    sortOption: sortOption.value,
    searchQuery: searchState.value.searchQuery.trim(),
    extensionFilter: searchState.value.extensionFilter,
    sizeFilter: searchState.value.sizeFilter,
    customMinSize: searchState.value.customMinSize,
    customMaxSize: searchState.value.customMaxSize,
    statusFilter: searchState.value.statusFilter,
  };
});
const isInitialLoading = computed(() => (
  fileStore.isLoading &&
  (
    useServerPaging.value
      ? filteredFiles.value.length === 0
      : fileStore.allFiles.length === 0
  )
));

watch(effectiveFiles, (files) => {
  const validIds = new Set((files || []).map((file) => String(file?.id)));
  selectedIds.value = selectedIds.value.filter((id) => validIds.has(String(id)));
}, { deep: true });

watch(extensionOptions, (extensions) => {
  headerSearchStore.setAvailableExtensions(searchScope.value, extensions);
}, { immediate: true });

watch(serverListQuery, (query) => {
  if (!query) {
    return;
  }

  fileStore.fetchDrivePage(query).catch(() => {});
}, { immediate: true, deep: true });

watch(() => [
  searchState.value.searchQuery,
  searchState.value.extensionFilter,
  searchState.value.sizeFilter,
  searchState.value.customMinSize,
  searchState.value.customMaxSize,
  searchState.value.statusFilter,
  sortOption.value,
], () => {
  currentPage.value = 1;
});

watch(filteredFiles, (files) => {
  const validIds = new Set(files.map((file) => String(file.id)));
  selectedIds.value = selectedIds.value.filter((id) => validIds.has(String(id)));
  if (currentPage.value > pageCount.value) currentPage.value = pageCount.value;
  if (currentPage.value < 1) currentPage.value = 1;
});

watch(pageSize, () => {
  currentPage.value = 1;
});

const resetFilters = () => {
  headerSearchStore.resetScope(searchScope.value);
  sortOption.value = "updatedAt-desc";
  currentPage.value = 1;
};

const clearSelection = () => {
  selectedIds.value = [];
};

const navigateToFolder = (folderId) => {
  if (useServerPaging.value) {
    currentPage.value = 1;
  }
  fileStore.navigateToFolder(folderId);
};

const handleGoBack = () => {
  if (useServerPaging.value) {
    currentPage.value = 1;
  }
  fileStore.goBack();
};

const handleDelete = (fileId) => {
  selectedIds.value = selectedIds.value.filter((id) => String(id) !== String(fileId));
  emit("delete", fileId);
};

const handleRestore = async (fileId) => {
  try {
    await fileStore.restoreFromTrash(fileId);
    selectedIds.value = selectedIds.value.filter((id) => String(id) !== String(fileId));
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "파일을 원래 위치로 복구하지 못했습니다.");
  }
};

const handleRestoreSelected = async () => {
  if (!selectedFiles.value.length) return;

  try {
    await fileStore.restoreFilesBatch(selectedFiles.value.map((file) => file.id));
    clearSelection();
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "선택한 항목을 원래 위치로 복구하지 못했습니다.");
  }
};

const handleDeleteSelected = async () => {
  if (!selectedFiles.value.length) return;
  if (selectedFiles.value.some((file) => file?.lockedFile)) {
    window.alert("\uC7A0\uAE34 \uD30C\uC77C\uC740 \uC0AD\uC81C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return;
  }
  const confirmMessage = selectedFiles.value.some(isOwnedSharedFile)
    ? "공유된 파일입니다 삭제하시겠습니까? 공유된 사람에게도 사라집니다."
    : props.deleteMode === "permanent"
      ? "\uC120\uD0DD\uD55C " + selectedFiles.value.length + "\uAC1C \uD56D\uBAA9\uC744 \uC601\uAD6C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?"
      : "\uC120\uD0DD\uD55C " + selectedFiles.value.length + "\uAC1C \uD56D\uBAA9\uC744 \uD734\uC9C0\uD1B5\uC73C\uB85C \uC774\uB3D9\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?";
  if (!window.confirm(confirmMessage)) return;
  try {
    const ids = selectedFiles.value.map((file) => file.id);
    if (props.deleteMode === "permanent") await fileStore.permanentlyDeleteBatch(ids);
    else await fileStore.trashFilesBatch(ids);
    clearSelection();
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "\uC120\uD0DD\uD55C \uD56D\uBAA9\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const handleBatchDownload = () => {
  if (!selectedDownloadableFiles.value.length) {
    window.alert("\uB2E4\uC6B4\uB85C\uB4DC\uD560 \uC218 \uC788\uB294 \uD30C\uC77C\uC774 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    return;
  }
  selectedDownloadableFiles.value.forEach((file, index) => {
    window.setTimeout(() => { void triggerDownload(file); }, index * 120);
  });
};

const handleSaveSharedToDrive = async (file) => {
  try {
    await fileStore.saveSharedFileToDrive(file.id, fileStore.currentFolderId);
    window.alert("\uB0B4 \uB4DC\uB77C\uC774\uBE0C\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "\uACF5\uC720 \uD30C\uC77C\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const handleBatchSaveShared = async () => {
  if (!selectedSharedFiles.value.length) {
    window.alert("\uB0B4 \uB4DC\uB77C\uC774\uBE0C\uB85C \uC800\uC7A5\uD560 \uACF5\uC720 \uD30C\uC77C\uC774 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    return;
  }
  try {
    for (const file of selectedSharedFiles.value) {
      await fileStore.saveSharedFileToDrive(file.id, fileStore.currentFolderId);
    }
    clearSelection();
    window.alert("\uC120\uD0DD\uD55C \uACF5\uC720 \uD30C\uC77C\uC744 \uB0B4 \uB4DC\uB77C\uC774\uBE0C\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "\uACF5\uC720 \uD30C\uC77C\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const handleBatchCancelSentShares = async () => {
  if (!selectedCancelableSentSharedFiles.value.length) {
    window.alert("공유 취소할 내가 공유한 파일이 선택되지 않았습니다.");
    return;
  }

  const cancelTargetCount = selectedCancelableSentSharedFiles.value.length;
  const ignoredCount = selectedFiles.value.length - cancelTargetCount;
  const confirmMessage = ignoredCount > 0
    ? `선택한 항목 중 내가 공유한 파일 ${cancelTargetCount}개만 공유 취소됩니다. 계속할까요?`
    : `선택한 ${cancelTargetCount}개 파일의 공유를 모두 취소하시겠습니까?`;

  if (!window.confirm(confirmMessage)) {
    return;
  }

  try {
    const targetIds = selectedCancelableSentSharedFiles.value.map((file) => file.id);
    const targetIdSet = new Set(targetIds.map((id) => String(id)));
    await fileStore.cancelAllSharedFiles(targetIds);
    selectedIds.value = selectedIds.value.filter((id) => !targetIdSet.has(String(id)));
    window.alert("선택한 파일의 공유를 모두 취소했습니다.");
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "선택한 파일의 공유를 취소하지 못했습니다.");
  }
};

const aggregateShareInfoEntries = (items) => {
  const shareMap = new Map();

  items.forEach((item) => {
    const recipientEmail = String(item?.recipientEmail || "").trim();
    if (!recipientEmail) {
      return;
    }

    const key = recipientEmail.toLowerCase();
    const existing = shareMap.get(key) || {
      shareIdx: item?.shareIdx || null,
      fileIdx: item?.fileIdx || null,
      recipientName: item?.recipientName || "",
      recipientEmail,
      createdAt: item?.createdAt || null,
      fileNames: new Set(),
    };

    if (!existing.recipientName && item?.recipientName) {
      existing.recipientName = item.recipientName;
    }

    const currentTimestamp = new Date(existing.createdAt || 0).getTime() || 0;
    const nextTimestamp = new Date(item?.createdAt || 0).getTime() || 0;
    if (nextTimestamp >= currentTimestamp) {
      existing.createdAt = item?.createdAt || existing.createdAt;
      existing.shareIdx = item?.shareIdx || existing.shareIdx;
      existing.fileIdx = item?.fileIdx || existing.fileIdx;
    }

    if (item?.fileOriginName) {
      existing.fileNames.add(item.fileOriginName);
    }

    shareMap.set(key, existing);
  });

  return [...shareMap.values()]
    .map((item) => ({
      ...item,
      fileNames: [...item.fileNames],
      fileCount: item.fileNames.size,
    }))
    .sort((left, right) => (new Date(right.createdAt || 0).getTime() || 0) - (new Date(left.createdAt || 0).getTime() || 0));
};

const formatSharedFilesLabel = (item) => {
  const fileNames = Array.isArray(item?.fileNames) ? item.fileNames.filter(Boolean) : [];

  if (!fileNames.length) {
    return "공유된 파일 정보 없음";
  }

  if (fileNames.length === 1) {
    return fileNames[0];
  }

  if (fileNames.length === 2) {
    return fileNames.join(", ");
  }

  return `${fileNames.slice(0, 2).join(", ")} 외 ${fileNames.length - 2}개`;
};

const loadShareInfo = async () => {
  shareInfo.value = [];
  shareError.value = "";
  if (!shareTargets.value.length || shareTargets.value.some((file) => file?.sharedWithMe)) return;
  isShareInfoLoading.value = true;
  try {
    const shareResponses = await Promise.all(
      shareTargets.value.map(async (file) => {
        const items = await fileStore.fetchShareInfo(file.id);
        return (items || []).map((item) => ({
          ...item,
          fileOriginName: item?.fileOriginName || file?.name || file?.fileOriginName || "",
        }));
      }),
    );
    shareInfo.value = aggregateShareInfoEntries(shareResponses.flat());
  } catch (error) {
    shareError.value = error?.response?.data?.message || error?.message || "\uACF5\uC720 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
  } finally {
    isShareInfoLoading.value = false;
  }
};

const normalizeShareTargets = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
};

const loadShareGroupOverview = async () => {
  isShareGroupOverviewLoading.value = true;

  try {
    shareGroupOverview.value = await fetchGroupOverview();
  } catch (error) {
    shareGroupOverview.value = null;
    shareError.value = error?.response?.data?.message || error?.message || "\uADF8\uB8F9 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
  } finally {
    isShareGroupOverviewLoading.value = false;
  }
};

const openShareDialog = async (files = selectedOwnedShareableFiles.value) => {
  const nextTargets = normalizeShareTargets(files).filter((file) => !file?.sharedWithMe && file?.type !== "folder" && (canCreateShares.value || file?.sharedFile));
  if (!nextTargets.length) {
    window.alert(canCreateShares.value ? "\uACF5\uC720\uD560 \uC218 \uC788\uB294 \uD30C\uC77C\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." : "\uD604\uC7AC \uBA64\uBC84\uC2ED\uC5D0\uC11C\uB294 \uC0C8 \uACF5\uC720\uB97C \uCD94\uAC00\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return;
  }
  shareTargets.value = nextTargets;
  shareEmail.value = "";
  shareCancelEmail.value = "";
  shareError.value = "";
  shareTargetUserIds.value = [];
  shareTargetGroupIds.value = [];
  sharePendingInvites.value = [];
  await loadShareGroupOverview();
  await loadShareInfo();
};

const closeShareDialog = () => {
  shareTargets.value = [];
  shareInfo.value = [];
  shareEmail.value = "";
  shareCancelEmail.value = "";
  shareError.value = "";
  isShareInfoLoading.value = false;
  isSharing.value = false;
  shareTargetUserIds.value = [];
  shareTargetGroupIds.value = [];
  sharePendingInvites.value = [];
};

const submitShare = async () => {
  if (!shareTargets.value.length) return;
  if (!canCreateShares.value) {
    shareError.value = "\uD604\uC7AC \uBA64\uBC84\uC2ED\uC5D0\uC11C\uB294 \uC0C8 \uACF5\uC720\uB97C \uCD94\uAC00\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
    return;
  }
  const recipientEmail = shareEmail.value.trim();
  const selectedUserIds = shareTargetUserIds.value.filter(Boolean);
  const selectedGroupIds = shareTargetGroupIds.value.filter(Boolean);
  if (!recipientEmail && !selectedUserIds.length && !selectedGroupIds.length) {
    shareError.value = "\uACF5\uC720\uD560 \uC0AC\uC6A9\uC790, \uADF8\uB8F9, \uC774\uBA54\uC77C \uC911 \uD558\uB098 \uC774\uC0C1\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.";
    return;
  }
  isSharing.value = true;
  shareError.value = "";
  try {
    const result = await shareFilesWithTargets({
      fileIds: shareTargets.value.map((file) => file.id),
      userIds: selectedUserIds,
      groupIds: selectedGroupIds,
      emails: recipientEmail ? [recipientEmail] : [],
    });
    await fileStore.refreshAll();
    shareEmail.value = "";
    shareTargetUserIds.value = [];
    shareTargetGroupIds.value = [];
    sharePendingInvites.value = result?.pendingInvites || [];
    await loadShareInfo();
  } catch (error) {
    shareError.value = error?.response?.data?.message || error?.message || "\uD30C\uC77C\uC744 \uACF5\uC720\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
  } finally {
    isSharing.value = false;
  }
};

const cancelShare = async (recipientEmail = shareCancelEmail.value) => {
  if (!shareTargets.value.length) return;
  const normalizedEmail = String(recipientEmail || "").trim();
  if (!normalizedEmail) {
    shareError.value = "\uACF5\uC720 \uCDE8\uC18C\uD560 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.";
    return;
  }
  isSharing.value = true;
  shareError.value = "";
  try {
    await fileStore.cancelSharedFiles(shareTargets.value.map((file) => file.id), normalizedEmail);
    shareCancelEmail.value = "";
    await loadShareInfo();
  } catch (error) {
    shareError.value = error?.response?.data?.message || error?.message || "\uACF5\uC720\uB97C \uCDE8\uC18C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
  } finally {
    isSharing.value = false;
  }
};

const handleBatchLock = async (locked) => {
  if (!selectedLockableFiles.value.length) {
    window.alert("\uC7A0\uAE00 \uC218 \uC788\uB294 \uD30C\uC77C\uC774 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    return;
  }
  if (locked && !canCreateLocks.value) {
    window.alert("\uD604\uC7AC \uBA64\uBC84\uC2ED\uC5D0\uC11C\uB294 \uD30C\uC77C \uC7A0\uAE08 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return;
  }
  try {
    const targetFiles = locked ? selectedLockCandidates.value : selectedLockedFiles.value;
    await fileStore.setFilesLocked(targetFiles.map((file) => file.id), locked);
    clearSelection();
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "\uD30C\uC77C \uC7A0\uAE08 \uC0C1\uD0DC\uB97C \uBCC0\uACBD\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const handleToggleLock = async (file) => {
  if (!file?.lockedFile && !canCreateLocks.value) {
    window.alert("\uD604\uC7AC \uBA64\uBC84\uC2ED\uC5D0\uC11C\uB294 \uD30C\uC77C \uC7A0\uAE08 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return;
  }
  try {
    await fileStore.setFilesLocked([file.id], !file.lockedFile);
  } catch (error) {
    window.alert(error?.response?.data?.message || error?.message || "\uD30C\uC77C \uC7A0\uAE08 \uC0C1\uD0DC\uB97C \uBCC0\uACBD\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
};

const openRenameFolder = (folder) => {
  if (!folder || folder.type !== "folder") return;
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
  if (!renameTarget.value?.id) return;
  if (!normalizedName) {
    renameError.value = "\uD3F4\uB354 \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.";
    return;
  }
  isRenaming.value = true;
  renameError.value = "";
  try {
    await fileStore.renameFolder(renameTarget.value.id, normalizedName);
    closeRenameModal();
  } catch (error) {
    renameError.value = error?.response?.data?.message || error?.message || "\uD3F4\uB354 \uC774\uB984\uC744 \uBCC0\uACBD\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
  } finally {
    isRenaming.value = false;
  }
};

const openFolderProperties = async (folder) => {
  if (!folder || folder.type !== "folder") return;
  propertyTarget.value = folder;
  propertySummary.value = null;
  propertyError.value = "";
  isPropertyLoading.value = true;
  try {
    propertySummary.value = await fileStore.fetchFolderProperties(folder.id);
  } catch (error) {
    propertyError.value = error?.response?.data?.message || error?.message || "\uD3F4\uB354 \uC18D\uC131\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.";
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
  if (!file || file.type === "folder") return;
  previewTarget.value = file;
};

const closeFilePreview = () => {
  previewTarget.value = null;
};

onMounted(() => {
  if (props.sharedLibrary) {
    fileStore.fetchFiles().catch(() => {});
    setLayoutPreset("20");
    sortOption.value = "sharedAt-desc";
  } else if (!useServerPaging.value && !fileStore.hasLoaded && !fileStore.isLoading) {
    fileStore.fetchFiles().catch(() => {});
  }
});
</script>

<template>
  <div>
    <div class="mb-5 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-sm">
      <div class="toolbar-shell">
        <div class="toolbar-copy">
          <div class="toolbar-overview">
            <div class="toolbar-overview__main">
              <div class="toolbar-overview__title-wrap">
                <h2 class="toolbar-overview__title">{{ title }}</h2>
                <p class="toolbar-overview__meta">{{ toolbarMetaLabel }}</p>
              </div>
              <div class="toolbar-overview__slots">
                <slot name="header-left"></slot>
                <slot name="header-right"></slot>
              </div>
            </div>
          </div>
          <div v-if="hasVisibleToolbarChips || hasActiveFilters" class="toolbar-copy__actions">
            <div v-if="hasVisibleToolbarChips" class="toolbar-chip-row">
              <span v-for="chip in activeFilterChips" :key="chip" class="toolbar-chip">{{ chip }}</span>
              <span v-if="searchState.sizeFilter === 'custom'" class="toolbar-chip toolbar-chip--accent">{{ customSizeChipPrefix }}: {{ customSizeRangeLabel }}</span>
            </div>
            <button v-if="hasActiveFilters" type="button" class="toolbar-reset" @click="resetFilters">{{ resetFiltersLabel }}</button>
          </div>
          <div v-if="showFolderNavigation" class="toolbar-folder-panel">
            <div class="toolbar-folder-panel__header">
              <div class="min-w-0">
                <p class="toolbar-folder-panel__label">{{ "\uD604\uC7AC \uC704\uCE58" }}</p>
                <div class="toolbar-folder-panel__path">
                  <template v-for="segment in folderPathSegments" :key="segment.id ?? 'root'">
                    <button type="button" class="breadcrumb-button" @click="navigateToFolder(segment.id)">{{ segment.name }}</button>
                    <span v-if="segment.id !== folderPathSegments[folderPathSegments.length - 1]?.id" class="text-gray-300">/</span>
                  </template>
                </div>
              </div>
              <div v-if="fileStore.currentFolder" class="toolbar-folder-panel__actions">
                <button type="button" class="toolbar-inline-button toolbar-inline-button--accent" @click="openFolderProperties(fileStore.currentFolder)">{{ "\uC18D\uC131 \uBCF4\uAE30" }}</button>
                <button type="button" class="toolbar-inline-button" @click="handleGoBack">{{ "\uC0C1\uC704 \uD3F4\uB354\uB85C" }}</button>
              </div>
            </div>
            <div v-if="folderSummaryCards.length > 0" class="toolbar-folder-stats">
              <article v-for="card in folderSummaryCards" :key="card.key" class="toolbar-folder-stat">
                <p class="toolbar-folder-stat__label">{{ card.label }}</p>
                <p class="toolbar-folder-stat__value">{{ card.value }}</p>
              </article>
            </div>
          </div>
        </div>

        <div class="toolbar-controls">
          <label class="file-filter">
            <span class="file-filter__label">{{ "\uC815\uB82C" }}</span>
            <select v-model="sortOption" class="file-filter__input"><option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
          </label>
          <label class="file-filter">
            <span class="file-filter__label">{{ layoutGuideLabel }}</span>
            <div class="file-filter__inline-grid file-filter__inline-grid--layout">
              <select :value="layoutPreset" class="file-filter__input" @change="setLayoutPreset($event.target.value)">
                <option v-for="option in visibleLayoutPresetOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <input v-if="layoutPreset === 'custom'" :value="customLayoutColumns" type="number" min="5" max="20" class="file-filter__input" :placeholder="'가로 5~20'" @input="setCustomLayoutColumns($event.target.value)" />
              <input v-if="layoutPreset === 'custom'" :value="customLayoutRows" type="number" min="5" max="20" class="file-filter__input" :placeholder="'세로 5~20'" @input="setCustomLayoutRows($event.target.value)" />
              
            </div>
            <p class="file-filter__hint">{{ layoutGuideHint }}</p>
          </label>
          <div class="file-filter">
            <span class="file-filter__label">{{ "\uBCF4\uAE30 \uBAA8\uB4DC" }}</span>
            <div class="toolbar-toggle-group">
              <button type="button" class="view-toggle" :class="{ 'is-active': viewMode === 'table' }" @click="setViewMode('table')">{{ "\uB9AC\uC2A4\uD2B8" }}</button>
              <button type="button" class="view-toggle" :class="{ 'is-active': viewMode === 'grid' }" @click="setViewMode('grid')">{{ "\uCE74\uB4DC" }}</button>
              <button type="button" class="view-toggle" :class="{ 'is-active': viewMode === 'icon' }" @click="setViewMode('icon')">{{ "\uC544\uC774\uCF58" }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <slot name="header-bottom"></slot>

    <div v-if="selectedFiles.length > 0" class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
      <div>
        <p class="text-sm font-semibold text-blue-900">{{ selectedFiles.length }}{{ "\uAC1C \uC120\uD0DD\uB428" }}</p>
        <p class="text-xs text-blue-700">{{ "\uC120\uD0DD\uD55C \uD30C\uC77C\uACFC \uD3F4\uB354\uC5D0 \uAC19\uC740 \uC791\uC5C5\uC744 \uC801\uC6A9\uD569\uB2C8\uB2E4." }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="selectedDownloadableFiles.length > 0" type="button" class="batch-button bg-white text-blue-700 hover:bg-blue-100" @click="handleBatchDownload">{{ "\uC120\uD0DD \uB2E4\uC6B4\uB85C\uB4DC" }}</button>
        <button v-if="selectedSharedFiles.length > 0" type="button" class="batch-button bg-white text-cyan-700 hover:bg-cyan-100" @click="handleBatchSaveShared">{{ "\uC120\uD0DD \uD30C\uC77C \uC800\uC7A5" }}</button>
        <button v-if="sharedLibrary && selectedCancelableSentSharedFiles.length > 0" type="button" class="batch-button bg-white text-violet-700 hover:bg-violet-100" @click="handleBatchCancelSentShares">선택 공유 취소</button>
        <button v-if="!sharedLibrary && deleteMode !== 'permanent' && selectedOwnedShareableFiles.length > 0" type="button" class="batch-button bg-white text-emerald-700 hover:bg-emerald-100" @click="openShareDialog()">{{ "\uC120\uD0DD \uACF5\uC720" }}</button>
        <button v-if="!sharedLibrary && deleteMode !== 'permanent' && canCreateLocks && selectedLockCandidates.length > 0" type="button" class="batch-button bg-white text-amber-700 hover:bg-amber-100" @click="handleBatchLock(true)">{{ "\uC120\uD0DD \uC7A0\uAE08" }}</button>
        <button v-if="!sharedLibrary && deleteMode !== 'permanent' && selectedLockedFiles.length > 0" type="button" class="batch-button bg-white text-slate-700 hover:bg-slate-200" @click="handleBatchLock(false)">{{ "\uC7A0\uAE08 \uD574\uC81C" }}</button>
        <button v-if="!sharedLibrary && deleteMode === 'permanent'" type="button" class="batch-button bg-white text-emerald-700 hover:bg-emerald-100" @click="handleRestoreSelected">원래 위치로 복구</button>
        <button v-if="!sharedLibrary" type="button" class="batch-button bg-white text-rose-600 hover:bg-rose-100" @click="handleDeleteSelected">{{ deleteMode === 'permanent' ? "\uC120\uD0DD \uC601\uAD6C \uC0AD\uC81C" : "\uC120\uD0DD \uC0AD\uC81C" }}</button>
        <button type="button" class="batch-button bg-transparent text-blue-700 hover:bg-blue-100" @click="clearSelection">{{ "\uC120\uD0DD \uD574\uC81C" }}</button>
      </div>
    </div>
    <div v-if="isInitialLoading" class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-500">{{ "\uD30C\uC77C \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4." }}</div>
    <div v-else-if="fileStore.loadError" class="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600">{{ fileStore.loadError }}</div>

    <div v-else-if="paginatedFiles.length > 0">
      <FileCollectionView
        :selected-ids="selectedIds"
        :files="paginatedFiles"
        :delete-mode="deleteMode"
        :show-parent-navigator="showFolderNavigation && Boolean(fileStore.currentFolder)"
        :parent-folder-target-id="fileStore.currentFolder?.parentId ?? null"
        :shared-library="sharedLibrary"
        @update:selected-ids="selectedIds = $event"
        @delete-file="handleDelete"
        @restore-file="handleRestore"
        @rename-folder="openRenameFolder"
        @show-folder-properties="openFolderProperties"
        @preview-file="openFilePreview"
        @share-file="openShareDialog"
        @toggle-lock="handleToggleLock"
        @save-to-drive="handleSaveSharedToDrive"
      />

      <div class="file-pagination-bar mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p class="text-sm text-gray-500">{{ currentPage }} / {{ pageCount }} {{ "\uD398\uC774\uC9C0" }}</p>
        <div class="file-pagination-bar__pages">
          <button type="button" class="page-button" :disabled="currentPage === 1" @click="currentPage -= 1">{{ "\uC774\uC804" }}</button>
          <button v-for="page in pageNumbers" :key="page" type="button" class="page-button" :class="{ 'is-active': currentPage === page }" @click="currentPage = page">{{ page }}</button>
          <button type="button" class="page-button" :disabled="currentPage === pageCount" @click="currentPage += 1">{{ "\uB2E4\uC74C" }}</button>
        </div>
        <div class="file-pagination-bar__spacer" aria-hidden="true"></div>
      </div>
    </div>

    <div v-else-if="showEmpty" class="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-400">{{ "\uD45C\uC2DC\uD560 \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }}</div>

    <div v-if="renameTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4" @click.self="closeRenameModal">
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uD3F4\uB354 \uC774\uB984 \uBCC0\uACBD" }}</p>
            <h3 class="mt-1 text-xl font-bold text-gray-900">{{ renameTarget.name }}</h3>
          </div>
          <button type="button" class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600" @click="closeRenameModal">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <label class="mt-5 block">
          <span class="mb-2 block text-sm font-semibold text-gray-600">{{ "\uC0C8 \uD3F4\uB354 \uC774\uB984" }}</span>
          <input v-model="renameValue" type="text" maxlength="100" class="file-filter__input" :placeholder="'\uD3F4\uB354 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.'" @keydown.enter.prevent="submitRenameFolder" />
        </label>
        <p v-if="renameError" class="mt-3 text-sm text-rose-500">{{ renameError }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50" @click="closeRenameModal">{{ "\uCDE8\uC18C" }}</button>
          <button type="button" class="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300" :disabled="isRenaming" @click="submitRenameFolder">{{ isRenaming ? "\uBCC0\uACBD \uC911..." : "\uC774\uB984 \uC800\uC7A5" }}</button>
        </div>
      </div>
    </div>

    <div v-if="propertyTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4" @click.self="closePropertyModal">
      <div class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uD3F4\uB354 \uC18D\uC131" }}</p>
            <h3 class="mt-1 text-xl font-bold text-gray-900">{{ propertySummary?.folderName || propertyTarget.name }}</h3>
            <p class="mt-2 text-sm text-gray-500">{{ propertyPathLabel }}</p>
          </div>
          <button type="button" class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600" @click="closePropertyModal">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div v-if="isPropertyLoading" class="mt-6 rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-10 text-center text-sm text-gray-500">{{ "\uD3F4\uB354 \uC18D\uC131\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4." }}</div>
        <div v-else-if="propertyError" class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-600">{{ propertyError }}</div>
        <div v-else-if="propertySummary" class="mt-6 space-y-6">
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 px-4 py-4"><p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uC9C1\uC811 \uD3EC\uD568 \uD56D\uBAA9" }}</p><p class="mt-2 text-2xl font-bold text-gray-900">{{ propertySummary.directChildCount }}</p></div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4"><p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uC804\uCCB4 \uD558\uC704 \uD56D\uBAA9" }}</p><p class="mt-2 text-2xl font-bold text-gray-900">{{ propertySummary.totalChildCount }}</p></div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4"><p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uC9C1\uC811 \uD3EC\uD568 \uD30C\uC77C \uD06C\uAE30" }}</p><p class="mt-2 text-2xl font-bold text-gray-900">{{ formatBytes(propertySummary.directSize) }}</p></div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4"><p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uC804\uCCB4 \uD30C\uC77C \uD06C\uAE30" }}</p><p class="mt-2 text-2xl font-bold text-gray-900">{{ formatBytes(propertySummary.totalSize) }}</p></div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-gray-200 px-4 py-4">
              <p class="text-sm font-semibold text-gray-900">{{ "\uC9C1\uC811 \uD3EC\uD568 \uC815\uBCF4" }}</p>
              <dl class="mt-4 space-y-3 text-sm text-gray-600">
                <div class="flex items-center justify-between gap-4"><dt>{{ "\uD30C\uC77C \uC218" }}</dt><dd class="font-semibold text-gray-900">{{ propertySummary.directFileCount }}</dd></div>
                <div class="flex items-center justify-between gap-4"><dt>{{ "\uD3F4\uB354 \uC218" }}</dt><dd class="font-semibold text-gray-900">{{ propertySummary.directFolderCount }}</dd></div>
                <div class="flex items-center justify-between gap-4"><dt>{{ "\uB9C8\uC9C0\uB9C9 \uC218\uC815" }}</dt><dd class="font-semibold text-gray-900">{{ formatDisplayDate(propertySummary.lastModifyDate) }}</dd></div>
              </dl>
            </div>
            <div class="rounded-2xl border border-gray-200 px-4 py-4">
              <p class="text-sm font-semibold text-gray-900">{{ "\uC804\uCCB4 \uD558\uC704 \uC815\uBCF4" }}</p>
              <dl class="mt-4 space-y-3 text-sm text-gray-600">
                <div class="flex items-center justify-between gap-4"><dt>{{ "\uC804\uCCB4 \uD30C\uC77C \uC218" }}</dt><dd class="font-semibold text-gray-900">{{ propertySummary.totalFileCount }}</dd></div>
                <div class="flex items-center justify-between gap-4"><dt>{{ "\uC804\uCCB4 \uD3F4\uB354 \uC218" }}</dt><dd class="font-semibold text-gray-900">{{ propertySummary.totalFolderCount }}</dd></div>
                <div class="flex items-center justify-between gap-4"><dt>{{ "\uC0DD\uC131 \uC2DC\uAC04" }}</dt><dd class="font-semibold text-gray-900">{{ formatDisplayDate(propertySummary.uploadDate) }}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="shareTargets.length > 0" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4" @click.self="closeShareDialog">
      <div class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{{ "\uD30C\uC77C \uACF5\uC720" }}</p>
            <h3 class="mt-1 text-xl font-bold text-gray-900">{{ shareTargets.length === 1 ? shareTargets[0].name : shareTargets.length + "\uAC1C \uD30C\uC77C \uC120\uD0DD" }}</h3>
            <p class="mt-2 text-sm text-gray-500">{{ "\uC774\uBA54\uC77C\uC744 \uC785\uB825\uD558\uBA74 \uB2E4\uC6B4\uB85C\uB4DC \uAD8C\uD55C\uC774 \uBD80\uC5EC\uB418\uACE0, \uC0C1\uB300\uBC29\uC758 \uACF5\uC720 \uBB38\uC11C\uD568\uC5D0\uC11C\uB3C4 \uD30C\uC77C\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." }}</p>
          </div>
          <button type="button" class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600" @click="closeShareDialog">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
          <div class="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input v-model="shareEmail" type="email" class="file-filter__input" :disabled="!canCreateShares" :placeholder="canCreateShares ? '\uACF5\uC720\uD560 \uC0C1\uB300\uC758 \uC774\uBA54\uC77C' : '\uD50C\uB7EC\uC2A4 \uC774\uC0C1 \uBA64\uBC84\uC2ED\uC5D0\uC11C \uC0C8 \uACF5\uC720 \uCD94\uAC00 \uAC00\uB2A5'" @keydown.enter.prevent="submitShare" />
            <button type="button" class="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300" :disabled="isSharing || !canCreateShares" @click="submitShare">{{ isSharing ? "\uACF5\uC720 \uC911..." : "\uACF5\uC720 \uC801\uC6A9" }}</button>
          </div>
        <div class="mt-4 rounded-2xl border border-gray-200 p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-gray-900">대상 선택</p>
            <p class="text-xs text-gray-500">사용자, 그룹, 이메일을 함께 선택할 수 있습니다.</p>
          </div>
          <div v-if="isShareGroupOverviewLoading" class="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-gray-500">공유 대상을 불러오는 중입니다.</div>
          <div v-else class="mt-4 grid gap-4 lg:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-sm font-semibold text-gray-900">사용자</p>
              <div v-if="shareOverviewUsers.length" class="mt-3 space-y-2">
                <label v-for="relationship in shareOverviewUsers" :key="relationship.relationshipId" class="flex items-start gap-3 rounded-2xl border border-white/70 bg-white px-3 py-3 text-sm text-gray-700">
                  <input v-model="shareTargetUserIds" type="checkbox" :value="relationship.targetUser?.userId" class="mt-1" />
                  <span class="flex flex-col">
                    <strong class="text-gray-900">{{ relationship.targetUser?.name || '이름 없음' }}</strong>
                    <span>{{ relationship.targetUser?.email || '-' }}</span>
                  </span>
                </label>
              </div>
              <div v-else class="mt-3 text-sm text-gray-500">선택 가능한 사용자가 없습니다.</div>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <p class="text-sm font-semibold text-gray-900">그룹</p>
              <div v-if="shareOverviewGroups.length" class="mt-3 space-y-2">
                <label v-for="group in shareOverviewGroups" :key="group.groupId" class="flex items-center gap-3 rounded-2xl border border-white/70 bg-white px-3 py-3 text-sm text-gray-700">
                  <input v-model="shareTargetGroupIds" type="checkbox" :value="group.groupId" class="mt-0.5" />
                  <span class="flex flex-col">
                    <strong class="text-gray-900">{{ group.name }}</strong>
                    <span>{{ group.relationshipCount || 0 }}명 연결</span>
                  </span>
                </label>
              </div>
              <div v-else class="mt-3 text-sm text-gray-500">생성된 그룹이 없습니다.</div>
            </div>
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input v-model="shareCancelEmail" type="email" class="file-filter__input" :placeholder="'\uACF5\uC720 \uCDE8\uC18C\uD560 \uC774\uBA54\uC77C'" @keydown.enter.prevent="cancelShare()" />
          <button type="button" class="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed" :disabled="isSharing" @click="cancelShare()">{{ "\uACF5\uC720 \uCDE8\uC18C" }}</button>
        </div>
        <p v-if="shareError" class="mt-3 text-sm text-rose-500">{{ shareError }}</p>
        <div v-if="sharePendingInvites.length" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <p class="font-semibold">회원이 아닌 이메일은 초대로 저장되었습니다.</p>
          <ul class="mt-2 space-y-1">
            <li v-for="invite in sharePendingInvites" :key="invite.inviteId">{{ invite.email }}</li>
          </ul>
        </div>
        <div class="mt-6 rounded-2xl border border-gray-200 p-4">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-gray-900">{{ "\uD604\uC7AC \uACF5\uC720 \uBAA9\uB85D" }}</p>
            <p class="text-xs text-gray-500">{{ "\uC120\uD0DD\uD55C \uD30C\uC77C\uB4E4\uC744 \uAE30\uC900\uC73C\uB85C \uC218\uC2E0\uC790\uC640 \uACF5\uC720 \uD30C\uC77C \uBAA9\uB85D\uC744 \uD568\uAED8 \uD45C\uC2DC\uD569\uB2C8\uB2E4." }}</p>
          </div>
          <div v-if="isShareInfoLoading" class="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-gray-500">{{ "\uACF5\uC720 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4." }}</div>
          <div v-else-if="shareInfo.length === 0" class="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-gray-500">{{ "\uD604\uC7AC \uACF5\uC720 \uC911\uC778 \uC0C1\uB300\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4." }}</div>
          <div v-else class="mt-4 space-y-3">
            <div v-for="item in shareInfo" :key="item.shareIdx || `${item.fileIdx}-${item.recipientEmail}`" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3">
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ item.recipientName || item.recipientEmail }}</p>
                <p class="text-xs text-gray-500">{{ item.recipientEmail }}</p>
                <p class="mt-1 text-xs text-gray-500">파일: {{ formatSharedFilesLabel(item) }}</p>
                <p class="mt-1 text-xs text-gray-400">{{ formatDisplayDate(item.createdAt) }}</p>
              </div>
              <button type="button" class="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100" @click="cancelShare(item.recipientEmail)">{{ "\uC774 \uC0C1\uB300 \uACF5\uC720 \uCDE8\uC18C" }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <FilePreviewModal :file="previewTarget" @close="closeFilePreview" />
  </div>
</template>

<style scoped>
.toolbar-shell { display: grid; gap: 1rem; align-items: stretch; padding: 1.15rem 1.2rem 1.2rem; background: linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 74%, var(--bg-main) 26%) 0%, var(--bg-elevated) 62%); border: 1px solid color-mix(in srgb, var(--border-color) 78%, transparent); border-radius: 1.7rem; box-shadow: var(--shadow-sm); }
.toolbar-copy { display: flex; min-width: 0; flex-direction: column; gap: 0.72rem; }
.toolbar-overview { border-radius: 1.3rem; border: 1px solid color-mix(in srgb, var(--border-color) 86%, transparent); background: color-mix(in srgb, var(--bg-elevated) 84%, var(--bg-input) 16%); padding: 1rem 1.05rem; }
.toolbar-overview__main { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.9rem; }
.toolbar-overview__title-wrap { min-width: 0; }
.toolbar-overview__title { font-size: 1.32rem; font-weight: 800; line-height: 1.1; color: var(--text-main); }
.toolbar-overview__meta { margin-top: 0.32rem; font-size: 0.88rem; color: var(--text-muted); }
.toolbar-overview__slots { display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem; }
.toolbar-copy__actions { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.toolbar-chip-row { display: flex; flex-wrap: wrap; gap: 0.55rem; }
.toolbar-chip { display: inline-flex; align-items: center; border-radius: 999px; background: var(--bg-input); padding: 0.5rem 0.8rem; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); border: 1px solid color-mix(in srgb, var(--border-color) 84%, transparent); }
.toolbar-chip--accent { background: var(--accent-soft); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 24%, transparent); }
.toolbar-reset { border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent); padding: 0.5rem 0.9rem; font-size: 0.78rem; font-weight: 800; color: var(--accent); transition: background-color 0.18s ease, border-color 0.18s ease; white-space: nowrap; }
.toolbar-reset:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); border-color: color-mix(in srgb, var(--accent) 36%, transparent); }
.toolbar-folder-panel { display: grid; gap: 0.85rem; border-radius: 1.3rem; border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent); background: color-mix(in srgb, var(--bg-elevated) 90%, var(--bg-input) 10%); padding: 1rem 1.05rem; }
.toolbar-folder-panel__header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.85rem; }
.toolbar-folder-panel__label { font-size: 0.74rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.toolbar-folder-panel__path { margin-top: 0.4rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.24rem; font-size: 0.95rem; color: var(--text-secondary); }
.toolbar-folder-panel__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.55rem; }
.toolbar-inline-button { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid var(--border-color); background: color-mix(in srgb, var(--bg-main) 90%, var(--bg-input) 10%); padding: 0.5rem 0.9rem; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease; }
.toolbar-inline-button:hover { background: color-mix(in srgb, var(--bg-input) 85%, var(--bg-main) 15%); }
.toolbar-inline-button--accent { border-color: color-mix(in srgb, var(--accent) 24%, transparent); color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.toolbar-inline-button--accent:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.toolbar-folder-stats { display: grid; gap: 0.7rem; }
.toolbar-folder-stat { border-radius: 1.1rem; border: 1px solid color-mix(in srgb, var(--border-color) 86%, transparent); background: color-mix(in srgb, var(--bg-main) 82%, var(--bg-input) 18%); padding: 0.9rem 0.95rem; }
.toolbar-folder-stat__label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
.toolbar-folder-stat__value { margin-top: 0.38rem; font-size: 1.5rem; font-weight: 800; color: var(--text-main); }
.toolbar-controls { display: grid; gap: 0.9rem; align-items: end; border-radius: 1.35rem; border: 1px solid color-mix(in srgb, var(--border-color) 90%, transparent); background: color-mix(in srgb, var(--bg-elevated) 82%, var(--bg-input) 18%); padding: 1rem; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-inverse) 6%, transparent); }
.toolbar-toggle-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.file-pagination-bar { display: grid; gap: 0.85rem; align-items: center; position: relative; z-index: 1; margin-bottom: calc(var(--upload-panel-safe-space, 0px) * 0.4); }
.file-pagination-bar__pages { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
.file-pagination-bar__spacer { display: none; }
.file-filter { display: flex; min-width: 0; flex-direction: column; gap: 0.45rem; }
.file-filter__label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
.file-filter__input { width: 100%; border-radius: 0.9rem; border: 1px solid var(--border-strong); background: var(--bg-main); padding: 0.7rem 0.9rem; font-size: 0.9rem; color: var(--text-main); outline: none; transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease; }
.file-filter__input--readonly { display: flex; align-items: center; font-weight: 700; color: var(--text-secondary); background: color-mix(in srgb, var(--bg-input) 80%, var(--bg-main) 20%); }
.file-filter__input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent); }
.file-filter__inline-grid { display: grid; gap: 0.55rem; }
.file-filter__inline-grid--layout { grid-template-columns: minmax(0, 1fr); }
.file-filter__hint { font-size: 0.75rem; color: var(--text-muted); }
.view-toggle { border-radius: 999px; border: 1px solid var(--border-strong); background: color-mix(in srgb, var(--bg-main) 85%, var(--bg-input) 15%); padding: 0.68rem 0.95rem; font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); transition: all 0.18s ease; }
.view-toggle.is-active { border-color: color-mix(in srgb, var(--accent) 34%, transparent); background: var(--accent-soft); color: var(--accent); }
.batch-button { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0.55rem 0.9rem; font-size: 0.8rem; font-weight: 700; transition: background-color 0.18s ease, color 0.18s ease; }
.page-button { display: inline-flex; min-width: 2.3rem; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid var(--border-color); background: color-mix(in srgb, var(--bg-main) 90%, var(--bg-input) 10%); padding: 0.45rem 0.8rem; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); transition: all 0.18s ease; }
.page-button.is-active { border-color: var(--accent); background: var(--accent); color: var(--text-inverse); box-shadow: 0 10px 20px color-mix(in srgb, var(--accent) 28%, transparent); }
.page-button:disabled { cursor: not-allowed; opacity: 0.5; }
.breadcrumb-button { border-radius: 999px; padding: 0.2rem 0.7rem; font-weight: 600; transition: background-color 0.18s ease, color 0.18s ease; }
.breadcrumb-button:hover { background: var(--accent-soft); color: var(--accent); }
@media (min-width: 640px) {
  .file-filter__inline-grid { grid-template-columns: minmax(0, 1fr) 8rem; }
  .file-filter__inline-grid--layout { grid-template-columns: minmax(0, 1.1fr) repeat(2, minmax(0, 0.72fr)); }
  .toolbar-folder-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 960px) {
  .toolbar-shell { grid-template-columns: minmax(0, 1.2fr) minmax(340px, 0.98fr); }
  .toolbar-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .toolbar-folder-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .file-pagination-bar { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .file-pagination-bar__pages { justify-self: center; }
  .file-pagination-bar__spacer { display: block; }
}
</style>
