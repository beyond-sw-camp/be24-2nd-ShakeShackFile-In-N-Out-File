<script setup>
import { computed, ref, watch } from "vue";
import { useFileStore } from "@/stores/useFileStore";
import { useViewStore } from "@/stores/viewStore";
import { downloadFileAsset } from "@/api/filesApi.js";
import {
  getCachedFileThumbnailUrl,
  getFileThumbnailCacheKey,
  loadFileThumbnailUrl,
} from "@/utils/fileThumbnailCache.js";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "heic", "avif", "apng", "jfif", "tif", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "wmv", "m4v", "mpeg", "mpg", "ogv", "3gp"]);

const props = defineProps({
  files: {
    type: Array,
    required: true,
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
  deleteMode: {
    type: String,
    default: "trash",
  },
  showParentNavigator: {
    type: Boolean,
    default: false,
  },
  parentFolderTargetId: {
    type: Number,
    default: null,
  },
  sharedLibrary: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:selectedIds",
  "delete-file",
  "restore-file",
  "rename-folder",
  "show-folder-properties",
  "preview-file",
  "share-file",
  "toggle-lock",
  "save-to-drive",
]);

const fileStore = useFileStore();
const { viewMode, resolvedLayoutColumns } = useViewStore();
const brokenPreviewIds = ref([]);
const brokenThumbnailIds = ref([]);
const thumbnailSourceByKey = ref({});
const thumbnailStateByKey = ref({});
const dragTargetId = ref(null);
const draggingFileIds = ref([]);
const downloadingIds = ref([]);
let refreshListTimerId = null;
const planCapabilities = computed(() => fileStore.planCapabilities);
const canCreateShares = computed(() => Boolean(planCapabilities.value?.shareEnabled));
const canCreateLocks = computed(() => Boolean(planCapabilities.value?.fileLockEnabled));

const selectedIdSet = computed(() => new Set(props.selectedIds.map((id) => String(id))));
const downloadingIdSet = computed(() => new Set(downloadingIds.value.map((id) => String(id))));
const visibleFileIds = computed(() => props.files.map((file) => String(file?.id)).filter(Boolean));
const allVisibleSelected = computed(() =>
  visibleFileIds.value.length > 0 &&
  visibleFileIds.value.every((id) => selectedIdSet.value.has(String(id))),
);
const canSelect = computed(() => true);
const showActions = computed(() => viewMode.value !== "icon");

const gridClassName = computed(() => {
  if (viewMode.value === "icon") {
    return "file-icon-grid";
  }

  if (viewMode.value === "grid") {
    return "file-card-grid";
  }

  return "";
});

const collectionStyle = computed(() => {
  if (viewMode.value === "table") {
    return undefined;
  }

  const columns = Math.max(5, Number(resolvedLayoutColumns.value || 5));
  const compactFactor = viewMode.value === "grid"
    ? Math.max(0.34, Math.min(1, 6 / Math.max(columns, 5)))
    : Math.max(0.3, Math.min(1, 10 / Math.max(columns, 5)));
  const gapPx = viewMode.value === "grid"
    ? Math.max(4, Math.min(16, Math.round(20 - (columns - 5) * 0.9)))
    : Math.max(3, Math.min(12, Math.round(14 - (columns - 5) * 0.65)));

  return {
    "--collection-columns": String(columns),
    "--collection-gap": `${gapPx}px`,
    "--card-padding": `${Math.max(10, Math.round(20 * compactFactor))}px`,
    "--card-preview-height": `${Math.max(76, Math.round(144 * compactFactor))}px`,
    "--card-preview-icon-size": `${Math.max(22, Math.round(40 * compactFactor))}px`,
    "--card-title-size": `${Math.max(11, 15 * compactFactor)}px`,
    "--card-meta-size": `${Math.max(9.5, 12 * compactFactor)}px`,
    "--card-detail-size": `${Math.max(9.5, 12 * compactFactor)}px`,
    "--card-button-font-size": `${Math.max(9.5, 12.5 * compactFactor)}px`,
    "--card-button-padding-y": `${Math.max(5, Math.round(8 * compactFactor))}px`,
    "--card-button-padding-x": `${Math.max(7, Math.round(12 * compactFactor))}px`,
    "--card-button-radius": `${Math.max(10, Math.round(14 * compactFactor))}px`,
    "--card-button-min-width": `${Math.max(56, Math.round(90 * compactFactor))}px`,
    "--card-status-font-size": `${Math.max(9, 11.5 * compactFactor)}px`,
    "--card-status-padding-y": `${Math.max(4, Math.round(6 * compactFactor))}px`,
    "--card-status-padding-x": `${Math.max(7, Math.round(12 * compactFactor))}px`,
    "--card-status-gap": `${Math.max(4, Math.round(6 * compactFactor))}px`,
    "--card-status-icon-size": `${Math.max(10, Math.round(15 * compactFactor))}px`,
  };
});

const extractExtension = (fileName = "") => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) {
    return "";
  }
  return fileName.slice(lastDot + 1).trim().toLowerCase();
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

const formatDisplaySize = (file) => {
  if (typeof file?.sizeLabel === "string") return file.sizeLabel;
  if (typeof file?.size === "string") return file.size;

  const bytes = Number(file?.sizeBytes ?? file?.fileSize ?? file?.size ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const getFileName = (file) => file?.name || file?.fileOriginName || "이름 없는 파일";
const getFileExtension = (file) => String(file?.extension || file?.fileFormat || extractExtension(getFileName(file))).toLowerCase();
const getUpdatedAt = (file) => file?.updatedAtLabel || formatDisplayDate(file?.updatedAt || file?.lastModified || file?.uploadDate);
const getSharedOwnerLabel = (file) => file?.ownerName || file?.ownerEmail || "알 수 없는 사용자";
const getSharedAtLabel = (file) => file?.sharedAtLabel || formatDisplayDate(file?.sharedAt);
const getSharedOwnerText = (file) => `\uACF5\uC720\uC790: ${getSharedOwnerLabel(file)}`;
const getSharedSourceLabel = (file) => {
  const sharedAtLabel = getSharedAtLabel(file);

  if (sharedAtLabel && sharedAtLabel !== "-") {
    return `${getSharedOwnerText(file)} | ${sharedAtLabel}`;
  }

  return getSharedOwnerText(file);
};

const getSentShareLabel = (file) => {
  const sharedAtLabel = getSharedAtLabel(file);
  const recipientLabel = file?.shareRecipientsLabel || (file?.recipientCount ? `공유 대상 ${file.recipientCount}명` : "공유 중");

  if (sharedAtLabel && sharedAtLabel !== "-") {
    return `${recipientLabel} | ${sharedAtLabel}`;
  }

  return recipientLabel;
};
const getPreviewUrl = (file) => file?.downloadUrl || file?.presignedDownloadUrl || "";
const getThumbnailUrl = (file) => file?.thumbnailUrl || file?.thumbnailPresignedUrl || "";
const getContentType = (file) => String(file?.contentType || file?.raw?.contentType || "").toLowerCase();
const hasBrokenPreview = (file) => brokenPreviewIds.value.includes(String(file?.id));
const hasBrokenThumbnail = (file) => brokenThumbnailIds.value.includes(String(file?.id));
const getManagedThumbnailKey = (file) => getFileThumbnailCacheKey(file);
const getManagedThumbnailState = (file) => {
  const key = getManagedThumbnailKey(file);
  return key ? (thumbnailStateByKey.value[key] || "idle") : "idle";
};
const getManagedThumbnailUrl = (file) => {
  const key = getManagedThumbnailKey(file);
  return key ? (thumbnailSourceByKey.value[key] || "") : "";
};

const setManagedThumbnailState = (cacheKey, state) => {
  if (!cacheKey) {
    return;
  }

  thumbnailStateByKey.value = {
    ...thumbnailStateByKey.value,
    [cacheKey]: state,
  };
};

const setManagedThumbnailSource = (cacheKey, sourceUrl) => {
  if (!cacheKey) {
    return;
  }

  thumbnailSourceByKey.value = {
    ...thumbnailSourceByKey.value,
    [cacheKey]: sourceUrl,
  };
};

const clearManagedThumbnailSource = (file) => {
  const cacheKey = getManagedThumbnailKey(file);
  if (!cacheKey || !thumbnailSourceByKey.value[cacheKey]) {
    return false;
  }

  const nextSources = { ...thumbnailSourceByKey.value };
  delete nextSources[cacheKey];
  thumbnailSourceByKey.value = nextSources;
  setManagedThumbnailState(cacheKey, "failed");
  return true;
};

const shouldUseManagedThumbnail = (file) => {
  if (!file || file?.type === "folder" || isLocked(file)) {
    return false;
  }

  const extension = getFileExtension(file);
  const contentType = getContentType(file);
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("video/") ||
    IMAGE_EXTENSIONS.has(extension) ||
    VIDEO_EXTENSIONS.has(extension)
  );
};

const primeManagedThumbnails = async (files = []) => {
  const nextSourceMap = {};
  const nextStateMap = {};
  const candidates = [];

  for (const file of files) {
    if (!shouldUseManagedThumbnail(file)) {
      continue;
    }

    const cacheKey = getManagedThumbnailKey(file);
    if (!cacheKey) {
      continue;
    }

    const cachedUrl = getCachedFileThumbnailUrl(file);
    if (cachedUrl) {
      nextSourceMap[cacheKey] = cachedUrl;
      nextStateMap[cacheKey] = "ready";
      continue;
    }

    nextStateMap[cacheKey] = thumbnailStateByKey.value[cacheKey] === "failed" ? "failed" : "loading";
    candidates.push({ file, cacheKey });
  }

  thumbnailSourceByKey.value = nextSourceMap;
  thumbnailStateByKey.value = nextStateMap;

  await Promise.allSettled(candidates.map(async ({ file, cacheKey }) => {
    const objectUrl = await loadFileThumbnailUrl(file);
    if (objectUrl) {
      setManagedThumbnailSource(cacheKey, objectUrl);
      setManagedThumbnailState(cacheKey, "ready");
      return;
    }

    setManagedThumbnailState(cacheKey, "failed");
  }));
};

const markBrokenAsset = (stateRef, file) => {
  const fileId = String(file?.id || "");
  if (!fileId || stateRef.value.includes(fileId)) {
    return;
  }

  stateRef.value = [...stateRef.value, fileId];
};

const scheduleAssetRefresh = () => {
  if (refreshListTimerId) {
    return;
  }

  refreshListTimerId = window.setTimeout(async () => {
    refreshListTimerId = null;
    try {
      if (fileStore.driveHasLoaded && !fileStore.hasLoaded) {
        await fileStore.refreshDrivePage();
      } else {
        await fileStore.fetchFiles();
      }
    } catch {
    }
  }, 900);
};

const handlePreviewAssetError = (file) => {
  if (clearManagedThumbnailSource(file)) {
    return;
  }
  markBrokenAsset(brokenPreviewIds, file);
  scheduleAssetRefresh();
};

const handleThumbnailAssetError = (file) => {
  if (clearManagedThumbnailSource(file)) {
    return;
  }
  markBrokenAsset(brokenThumbnailIds, file);
  scheduleAssetRefresh();
};

const isLocked = (file) => Boolean(file?.lockedFile);
const isImage = (file) => {
  const contentType = getContentType(file);
  return file?.type !== "folder" && !hasBrokenPreview(file) && (
    contentType.startsWith("image/") || IMAGE_EXTENSIONS.has(getFileExtension(file))
  );
};
const isVideo = (file) => {
  const contentType = getContentType(file);
  return file?.type !== "folder" && (
    contentType.startsWith("video/") || VIDEO_EXTENSIONS.has(getFileExtension(file))
  );
};
const hasVideoThumbnail = (file) => {
  if (!isVideo(file) || hasBrokenThumbnail(file)) {
    return false;
  }

  const managedThumbnailUrl = getManagedThumbnailUrl(file);
  if (managedThumbnailUrl) {
    return true;
  }

  return getManagedThumbnailState(file) === "failed" && Boolean(getThumbnailUrl(file));
};
const getImageCardUrl = (file) => {
  const managedThumbnailUrl = getManagedThumbnailUrl(file);
  if (managedThumbnailUrl) {
    return managedThumbnailUrl;
  }

  return getManagedThumbnailState(file) === "failed"
    ? getPreviewUrl(file)
    : "";
};
const getVideoCardUrl = (file) => {
  const managedThumbnailUrl = getManagedThumbnailUrl(file);
  if (managedThumbnailUrl) {
    return managedThumbnailUrl;
  }

  return getManagedThumbnailState(file) === "failed"
    ? getThumbnailUrl(file)
    : "";
};
const canDownload = (file) => file?.type !== "folder" && !isLocked(file) && Boolean(getPreviewUrl(file));
const isDownloading = (file) => downloadingIdSet.value.has(String(file?.id));

const handleDownload = async (file, event) => {
  event?.stopPropagation?.();
  if (isDownloading(file)) {
    return;
  }

  const fileId = String(file?.id || "");

  try {
    if (fileId) {
      downloadingIds.value = [...downloadingIds.value, fileId];
    }
    await downloadFileAsset(file);
  } catch (error) {
    window.alert(error?.message || "\uD30C\uC77C\uC744 \uB2E4\uC6B4\uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  } finally {
    if (fileId) {
      downloadingIds.value = downloadingIds.value.filter((id) => id !== fileId);
    }
  }
};
const canDelete = (file) => !props.sharedLibrary && !file?.sharedWithMe && !isLocked(file);
const canRestore = (file) => !props.sharedLibrary && props.deleteMode === "permanent" && file?.isTrash;
const canManageFolder = (file) => !props.sharedLibrary && props.deleteMode !== "permanent" && file?.type === "folder" && !file?.isTrash;
const canShare = (file) => !props.sharedLibrary && !file?.sharedWithMe && file?.type !== "folder" && !file?.isTrash && !isLocked(file) && (canCreateShares.value || file?.sharedFile);
const canToggleLock = (file) => !props.sharedLibrary && !file?.sharedWithMe && file?.type !== "folder" && !file?.isTrash && (canCreateLocks.value || file?.lockedFile);
const canSaveShared = (file) => Boolean(file?.sharedWithMe) && file?.type !== "folder" && !isLocked(file);
const canManageSentShare = (file) => Boolean(props.sharedLibrary && file?.sharedFile && !file?.sharedWithMe && file?.type !== "folder");
const isMovable = (file) => !props.sharedLibrary && props.deleteMode !== "permanent" && !file?.sharedWithMe && !file?.isTrash && !isLocked(file);

watch(
  () => props.files,
  (files) => {
    void primeManagedThumbnails(files || []);
  },
  { immediate: true },
);
const isFolderDropTarget = (file) => canManageFolder(file);
const getDeleteConfirmMessage = (file) => {
  if (file?.sharedFile && !file?.sharedWithMe) {
    return "공유된 파일입니다 삭제하시겠습니까? 공유된 사람에게도 사라집니다.";
  }

  const targetLabel = file?.type === "folder" ? "폴더" : "파일";
  return props.deleteMode === "permanent"
    ? `'${getFileName(file)}' ${targetLabel}을 영구 삭제하시겠습니까?`
    : `'${getFileName(file)}' ${targetLabel}을 휴지통으로 이동하시겠습니까?`;
};

const getStatusChips = (file) => {
  const chips = [];

  if (file?.sharedWithMe) {
    chips.push({ key: "shared-with-me", label: "공유받음", icon: "in", tone: "shared-in" });
  }

  if (file?.sharedFile && !file?.sharedWithMe) {
    chips.push({ key: "shared-file", label: "공유 중", icon: "out", tone: "shared-out" });
  }

  if (file?.lockedFile) {
    chips.push({ key: "locked", label: "잠금", icon: "lock", tone: "locked" });
  }

  if (!chips.length) {
    chips.push({ key: "normal", label: "일반", icon: "dot", tone: "normal" });
  }

  return chips;
};

watch(
  () => props.files,
  () => {
    brokenPreviewIds.value = [];
    brokenThumbnailIds.value = [];
  },
  { deep: true },
);

const updateSelectedIds = (ids) => {
  emit("update:selectedIds", ids.map((id) => String(id)));
};

const toggleFileSelection = (fileId, checked) => {
  const normalizedId = String(fileId);
  if (!normalizedId) {
    return;
  }

  if (checked) {
    if (!selectedIdSet.value.has(normalizedId)) {
      updateSelectedIds([...props.selectedIds, normalizedId]);
    }
    return;
  }

  updateSelectedIds(props.selectedIds.filter((id) => String(id) !== normalizedId));
};

const toggleSelectAllVisible = (checked) => {
  const visibleIdSet = new Set(visibleFileIds.value);

  if (checked) {
    updateSelectedIds([
      ...new Set([
        ...props.selectedIds.map((id) => String(id)),
        ...visibleFileIds.value,
      ]),
    ]);
    return;
  }

  updateSelectedIds(props.selectedIds.filter((id) => !visibleIdSet.has(String(id))));
};

const ensureUnlocked = (file) => {
  if (isLocked(file)) {
    window.alert("이 파일은 잠겨있습니다.");
    return false;
  }

  return true;
};

const handlePrimaryAction = (file) => {
  if (!file) {
    return;
  }

  if (file.type === "folder") {
    if (props.deleteMode !== "permanent" && !props.sharedLibrary) {
      fileStore.enterFolder(file.id);
    }
    return;
  }

  if (!ensureUnlocked(file)) {
    return;
  }

  emit("preview-file", file);
};

const onClickDelete = (file, event) => {
  event.stopPropagation();
  if (!canDelete(file)) {
    return;
  }

  const targetLabel = file?.type === "folder" ? "폴더" : "파일";
  const confirmMessage = props.deleteMode === "permanent"
    ? `'${getFileName(file)}' ${targetLabel}을(를) 영구 삭제하시겠습니까?`
    : `'${getFileName(file)}' ${targetLabel}을(를) 휴지통으로 이동하시겠습니까?`;

  if (window.confirm(getDeleteConfirmMessage(file))) {
    emit("delete-file", file?.id);
  }
};

const onClickRestore = (file, event) => {
  event.stopPropagation();
  if (!canRestore(file)) {
    return;
  }

  if (window.confirm(`'${getFileName(file)}' 항목을 원래 위치로 복구하시겠습니까?`)) {
    emit("restore-file", file?.id);
  }
};

const onClickRenameFolder = (file, event) => {
  event.stopPropagation();
  emit("rename-folder", file);
};

const onClickShowFolderProperties = (file, event) => {
  event.stopPropagation();
  emit("show-folder-properties", file);
};

const onClickShare = (file, event) => {
  event.stopPropagation();
  if (!ensureUnlocked(file)) {
    return;
  }
  emit("share-file", [file]);
};

const onClickManageSentShare = (file, event) => {
  event.stopPropagation();
  emit("share-file", [file]);
};

const onClickToggleLock = (file, event) => {
  event.stopPropagation();
  emit("toggle-lock", file);
};

const onClickSaveShared = (file, event) => {
  event.stopPropagation();
  if (!ensureUnlocked(file)) {
    return;
  }
  emit("save-to-drive", file);
};

const getDragFileIds = (file) => {
  const fileId = String(file?.id);
  if (!fileId) {
    return [];
  }

  const normalizedSelectedIds = props.selectedIds
    .map((id) => String(id))
    .filter(Boolean);

  if (normalizedSelectedIds.length > 0) {
    return normalizedSelectedIds;
  }

  return [fileId];
};

const readDraggedFileIds = (event) => {
  const payload = event?.dataTransfer?.getData("text/plain");
  if (!payload) {
    return [...draggingFileIds.value];
  }

  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed?.fileIds)) {
      return parsed.fileIds.map((id) => String(id));
    }
  } catch {
    return [...draggingFileIds.value];
  }

  return [...draggingFileIds.value];
};

const onDragStart = (event, file) => {
  if (!isMovable(file)) {
    event.preventDefault();
    return;
  }

  const fileIds = getDragFileIds(file);
  draggingFileIds.value = fileIds;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify({ fileIds }));
};

const onDragEnd = () => {
  draggingFileIds.value = [];
  dragTargetId.value = null;
};

const onDragOverFolder = (event, folder) => {
  if (!isFolderDropTarget(folder)) {
    return;
  }

  const draggedFileIds = readDraggedFileIds(event)
    .filter((id) => String(id) !== String(folder.id));
  if (!draggedFileIds.length) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dragTargetId.value = folder.id;
};

const onDragLeaveFolder = (folder) => {
  if (String(dragTargetId.value) === String(folder?.id)) {
    dragTargetId.value = null;
  }
};

const onDropToFolder = async (event, folder) => {
  if (!isFolderDropTarget(folder)) {
    return;
  }

  event.preventDefault();
  const draggedFileIds = readDraggedFileIds(event)
    .filter((id) => String(id) !== String(folder.id));
  dragTargetId.value = null;
  draggingFileIds.value = [];
  if (!draggedFileIds.length) {
    return;
  }

  try {
    if (draggedFileIds.length === 1) {
      await fileStore.moveFileToFolder(draggedFileIds[0], folder.id);
    } else {
      await fileStore.moveFilesToFolder(draggedFileIds, folder.id);
    }

    updateSelectedIds(props.selectedIds.filter((id) => !draggedFileIds.includes(String(id))));
  } catch (error) {
    window.alert(
      error?.response?.data?.message ||
      error?.message ||
      "폴더로 이동하지 못했습니다.",
    );
  }
};

const onDragOverParentNavigator = (event) => {
  if (!props.showParentNavigator || props.deleteMode === "permanent" || props.sharedLibrary) {
    return;
  }

  const draggedFileIds = readDraggedFileIds(event);
  if (!draggedFileIds.length) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dragTargetId.value = "__parent__";
};

const onDragLeaveParentNavigator = () => {
  if (dragTargetId.value === "__parent__") {
    dragTargetId.value = null;
  }
};

const onDropToParentNavigator = async (event) => {
  if (!props.showParentNavigator || props.deleteMode === "permanent" || props.sharedLibrary) {
    return;
  }

  event.preventDefault();
  const draggedFileIds = readDraggedFileIds(event);
  dragTargetId.value = null;
  draggingFileIds.value = [];
  if (!draggedFileIds.length) {
    return;
  }

  try {
    if (draggedFileIds.length === 1) {
      await fileStore.moveFileToFolder(draggedFileIds[0], props.parentFolderTargetId);
    } else {
      await fileStore.moveFilesToFolder(draggedFileIds, props.parentFolderTargetId);
    }

    updateSelectedIds(props.selectedIds.filter((id) => !draggedFileIds.includes(String(id))));
  } catch (error) {
    window.alert(
      error?.response?.data?.message ||
      error?.message ||
      "상위 폴더로 이동하지 못했습니다.",
    );
  }
};
</script>

<template>
  <div class="file-collection-shell">
    <div
      v-if="canSelect"
      class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
    >
      <label class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          :checked="allVisibleSelected"
          @change="toggleSelectAllVisible($event.target.checked)"
        />
        현재 페이지 전체 선택
      </label>

      <p class="text-xs text-gray-500">
        체크한 파일과 폴더는 상단 일괄 작업에서 함께 처리됩니다.
      </p>
    </div>

    <div
      v-if="viewMode === 'table'"
      class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-slate-50">
          <tr>
            <th class="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">선택</th>
            <th class="w-24 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">미리보기</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">이름</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">종류</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">크기</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">수정일</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">상태</th>
            <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">작업</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-if="showParentNavigator"
            class="cursor-pointer transition hover:bg-slate-50"
            @click="fileStore.goBack()"
            @dragover="onDragOverParentNavigator"
            @drop="onDropToParentNavigator"
          >
            <td class="px-4 py-4 text-gray-300">-</td>
            <td class="px-4 py-4">
              <div class="thumb-shell flex items-center justify-center bg-slate-100 text-slate-500">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </td>
            <td class="px-6 py-4 text-sm font-semibold text-gray-900">../</td>
            <td class="px-6 py-4 text-sm text-gray-500">상위 폴더</td>
            <td class="px-6 py-4 text-sm text-gray-500">-</td>
            <td class="px-6 py-4 text-sm text-gray-500">-</td>
            <td class="px-6 py-4 text-sm text-gray-500">이동</td>
            <td class="px-6 py-4 text-right text-sm text-blue-600">열기</td>
          </tr>
          
          
          <tr
            v-for="(file, index) in files"
            :key="file.id || file.idx || `${getFileName(file)}-${index}`"
            class="cursor-pointer transition hover:bg-slate-50"
            :draggable="isMovable(file)"
            @click="handlePrimaryAction(file)"
            @dragstart="onDragStart($event, file)"
            @dragover="onDragOverFolder($event, file)"
            @drop="onDropToFolder($event, file)"
          >
            <td class="px-4 py-4" @click.stop>
              <input
                v-if="canSelect"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :checked="selectedIdSet.has(String(file.id))"
                @change="toggleFileSelection(file.id, $event.target.checked)"
              />
            </td>

            <td class="px-4 py-4">
              <div v-if="file.type === 'folder'" class="thumb-shell bg-amber-50 text-amber-600">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
                </svg>
              </div>
              <img
                v-else-if="isImage(file) && Boolean(getImageCardUrl(file))"
                :src="getImageCardUrl(file)"
                :alt="getFileName(file)"
                class="thumb-shell object-cover"
                loading="lazy"
                @error="handlePreviewAssetError(file)"
              />
              <div v-else-if="isImage(file)" class="thumb-shell bg-emerald-50 text-emerald-600">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 2v8l2.5-2.5 2 2L14 9v7H6V6Zm2 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                </svg>
              </div>
              <div v-else-if="hasVideoThumbnail(file)" class="thumb-shell overflow-hidden bg-black">
                <img
                  :src="getVideoCardUrl(file)"
                  :alt="`${getFileName(file)} thumbnail`"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  @error="handleThumbnailAssetError(file)"
                />
              </div>
              <div v-else-if="isVideo(file)" class="thumb-shell bg-slate-900 text-white">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 4.5v11l9-5.5-9-5.5Z" />
                </svg>
              </div>
              <div v-else class="thumb-shell bg-blue-50 text-blue-600">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
                </svg>
              </div>
            </td>

            <td class="px-6 py-4">
              <div class="min-w-0">
                <p class="file-entry__title truncate text-sm font-semibold text-gray-900">{{ getFileName(file) }}</p>
                <p class="mt-1 truncate text-xs text-gray-400">
                  {{ file.sharedWithMe ? getSharedSourceLabel(file) : (canManageSentShare(file) ? getSentShareLabel(file) : (file.location || '홈')) }}
                </p>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">
              {{ file.type === 'folder' ? '폴더' : (getFileExtension(file) || '-').toUpperCase() }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ formatDisplaySize(file) }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ getUpdatedAt(file) }}</td>
            <td class="px-6 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  v-for="chip in getStatusChips(file)"
                  :key="`${file.id}-${chip.key}`"
                  class="status-pill"
                  :class="`status-pill--${chip.tone}`"
                >
                  <span class="status-pill__icon" :class="`status-pill__icon--${chip.icon}`"></span>
                  {{ chip.label }}
                </span>
              </div>
            </td>
            <td class="px-6 py-4">
              <div v-if="showActions" class="flex flex-wrap justify-end gap-2">
                <button
                  v-if="canDownload(file)"
                  type="button"
                  class="action-button text-blue-600 hover:bg-blue-50"
                  :class="{ 'cursor-wait opacity-70': isDownloading(file) }"
                  :disabled="isDownloading(file)"
                  @click="handleDownload(file, $event)"
                >
                  {{ isDownloading(file) ? "\uC900\uBE44 \uC911..." : "\uB2E4\uC6B4\uB85C\uB4DC" }}
                </button>
                <button
                  v-if="canSaveShared(file)"
                  type="button"
                  class="action-button text-cyan-700 hover:bg-cyan-50"
                  @click="onClickSaveShared(file, $event)"
                >
                  홈에 저장
                </button>
                <button
                  v-if="canShare(file)"
                  type="button"
                  class="action-button text-emerald-700 hover:bg-emerald-50"
                  @click="onClickShare(file, $event)"
                >
                  공유
                </button>
                <button
                  v-if="canManageSentShare(file)"
                  type="button"
                  class="action-button text-violet-700 hover:bg-violet-50"
                  @click="onClickManageSentShare(file, $event)"
                >
                  공유 관리
                </button>
                <button
                  v-if="canToggleLock(file)"
                  type="button"
                  class="action-button hover:bg-amber-50"
                  :class="file.lockedFile ? 'text-amber-700' : 'text-slate-700'"
                  @click="onClickToggleLock(file, $event)"
                >
                  {{ file.lockedFile ? '잠금 해제' : '잠금' }}
                </button>
                <button
                  v-if="canManageFolder(file)"
                  type="button"
                  class="action-button text-slate-700 hover:bg-slate-100"
                  @click="onClickRenameFolder(file, $event)"
                >
                  이름 변경
                </button>
                <button
                  v-if="canManageFolder(file)"
                  type="button"
                  class="action-button text-indigo-700 hover:bg-indigo-50"
                  @click="onClickShowFolderProperties(file, $event)"
                >
                  속성
                </button>
                <button
                  v-if="canRestore(file)"
                  type="button"
                  class="action-button text-emerald-700 hover:bg-emerald-50"
                  @click="onClickRestore(file, $event)"
                >
                  원래 위치로 복구
                </button>
                <button
                  v-if="canDelete(file)"
                  type="button"
                  class="action-button text-rose-600 hover:bg-rose-50"
                  @click="onClickDelete(file, $event)"
                >
                  {{ deleteMode === 'permanent' ? '영구 삭제' : '삭제' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="grid gap-4" :class="gridClassName" :style="collectionStyle">
      <article
        v-if="showParentNavigator"
        class="file-entry group rounded-2xl border border-dashed border-gray-300 bg-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        :class="[
          viewMode === 'icon' ? 'file-entry--icon' : 'file-entry--card',
          { 'ring-2 ring-blue-300 border-blue-300 bg-blue-50/60': dragTargetId === '__parent__' },
        ]"
        @click="fileStore.goBack()"
        @dragover="onDragOverParentNavigator"
        @dragleave="onDragLeaveParentNavigator"
        @drop="onDropToParentNavigator"
      >
        <div
          class="flex items-center justify-center rounded-2xl bg-slate-100 text-slate-600"
          :class="viewMode === 'icon' ? 'file-entry__preview file-entry__preview--icon mb-3' : 'mb-4 h-14 w-14'"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </div>
        <p class="truncate text-sm font-semibold text-gray-900">상위 폴더</p>
        <p class="mt-1 text-xs text-gray-400">{{ viewMode === "icon" ? ".." : "../" }}</p>
      </article>

      <article
        v-for="(file, index) in files"
        :key="file.id || file.idx || `${getFileName(file)}-${index}`"
        class="file-entry group rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        :class="[
          viewMode === 'icon' ? 'file-entry--icon' : 'file-entry--card',
          { 'ring-2 ring-blue-300 border-blue-300 bg-blue-50/60': String(dragTargetId) === String(file.id) },
        ]"
        :draggable="isMovable(file)"
        @click="handlePrimaryAction(file)"
        @dragstart="onDragStart($event, file)"
        @dragend="onDragEnd"
        @dragover="onDragOverFolder($event, file)"
        @dragleave="onDragLeaveFolder(file)"
        @drop="onDropToFolder($event, file)"
      >
        <div class="file-entry__header flex items-start justify-between gap-3" :class="viewMode === 'icon' ? 'mb-3' : 'mb-4'">
          <label
            class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm"
            @click.stop
          >
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              :checked="selectedIdSet.has(String(file.id))"
              @change="toggleFileSelection(file.id, $event.target.checked)"
            />
          </label>

          <button
            v-if="viewMode !== 'icon' && canDelete(file)"
            type="button"
            class="action-icon text-rose-500 hover:bg-rose-50"
            @click="onClickDelete(file, $event)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          v-if="file.type === 'folder'"
          class="preview-box file-entry__preview flex items-center justify-center bg-amber-50 text-amber-600"
          :class="viewMode === 'icon' ? 'file-entry__preview--icon' : 'file-entry__preview--card'"
        >
          <svg class="file-entry__preview-graphic" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
          </svg>
        </div>
        <div v-else-if="isImage(file) && Boolean(getImageCardUrl(file))" class="preview-box file-entry__preview overflow-hidden bg-slate-100" :class="viewMode === 'icon' ? 'file-entry__preview--icon' : 'file-entry__preview--card'">
          <img
            :src="getImageCardUrl(file)"
            :alt="getFileName(file)"
            class="h-full w-full object-cover"
            loading="lazy"
            @error="handlePreviewAssetError(file)"
          />
        </div>
        <div v-else-if="isImage(file)" class="preview-box file-entry__preview flex items-center justify-center bg-emerald-50 text-emerald-600" :class="viewMode === 'icon' ? 'file-entry__preview--icon' : 'file-entry__preview--card'">
          <svg :class="viewMode === 'icon' ? 'h-8 w-8' : 'h-10 w-10'" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 2v8l2.5-2.5 2 2L14 9v7H6V6Zm2 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          </svg>
        </div>
        <div v-else-if="hasVideoThumbnail(file)" class="preview-box file-entry__preview overflow-hidden bg-black" :class="viewMode === 'icon' ? 'file-entry__preview--icon' : 'file-entry__preview--card'">
          <img
            :src="getVideoCardUrl(file)"
            :alt="`${getFileName(file)} thumbnail`"
            class="h-full w-full object-cover"
            loading="lazy"
            @error="handleThumbnailAssetError(file)"
          />
        </div>
        <div v-else-if="isVideo(file)" class="preview-box file-entry__preview flex items-center justify-center bg-slate-900 text-white" :class="viewMode === 'icon' ? 'file-entry__preview--icon' : 'file-entry__preview--card'">
          <svg class="file-entry__preview-graphic" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 4.5v11l9-5.5-9-5.5Z" />
          </svg>
        </div>
        <div v-else class="preview-box file-entry__preview flex items-center justify-center bg-blue-50 text-blue-600" :class="viewMode === 'icon' ? 'file-entry__preview--icon' : 'file-entry__preview--card'">
          <svg :class="viewMode === 'icon' ? 'h-8 w-8' : 'h-10 w-10'" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
          </svg>
        </div>

        <div class="mt-4">
          <p class="truncate text-sm font-semibold text-gray-900">{{ getFileName(file) }}</p>
          <p v-if="viewMode !== 'icon'" class="file-entry__meta mt-1 text-xs text-gray-400">
            {{ file.sharedWithMe ? getSharedSourceLabel(file) : (canManageSentShare(file) ? getSentShareLabel(file) : (file.type === 'folder' ? '폴더' : (getFileExtension(file) || '-').toUpperCase())) }}
          </p>
        </div>

        <template v-if="viewMode !== 'icon'">
          <dl class="file-entry__details mt-4 space-y-2 text-xs text-gray-500">
            <div class="flex items-center justify-between gap-3">
              <dt>크기</dt>
              <dd class="font-semibold text-gray-700">{{ formatDisplaySize(file) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt>수정</dt>
              <dd class="truncate font-semibold text-gray-700">{{ getUpdatedAt(file) }}</dd>
            </div>
          </dl>

          <div class="file-entry__status-row mt-4 flex flex-wrap items-center gap-2">
            <span
              v-for="chip in getStatusChips(file)"
              :key="`${file.id}-${chip.key}`"
              class="status-pill"
              :class="`status-pill--${chip.tone}`"
            >
              <span class="status-pill__icon" :class="`status-pill__icon--${chip.icon}`"></span>
              {{ chip.label }}
            </span>
          </div>

          <div class="file-entry__actions mt-4 flex flex-wrap gap-2">
            <button
              v-if="canDownload(file)"
              type="button"
              class="chip-button bg-blue-50 text-blue-600 hover:bg-blue-100"
              :class="{ 'cursor-wait opacity-70': isDownloading(file) }"
              :disabled="isDownloading(file)"
              @click="handleDownload(file, $event)"
            >
              {{ isDownloading(file) ? "\uC900\uBE44 \uC911..." : "\uB2E4\uC6B4\uB85C\uB4DC" }}
            </button>
            <button
              v-if="canSaveShared(file)"
              type="button"
              class="chip-button bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
              @click="onClickSaveShared(file, $event)"
            >
              홈에 저장
            </button>
            <button
              v-if="canShare(file)"
              type="button"
              class="chip-button bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              @click="onClickShare(file, $event)"
            >
              공유
            </button>
            <button
              v-if="canManageSentShare(file)"
              type="button"
              class="chip-button bg-violet-50 text-violet-700 hover:bg-violet-100"
              @click="onClickManageSentShare(file, $event)"
            >
              공유 관리
            </button>
            <button
              v-if="canToggleLock(file)"
              type="button"
              class="chip-button bg-amber-50 text-amber-700 hover:bg-amber-100"
              @click="onClickToggleLock(file, $event)"
            >
              {{ file.lockedFile ? '잠금 해제' : '잠금' }}
            </button>
            <button
              v-if="canManageFolder(file)"
              type="button"
              class="chip-button bg-slate-100 text-slate-700 hover:bg-slate-200"
              @click="onClickRenameFolder(file, $event)"
            >
              이름 변경
            </button>
            <button
              v-if="canManageFolder(file)"
              type="button"
              class="chip-button bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              @click="onClickShowFolderProperties(file, $event)"
            >
              속성
            </button>
            <button
              v-if="canRestore(file)"
              type="button"
              class="chip-button bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              @click="onClickRestore(file, $event)"
            >
              원래 위치로 복구
            </button>
          </div>
        </template>
      </article>
    </div>
  </div>
</template>

<style scoped>
.file-entry {
  min-width: 0;
}

.file-entry--card {
  padding: var(--card-padding, 1.25rem);
}

.file-entry--icon {
  padding: max(0.65rem, calc(var(--card-padding, 1rem) * 0.72));
}

.thumb-shell {
  display: flex;
  height: 3rem;
  width: 3rem;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 1rem;
}

.preview-box {
  min-width: 0;
  border-radius: 1.1rem;
}

.file-entry__preview {
  width: 100%;
}

.file-entry__preview--card {
  height: var(--card-preview-height, 9rem);
}

.file-entry__preview--icon {
  height: clamp(4.75rem, calc(var(--card-preview-height, 6rem) * 0.78), 6rem);
}

.file-entry__preview-graphic {
  width: var(--card-preview-icon-size, 2.5rem);
  height: var(--card-preview-icon-size, 2.5rem);
}

.file-entry--icon .file-entry__preview-graphic {
  width: clamp(1.6rem, calc(var(--card-preview-icon-size, 2rem) * 0.82), 2.15rem);
  height: clamp(1.6rem, calc(var(--card-preview-icon-size, 2rem) * 0.82), 2.15rem);
}

.file-entry__title {
  font-size: var(--card-title-size, 0.95rem);
  line-height: 1.35;
}

.file-entry__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--card-meta-size, 0.75rem);
  line-height: 1.35;
}

.file-entry__details {
  font-size: var(--card-detail-size, 0.75rem);
}

.file-entry__details dt,
.file-entry__details dd {
  min-width: 0;
}

.file-entry__details dd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-entry__header {
  gap: max(0.45rem, calc(var(--collection-gap, 1rem) * 0.75));
}

.file-entry__status-row {
  gap: max(0.35rem, calc(var(--collection-gap, 1rem) * 0.5));
}

.file-card-grid {
  gap: var(--collection-gap, 1rem);
  grid-template-columns: repeat(var(--collection-columns, 5), minmax(0, 1fr));
  align-content: start;
}

.file-icon-grid {
  gap: var(--collection-gap, 0.75rem);
  grid-template-columns: repeat(var(--collection-columns, 5), minmax(0, 1fr));
  align-content: start;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.45rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 700;
  transition: background-color 0.18s ease;
}

.action-icon {
  display: inline-flex;
  height: clamp(1.7rem, calc(var(--card-preview-icon-size, 2rem) * 0.8), 2rem);
  width: clamp(1.7rem, calc(var(--card-preview-icon-size, 2rem) * 0.8), 2rem);
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition: background-color 0.18s ease;
}

.file-entry__actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card-button-min-width, 5.5rem)), 1fr));
  gap: max(0.35rem, calc(var(--collection-gap, 1rem) * 0.5));
}

.chip-button {
  width: 100%;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--card-button-radius, 0.85rem);
  padding: var(--card-button-padding-y, 0.55rem) var(--card-button-padding-x, 0.8rem);
  font-size: var(--card-button-font-size, 0.78rem);
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color 0.18s ease;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--card-status-gap, 0.38rem);
  border-radius: 999px;
  border: 1px solid transparent;
  padding: var(--card-status-padding-y, 0.38rem) var(--card-status-padding-x, 0.72rem);
  font-size: var(--card-status-font-size, 0.72rem);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.status-pill__icon {
  position: relative;
  display: inline-flex;
  height: var(--card-status-icon-size, 0.95rem);
  width: var(--card-status-icon-size, 0.95rem);
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}

.status-pill__icon--dot::before {
  content: "";
  height: 0.32rem;
  width: 0.32rem;
  border-radius: 999px;
  background: currentColor;
}

.status-pill__icon--lock::before {
  content: "";
  width: 0.36rem;
  height: 0.26rem;
  border: 1.6px solid currentColor;
  border-radius: 0.08rem;
  transform: translateY(0.09rem);
}

.status-pill__icon--lock::after {
  content: "";
  position: absolute;
  top: 0.11rem;
  width: 0.38rem;
  height: 0.34rem;
  border: 1.6px solid currentColor;
  border-bottom: 0;
  border-radius: 999px 999px 0 0;
}

.status-pill__icon--in::before,
.status-pill__icon--out::before {
  content: "";
  position: absolute;
  width: 0.42rem;
  height: 0.42rem;
  border-top: 1.8px solid currentColor;
  border-right: 1.8px solid currentColor;
}

.status-pill__icon--in::before {
  transform: rotate(135deg) translate(-0.02rem, -0.02rem);
}

.status-pill__icon--out::before {
  transform: rotate(-45deg) translate(-0.02rem, -0.02rem);
}

.status-pill--shared-in {
  border-color: color-mix(in srgb, #22d3ee 30%, var(--border-color));
  background: color-mix(in srgb, var(--bg-elevated) 78%, #22d3ee 22%);
  color: color-mix(in srgb, var(--text-main) 22%, #22d3ee 78%);
}

.status-pill--shared-in .status-pill__icon {
  background: color-mix(in srgb, #22d3ee 18%, transparent);
}

.status-pill--shared-out {
  border-color: color-mix(in srgb, #34d399 30%, var(--border-color));
  background: color-mix(in srgb, var(--bg-elevated) 80%, #34d399 20%);
  color: color-mix(in srgb, var(--text-main) 24%, #34d399 76%);
}

.status-pill--shared-out .status-pill__icon {
  background: color-mix(in srgb, #34d399 18%, transparent);
}

.status-pill--locked {
  border-color: color-mix(in srgb, #f59e0b 34%, var(--border-color));
  background: color-mix(in srgb, var(--bg-elevated) 76%, #f59e0b 24%);
  color: color-mix(in srgb, var(--text-main) 20%, #f59e0b 80%);
}

.status-pill--locked .status-pill__icon {
  background: color-mix(in srgb, #f59e0b 20%, transparent);
}

.status-pill--normal {
  border-color: color-mix(in srgb, var(--border-color) 92%, transparent);
  background: color-mix(in srgb, var(--bg-input) 84%, var(--bg-main) 16%);
  color: var(--text-secondary);
}

.status-pill--normal .status-pill__icon {
  background: color-mix(in srgb, var(--text-muted) 16%, transparent);
}

@media (max-width: 1280px) {
  .file-card-grid,
  .file-icon-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .file-card-grid,
  .file-icon-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .file-card-grid,
  .file-icon-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
