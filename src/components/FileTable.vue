<script setup>
import { computed } from "vue";
import { useFileStore } from "@/stores/useFileStore";
import { useViewStore } from "@/stores/viewStore";

const props = defineProps({
  files: {
    type: Array,
    required: true,
  },
  deleteMode: {
    type: String,
    default: "trash",
  },
});

const emit = defineEmits(["delete-file"]);
const fileStore = useFileStore();
const { viewMode, gridSize } = useViewStore();

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

const openFile = (file) => {
  if (file?.type === "folder") {
    if (props.deleteMode === "permanent") {
      return;
    }

    fileStore.enterFolder(file.id);
    return;
  }

  const downloadUrl = file?.downloadUrl || file?.presignedDownloadUrl;
  if (downloadUrl) {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }
};

const onClickDelete = (file, event) => {
  event.stopPropagation();

  const targetLabel = file?.type === "folder" ? "폴더" : "파일";
  const confirmMessage = props.deleteMode === "permanent"
    ? `'${getFileName(file)}' ${targetLabel}을(를) 영구 삭제하시겠습니까?`
    : `'${getFileName(file)}' ${targetLabel}을(를) 휴지통으로 이동하시겠습니까?`;

  if (window.confirm(confirmMessage)) {
    emit("delete-file", file?.id);
  }
};

const gridClassName = computed(() => {
  if (gridSize.value === "large") {
    return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  }

  if (gridSize.value === "small") {
    return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5";
  }

  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
});
</script>

<template>
  <div>
    <div
      v-if="viewMode === 'table'"
      class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-slate-50">
          <tr>
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
            v-for="(file, index) in files"
            :key="file.id || file.idx || `${getFileName(file)}-${index}`"
            class="cursor-pointer transition hover:bg-slate-50"
            @click="openFile(file)"
          >
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
                  <p class="truncate text-xs text-gray-400">{{ file.location || '내 드라이브' }}</p>
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
              <div class="flex justify-end gap-2">
                <button
                  v-if="canDownload(file)"
                  type="button"
                  class="action-button text-blue-600 hover:bg-blue-50"
                  @click.stop="openFile(file)"
                >
                  다운로드
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
        v-for="(file, index) in files"
        :key="file.id || file.idx || `${getFileName(file)}-${index}`"
        class="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-2xl"
            :class="file.type === 'folder' ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'"
          >
            <svg
              v-if="file.type === 'folder'"
              class="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" />
            </svg>
            <svg
              v-else
              class="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
            </svg>
          </div>

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

        <button
          type="button"
          class="w-full text-left"
          @click="openFile(file)"
        >
          <p class="truncate text-sm font-semibold text-gray-900">{{ getFileName(file) }}</p>
          <p class="mt-1 text-xs text-gray-400">
            {{ file.type === "folder" ? "폴더" : (getFileExtension(file) || "-").toUpperCase() }}
          </p>
        </button>

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

        <div class="mt-4 grid gap-2" :class="canDownload(file) ? 'grid-cols-2' : 'grid-cols-1'">
          <button
            v-if="canDownload(file)"
            type="button"
            class="w-full rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
            @click="openFile(file)"
          >
            다운로드
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
.action-button {
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
