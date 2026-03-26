<script setup>
import { computed, ref, watch } from "vue";
import { useFileStore } from "@/stores/useFileStore";
import { useViewStore } from "@/stores/viewStore";
import { downloadFileAsset } from "@/api/filesApi.js";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "heic", "avif", "apng", "jfif", "tif", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "wmv", "m4v", "mpeg", "mpg", "ogv", "3gp"]);

const props = defineProps({
  files: {
    type: Array,
    required: true,
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
});

const emit = defineEmits([
  "delete-file",
  "rename-folder",
  "show-folder-properties",
  "preview-file",
]);

const fileStore = useFileStore();
const { viewMode, gridSize } = useViewStore();
const dragTargetId = ref(null);
const draggingFileIds = ref([]);
const selectedIds = ref([]);
const downloadingIds = ref([]);

const visibleFileIds = computed(() =>
  props.files
    .map((file) => String(file?.id))
    .filter(Boolean),
);

watch(visibleFileIds, (ids) => {
  const visibleSet = new Set(ids);
  selectedIds.value = selectedIds.value.filter((id) => visibleSet.has(String(id)));
});

const selectedIdSet = computed(() => new Set(selectedIds.value.map((id) => String(id))));
const downloadingIdSet = computed(() => new Set(downloadingIds.value.map((id) => String(id))));
const selectedCount = computed(() => selectedIds.value.length);
const hasSelection = computed(() => selectedCount.value > 0);
const allVisibleSelected = computed(() =>
  visibleFileIds.value.length > 0 &&
  visibleFileIds.value.every((id) => selectedIdSet.value.has(String(id))),
);

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

const getFileName = (file) => {
  return file?.name || file?.fileOriginName || "이름 없는 파일";
};

const getFileExtension = (file) => {
  return (
    file?.extension ||
    file?.fileFormat ||
    extractExtension(getFileName(file))
  ).toLowerCase();
};

const getUpdatedAt = (file) => {
  return (
    file?.updatedAtLabel ||
    file?.date ||
    formatDisplayDate(file?.updatedAt || file?.lastModified || file?.uploadDate)
  );
};

const canDownload = (file) => {
  return file?.type !== "folder" && Boolean(file?.downloadUrl || file?.presignedDownloadUrl);
};

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

const canManageFolder = (file) => {
  return props.deleteMode !== "permanent" && file?.type === "folder" && !file?.isTrash;
};
const getDeleteConfirmMessage = (file) => {
  if (file?.sharedFile && !file?.sharedWithMe) {
    return "공유된 파일입니다 삭제하시겠습니까? 공유된 사람에게도 사라집니다.";
  }

  const targetLabel = file?.type === "folder" ? "폴더" : "파일";
  return props.deleteMode === "permanent"
    ? `'${getFileName(file)}' ${targetLabel}을 영구 삭제하시겠습니까?`
    : `'${getFileName(file)}' ${targetLabel}을 휴지통으로 이동하시겠습니까?`;
};

const isMovable = (file) => {
  return props.deleteMode !== "permanent" && !file?.isTrash;
};

const isFolderDropTarget = (file) => {
  return canManageFolder(file);
};

const getPreviewUrl = (file) => {
  return file?.downloadUrl || file?.presignedDownloadUrl || "";
};

const getContentType = (file) => String(file?.contentType || file?.raw?.contentType || "").toLowerCase();
const getVideoThumbnailUrl = (file) => file?.thumbnailUrl || file?.thumbnailPresignedUrl || "";

const hasPreviewSource = (file) => {
  return file?.type !== "folder" && Boolean(getPreviewUrl(file));
};

const isInlineImagePreviewable = (file) => {
  const contentType = getContentType(file);
  return hasPreviewSource(file) && (
    contentType.startsWith("image/") ||
    IMAGE_EXTENSIONS.has(getFileExtension(file))
  );
};

const isInlineVideoPreviewable = (file) => {
  const contentType = getContentType(file);
  return (
    contentType.startsWith("video/") ||
    VIDEO_EXTENSIONS.has(getFileExtension(file))
  );
};

const hasInlineVideoThumbnail = (file) => {
  return isInlineVideoPreviewable(file) && Boolean(getVideoThumbnailUrl(file));
};

const handlePrimaryAction = (file) => {
  if (file?.type === "folder") {
    if (props.deleteMode === "permanent") {
      return;
    }

    fileStore.enterFolder(file.id);
    return;
  }

  emit("preview-file", file);
};

const onClickDelete = (file, event) => {
  event.stopPropagation();

  const targetLabel = file?.type === "folder" ? "폴더" : "파일";
  const confirmMessage = props.deleteMode === "permanent"
    ? `'${getFileName(file)}' ${targetLabel}을(를) 영구 삭제하시겠습니까?`
    : `'${getFileName(file)}' ${targetLabel}을(를) 휴지통으로 이동하시겠습니까?`;

  if (window.confirm(getDeleteConfirmMessage(file))) {
    emit("delete-file", file?.id);
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

const toggleFileSelection = (fileId, checked) => {
  const normalizedId = String(fileId);
  if (!normalizedId) {
    return;
  }

  if (checked) {
    if (!selectedIdSet.value.has(normalizedId)) {
      selectedIds.value = [...selectedIds.value, normalizedId];
    }
    return;
  }

  selectedIds.value = selectedIds.value.filter((id) => String(id) !== normalizedId);
};

const toggleSelectAllVisible = (checked) => {
  if (checked) {
    selectedIds.value = [...visibleFileIds.value];
    return;
  }

  selectedIds.value = [];
};

const clearSelection = () => {
  selectedIds.value = [];
};

const getDragFileIds = (file) => {
  const fileId = String(file?.id);
  if (!fileId) {
    return [];
  }

  if (selectedIdSet.value.has(fileId)) {
    return [...selectedIds.value];
  }

  return [fileId];
};

const readDraggedFileIds = (event) => {
  const payload = event?.dataTransfer?.getData("text/plain");
  if (payload) {
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed?.fileIds)) {
        return parsed.fileIds.map((id) => String(id));
      }
    } catch {
      return [];
    }
  }

  return [...draggingFileIds.value];
};

const onDragStart = (event, file) => {
  if (!isMovable(file)) {
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

  const draggedFileIds = readDraggedFileIds(event);
  if (!draggedFileIds.length || draggedFileIds.includes(String(folder.id))) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dragTargetId.value = folder.id;
};

const onDragLeaveFolder = (folder) => {
  if (String(dragTargetId.value) === String(folder.id)) {
    dragTargetId.value = null;
  }
};

const performMove = async (fileIds, targetFolderId) => {
  const normalizedIds = Array.from(
    new Set((fileIds || []).map((id) => String(id)).filter(Boolean)),
  );

  if (!normalizedIds.length) {
    return;
  }

  if (normalizedIds.length === 1) {
    await fileStore.moveFileToFolder(normalizedIds[0], targetFolderId);
  } else {
    await fileStore.moveFilesToFolder(normalizedIds, targetFolderId);
  }

  selectedIds.value = selectedIds.value.filter((id) => !normalizedIds.includes(String(id)));
};

const onDropToFolder = async (event, folder) => {
  if (!isFolderDropTarget(folder)) {
    return;
  }

  event.preventDefault();
  const draggedFileIds = readDraggedFileIds(event);
  dragTargetId.value = null;
  draggingFileIds.value = [];

  if (!draggedFileIds.length || draggedFileIds.includes(String(folder.id))) {
    return;
  }

  try {
    await performMove(draggedFileIds, folder.id);
  } catch (error) {
    window.alert(
      error?.response?.data?.message ||
      error?.message ||
      "폴더로 이동하지 못했습니다.",
    );
  }
};

const onDragOverParentNavigator = (event) => {
  if (!props.showParentNavigator || props.deleteMode === "permanent") {
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
  if (!props.showParentNavigator || props.deleteMode === "permanent") {
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
    await performMove(draggedFileIds, props.parentFolderTargetId);
  } catch (error) {
    window.alert(
      error?.response?.data?.message ||
      error?.message ||
      "상위 폴더로 이동하지 못했습니다.",
    );
  }
};

const gridClassName = computed(() => {
  if (gridSize.value === "large") {
    return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  }

  if (gridSize.value === "xsmall") {
    return "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7";
  }

  if (gridSize.value === "small") {
    return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5";
  }

  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
});
</script>

<template>
  <div class="file-table-shell">
    <div
      v-if="deleteMode !== 'permanent'"
      class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
    >
      <div class="flex flex-wrap items-center gap-3">
        <label class="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            :checked="allVisibleSelected"
            @change="toggleSelectAllVisible($event.target.checked)"
          />
          현재 목록 전체 선택
        </label>
        <span v-if="hasSelection" class="text-sm text-blue-600">
          {{ selectedCount }}개 선택됨
        </span>
      </div>

      <button
        v-if="hasSelection"
        type="button"
        class="rounded-full px-3 py-1 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
        @click="clearSelection"
      >
        선택 해제
      </button>
    </div>

    <div
      v-if="viewMode === 'table'"
      class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-slate-50">
          <tr>
            <th class="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">선택</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">이름</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">확장자</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">크기</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">수정 시간</th>
            <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">상태</th>
            <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">작업</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-if="showParentNavigator"
            class="cursor-pointer transition hover:bg-slate-50"
            :class="{ 'ring-2 ring-blue-300 bg-blue-50': dragTargetId === '__parent__' }"
            @click="fileStore.goBack()"
            @dragover="onDragOverParentNavigator"
            @dragleave="onDragLeaveParentNavigator"
            @drop="onDropToParentNavigator"
          >
            <td class="px-4 py-4 text-gray-300">-</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-900">../</p>
                  <p class="text-xs text-gray-400">상위 폴더로 이동 또는 드롭</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">-</td>
            <td class="px-6 py-4 text-sm text-gray-500">-</td>
            <td class="px-6 py-4 text-sm text-gray-500">-</td>
            <td class="px-6 py-4 text-sm text-gray-500">폴더 이동</td>
            <td class="px-6 py-4 text-right text-sm text-blue-600">상위 폴더</td>
          </tr>

          <tr
            v-for="(file, index) in files"
            :key="file.id || file.idx || `${getFileName(file)}-${index}`"
            class="cursor-pointer transition hover:bg-slate-50"
            :class="{ 'ring-2 ring-blue-300 bg-blue-50': String(dragTargetId) === String(file.id) }"
            :draggable="isMovable(file)"
            @click="handlePrimaryAction(file)"
            @dragstart="onDragStart($event, file)"
            @dragend="onDragEnd"
            @dragover="onDragOverFolder($event, file)"
            @dragleave="onDragLeaveFolder(file)"
            @drop="onDropToFolder($event, file)"
          >
            <td class="px-4 py-4" @click.stop>
              <input
                v-if="deleteMode !== 'permanent'"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :checked="selectedIdSet.has(String(file.id))"
                @change="toggleFileSelection(file.id, $event.target.checked)"
              />
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-2xl"
                  :class="file.type === 'folder' ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'"
                >
                  <svg
                    v-if="file.type === 'folder'"
                    class="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
                  </svg>
                  <svg
                    v-else
                    class="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
                  </svg>
                </div>

                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-gray-900">{{ getFileName(file) }}</p>
                  <p class="truncate text-xs text-gray-400">{{ file.location || "홈" }}</p>
                </div>
              </div>
            </td>

            <td class="px-6 py-4 text-sm text-gray-600">
              {{ file.type === "folder" ? "폴더" : (getFileExtension(file) || "-").toUpperCase() }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ formatDisplaySize(file) }}</td>
            <td class="px-6 py-4 text-sm text-gray-600">{{ getUpdatedAt(file) }}</td>
            <td class="px-6 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  v-if="file.sharedFile || file.isShared"
                  class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600"
                >
                  공유됨
                </span>
                <span
                  v-if="file.lockedFile"
                  class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600"
                >
                  잠금
                </span>
                <span
                  v-if="!file.sharedFile && !file.isShared && !file.lockedFile"
                  class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                >
                  일반
                </span>
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex flex-wrap justify-end gap-2">
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
                  v-if="canManageFolder(file)"
                  type="button"
                  class="action-button text-slate-600 hover:bg-slate-100"
                  @click="onClickRenameFolder(file, $event)"
                >
                  이름 변경
                </button>
                <button
                  v-if="canManageFolder(file)"
                  type="button"
                  class="action-button text-indigo-600 hover:bg-indigo-50"
                  @click="onClickShowFolderProperties(file, $event)"
                >
                  속성
                </button>
                <button
                  type="button"
                  class="action-button text-rose-500 hover:bg-rose-50"
                  @click="onClickDelete(file, $event)"
                >
                  {{ deleteMode === "permanent" ? "영구 삭제" : "삭제" }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-else
      class="grid gap-4"
      :class="gridClassName"
    >
      <article
        v-if="showParentNavigator"
        class="group rounded-2xl border border-dashed border-gray-300 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        :class="{ 'ring-2 ring-blue-300 border-blue-300 bg-blue-50/60': dragTargetId === '__parent__' }"
        @click="fileStore.goBack()"
        @dragover="onDragOverParentNavigator"
        @dragleave="onDragLeaveParentNavigator"
        @drop="onDropToParentNavigator"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>
        <p class="truncate text-sm font-semibold text-gray-900">../</p>
        <p class="mt-1 text-xs text-gray-400">상위 폴더로 이동 또는 드롭</p>
      </article>

      <article
        v-for="(file, index) in files"
        :key="file.id || file.idx || `${getFileName(file)}-${index}`"
        class="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        :class="{ 'ring-2 ring-blue-300 border-blue-300 bg-blue-50/60': String(dragTargetId) === String(file.id) }"
        :draggable="isMovable(file)"
        @click="handlePrimaryAction(file)"
        @dragstart="onDragStart($event, file)"
        @dragend="onDragEnd"
        @dragover="onDragOverFolder($event, file)"
        @dragleave="onDragLeaveFolder(file)"
        @drop="onDropToFolder($event, file)"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <label
            v-if="deleteMode !== 'permanent'"
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
          <span v-else class="h-6 w-6"></span>

          <button
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
          class="flex h-36 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
        >
          <svg class="h-10 w-10" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
          </svg>
        </div>

        <div
          v-else-if="isInlineImagePreviewable(file)"
          class="h-36 overflow-hidden rounded-2xl bg-slate-100"
        >
          <img
            :src="getPreviewUrl(file)"
            :alt="getFileName(file)"
            loading="lazy"
            class="pointer-events-none h-full w-full object-cover"
          />
        </div>

        <div
          v-else-if="hasInlineVideoThumbnail(file)"
          class="relative h-36 overflow-hidden rounded-2xl bg-black"
        >
          <img
            :src="getVideoThumbnailUrl(file)"
            :alt="`${getFileName(file)} thumbnail`"
            loading="lazy"
            class="pointer-events-none h-full w-full object-cover opacity-95"
          />
          <div class="absolute inset-0 flex items-center justify-center bg-black/15">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
              <svg class="ml-1 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 4.5v11l9-5.5-9-5.5Z" />
              </svg>
            </div>
          </div>
        </div>

        <div
          v-else-if="isInlineVideoPreviewable(file)"
          class="relative flex h-36 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white"
        >
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.2),transparent_55%)]"></div>
          <div class="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
            <svg class="ml-1 h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4.5v11l9-5.5-9-5.5Z" />
            </svg>
          </div>
        </div>

        <div
          v-else
          class="flex h-36 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"
        >
          <svg class="h-10 w-10" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
          </svg>
        </div>

        <div class="mt-4">
          <p class="truncate text-sm font-semibold text-gray-900">{{ getFileName(file) }}</p>
          <p class="mt-1 text-xs text-gray-400">
            {{ file.type === "folder" ? "폴더" : (getFileExtension(file) || "-").toUpperCase() }}
          </p>
        </div>

        <dl class="mt-4 space-y-2 text-xs text-gray-500">
          <div class="flex items-center justify-between gap-3">
            <dt>크기</dt>
            <dd class="font-semibold text-gray-700">{{ formatDisplaySize(file) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt>수정</dt>
            <dd class="truncate font-semibold text-gray-700">{{ getUpdatedAt(file) }}</dd>
          </div>
        </dl>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <span
            v-if="file.sharedFile || file.isShared"
            class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600"
          >
            공유됨
          </span>
          <span
            v-if="file.lockedFile"
            class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600"
          >
            잠금
          </span>
        </div>

        <div v-if="canManageFolder(file)" class="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            @click="onClickRenameFolder(file, $event)"
          >
            이름 변경
          </button>
          <button
            type="button"
            class="w-full rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
            @click="onClickShowFolderProperties(file, $event)"
          >
            속성 보기
          </button>
        </div>

        <div class="mt-4 grid gap-2" :class="canDownload(file) ? 'grid-cols-2' : 'grid-cols-1'">
          <button
            v-if="canDownload(file)"
            type="button"
            class="w-full rounded-xl bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
            :class="{ 'cursor-wait opacity-70': isDownloading(file) }"
            :disabled="isDownloading(file)"
            @click="handleDownload(file, $event)"
          >
            {{ isDownloading(file) ? "\uC900\uBE44 \uC911..." : "\uB2E4\uC6B4\uB85C\uB4DC" }}
          </button>
          <button
            type="button"
            class="w-full rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-100"
            @click="onClickDelete(file, $event)"
          >
            {{ deleteMode === "permanent" ? "영구 삭제" : "삭제" }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.file-table-shell {
  padding-bottom: var(--upload-panel-safe-space, 0px);
  transition: padding-bottom 0.2s ease;
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
  align-items: center;
  justify-content: center;
  height: 2rem;
  width: 2rem;
  border-radius: 999px;
  transition: background-color 0.18s ease;
}
</style>
