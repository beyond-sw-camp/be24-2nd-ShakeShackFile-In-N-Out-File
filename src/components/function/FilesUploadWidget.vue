<template>
  <div class="upload-widget">
    <button type="button" class="upload-trigger" @click="toggleDropdown">
      <i class="fa-solid fa-plus"></i>
      <span>업로드 / 폴더 만들기</span>
      <span v-if="activeCount > 0" class="upload-trigger__count">{{ activeCount }}</span>
    </button>

    <div v-if="isDropdownOpen" class="upload-dropdown">
      <button type="button" class="upload-dropdown__item" @click="createNewFolder">
        <i class="fa-regular fa-folder-open"></i>
        <span>새 폴더 만들기</span>
      </button>

      <label class="upload-dropdown__item">
        <i class="fa-solid fa-file-arrow-up"></i>
        <span>파일 업로드</span>
        <input type="file" hidden multiple :disabled="isUploading" @change="handleFileChange" />
      </label>

      <label class="upload-dropdown__item">
        <i class="fa-solid fa-folder-plus"></i>
        <span>폴더 업로드</span>
        <input
          type="file"
          hidden
          webkitdirectory
          directory
          multiple
          :disabled="isUploading"
          @change="handleFolderChange"
        />
      </label>

      <div class="upload-dropdown__footer">
        <label class="upload-dropdown__label" for="upload-concurrency">동시 업로드 수</label>
        <select
          id="upload-concurrency"
          v-model.number="uploadConcurrency"
          class="upload-dropdown__select"
          :disabled="isUploading"
        >
          <option v-for="count in uploadConcurrencyOptions" :key="count" :value="count">
            {{ count }}
          </option>
        </select>
        <p class="upload-dropdown__hint">
          현재 플랜 기준 한 번에 최대 {{ maxUploadCount }}개 파일과
          {{ formatBytes(maxUploadFileBytes) }}까지 업로드할 수 있습니다.
        </p>
      </div>
    </div>

    <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>

    <div v-if="isDropdownOpen" class="upload-backdrop" @click="closeDropdown"></div>
  </div>

  <Teleport to="body">
    <div v-if="showFloatingPanel" class="upload-float" :class="{ 'is-collapsed': isPanelCollapsed }">
      <div class="upload-panel">
        <div class="upload-panel__header">
          <div class="upload-panel__heading">
            <strong>{{ panelTitle }}</strong>
            <p v-if="!isPanelCollapsed">{{ panelSubtitleDisplay }}</p>
          </div>
          <div class="upload-panel__actions">
            <button
              v-if="canCancel && !isPanelCollapsed"
              type="button"
              class="upload-panel__cancel"
              @click="cancelUploads"
            >
              업로드 취소
            </button>
            <button
              v-if="canClearDismissed && !isPanelCollapsed"
              type="button"
              class="upload-panel__clear"
              @click="clearDismissedItems"
            >
              정리
            </button>
            <button
              type="button"
              class="upload-panel__icon"
              :aria-label="isPanelCollapsed ? '업로드 상태 펼치기' : '업로드 상태 접기'"
              @click="togglePanelCollapsed"
            >
              <i class="fa-solid" :class="isPanelCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
            <button
              type="button"
              class="upload-panel__icon"
              aria-label="업로드 상태창 닫기"
              @click="dismissPanel"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div v-if="!isPanelCollapsed" class="upload-panel__list">
          <div v-for="item in panelItems" :key="item.id" class="upload-item">
            <div class="upload-item__main">
              <div class="upload-item__name">{{ item.name }}</div>
              <div class="upload-item__status">{{ item.statusText }}</div>
              <div v-if="formatUploadSpeed(item)" class="upload-item__speed">{{ formatUploadSpeed(item) }}</div>
              <div class="upload-item__bar">
                <span class="upload-item__fill" :style="{ width: `${item.progress}%` }"></span>
              </div>
            </div>
            <div class="upload-item__percent" :class="`is-${item.status}`">{{ item.progress }}%</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="isExitDialogOpen"
      class="upload-exit"
      role="presentation"
      @click.self="closeExitDialog(false)"
    >
      <div class="upload-exit__dialog" role="dialog" aria-modal="true" :aria-labelledby="exitDialogTitleId">
        <strong :id="exitDialogTitleId" class="upload-exit__title">{{ exitDialogTitle }}</strong>
        <p class="upload-exit__description">{{ exitDialogDescription }}</p>
        <div class="upload-exit__actions">
          <button
            type="button"
            class="upload-exit__button upload-exit__button--secondary"
            :disabled="isExitDialogBusy"
            @click="closeExitDialog(false)"
          >
            취소
          </button>
          <button
            type="button"
            class="upload-exit__button upload-exit__button--primary"
            :disabled="isExitDialogBusy"
            @click="confirmExitDialog"
          >
            {{ exitDialogActionLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import axios from "axios";
import { onBeforeRouteLeave } from "vue-router";
import { abortUpload, completeUpload, initUploadFiles, parseUploadResponse } from "@/api/filesApi.js";
import { api } from "@/plugins/axiosinterceptor";
import { useFileStore } from "@/stores/useFileStore";

const emit = defineEmits(["upload-complete", "upload-fail"]);
const fileStore = useFileStore();

const PARTITION_SIZE_BYTES = 100 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 80 * 1024 * 1024;
const STORAGE_KEY_CONCURRENCY = "file-upload-concurrency";
const uploadConcurrencyOptions = [1, 2, 3, 4, 5];
const transientStatuses = new Set(["preparing", "pending", "uploading", "merging", "canceling"]);
const activeUploadControllers = new Map();

const isDropdownOpen = ref(false);
const isUploading = ref(false);
const isCancelRequested = ref(false);
const isPanelCollapsed = ref(false);
const isPanelHidden = ref(false);
const uploadError = ref("");
const uploadItems = ref([]);
const uploadConcurrency = ref(readSavedConcurrency());
const isExitDialogOpen = ref(false);
const isExitDialogBusy = ref(false);
const exitDialogMode = ref("leave");
const allowWindowUnload = ref(false);

let exitDialogResolver = null;

const exitDialogTitleId = `upload-exit-title-${Math.random().toString(36).slice(2, 8)}`;

const maxUploadCount = computed(() => Number(fileStore.planCapabilities?.maxUploadCount || 30));
const maxUploadFileBytes = computed(() =>
  Number(fileStore.planCapabilities?.maxUploadFileBytes || 5 * 1024 * 1024 * 1024),
);
const activeCount = computed(() =>
  uploadItems.value.filter((item) => transientStatuses.has(item.status)).length,
);
const completedCount = computed(() =>
  uploadItems.value.filter((item) => item.status === "completed").length,
);
const failedCount = computed(() =>
  uploadItems.value.filter((item) => item.status === "failed").length,
);
const canceledCount = computed(() =>
  uploadItems.value.filter((item) => item.status === "canceled").length,
);
const canCancel = computed(() =>
  uploadItems.value.some((item) => transientStatuses.has(item.status)),
);
const canClearDismissed = computed(() =>
  uploadItems.value.some((item) => ["completed", "failed", "canceled"].includes(item.status)),
);
const totalUploadSpeedBytesPerSecond = computed(() =>
  uploadItems.value
    .filter((item) => item.status === "uploading")
    .reduce((total, item) => total + Math.max(0, Number(item.speedBytesPerSecond || 0)), 0),
);
const showFloatingPanel = computed(() => uploadItems.value.length > 0 && !isPanelHidden.value);
const panelItems = computed(() => [...uploadItems.value].reverse());
const hasBlockingUploads = computed(() =>
  uploadItems.value.some((item) => transientStatuses.has(item.status)),
);
const exitDialogTitle = computed(() =>
  exitDialogMode.value === "refresh"
    ? "페이지를 새로고침 하시겠습니까?"
    : "페이지에서 나가시겠습니까?",
);
const exitDialogDescription = computed(() => "작업중인 내역이 종료됩니다.");
const exitDialogActionLabel = computed(() =>
  exitDialogMode.value === "refresh" ? "새로고침" : "나가기",
);

const panelTitle = computed(() => {
  if (activeCount.value > 0) {
    return `항목 ${activeCount.value}개 업로드 진행 중`;
  }
  if (failedCount.value > 0) {
    return `항목 ${failedCount.value}개 업로드 확인 필요`;
  }
  if (canceledCount.value > 0) {
    return `항목 ${canceledCount.value}개 업로드 취소`;
  }
  if (completedCount.value > 0) {
    return `항목 ${completedCount.value}개 업로드 완료`;
  }
  return "업로드 상태";
});

const panelSubtitle = computed(() => {
  if (activeCount.value > 0) {
    return "파일 업로드를 처리하고 있습니다.";
  }
  if (failedCount.value > 0) {
    return "실패한 항목은 다시 업로드해 주세요.";
  }
  if (canceledCount.value > 0) {
    return "업로드가 취소되었습니다.";
  }
  if (completedCount.value > 0) {
    return "모든 업로드가 완료되었습니다.";
  }
return "";
});
const panelSubtitleDisplay = computed(() =>
  activeCount.value > 0
    ? `현재 총 전송 속도 ${formatBytesPerSecond(totalUploadSpeedBytesPerSecond.value)}`
    : panelSubtitle.value,
);

watch(uploadConcurrency, (value) => {
  const normalized = normalizeUploadConcurrency(value);
  if (normalized !== value) {
    uploadConcurrency.value = normalized;
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_CONCURRENCY, String(normalized));
});

watch(
  uploadItems,
  (items) => {
    if (items.length === 0) {
      isPanelCollapsed.value = false;
      isPanelHidden.value = false;
    }
  },
  { deep: true },
);

function readSavedConcurrency() {
  const savedValue = Number(window.localStorage.getItem(STORAGE_KEY_CONCURRENCY) || 3);
  return normalizeUploadConcurrency(savedValue);
}

function normalizeUploadConcurrency(value) {
  return Math.min(5, Math.max(1, Number(value || 3)));
}

function openPanel() {
  isPanelHidden.value = false;
}

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
  if (uploadItems.value.length > 0) {
    openPanel();
  }
}

function closeDropdown() {
  isDropdownOpen.value = false;
}

function togglePanelCollapsed() {
  isPanelCollapsed.value = !isPanelCollapsed.value;
}

function dismissPanel() {
  isPanelHidden.value = true;
}

function getAbortableItems() {
  return uploadItems.value.filter((item) => transientStatuses.has(item.status));
}

function openExitDialog(mode = "leave") {
  if (!hasBlockingUploads.value) {
    return Promise.resolve(true);
  }

  if (exitDialogResolver) {
    return Promise.resolve(false);
  }

  exitDialogMode.value = mode;
  isExitDialogBusy.value = false;
  isExitDialogOpen.value = true;

  return new Promise((resolve) => {
    exitDialogResolver = resolve;
  });
}

function closeExitDialog(confirmed) {
  isExitDialogOpen.value = false;
  isExitDialogBusy.value = false;

  if (!exitDialogResolver) {
    return;
  }

  const resolve = exitDialogResolver;
  exitDialogResolver = null;
  resolve(Boolean(confirmed));
}

function confirmExitDialog() {
  if (isExitDialogBusy.value) {
    return;
  }

  isExitDialogBusy.value = true;
  closeExitDialog(true);
}

function clearDismissedItems() {
  uploadItems.value = uploadItems.value.filter((item) => !["completed", "failed", "canceled"].includes(item.status));
}

function clearCompletedHistoryIfIdle() {
  if (uploadItems.value.length === 0) {
    return;
  }

  const allCompleted = uploadItems.value.every((item) => item.status === "completed");
  if (!allCompleted) {
    return;
  }

  uploadItems.value = [];
  isPanelCollapsed.value = false;
  isPanelHidden.value = false;
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function formatUploadSpeed(item) {
  if (!item || item.status !== "uploading") {
    return "";
  }

  const bytesPerSecond = Number(item.speedBytesPerSecond || 0);
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "";
  }

  return formatBytesPerSecond(bytesPerSecond);
}

function formatBytesPerSecond(bytesPerSecond) {
  const normalizedBytesPerSecond = Number(bytesPerSecond || 0);
  if (!Number.isFinite(normalizedBytesPerSecond) || normalizedBytesPerSecond <= 0) {
    return "0.00 MB/s";
  }

  const megabytesPerSecond = normalizedBytesPerSecond / (1024 * 1024);
  const fractionDigits = megabytesPerSecond >= 100 ? 0 : megabytesPerSecond >= 10 ? 1 : 2;
  return `${megabytesPerSecond.toFixed(fractionDigits)} MB/s`;
}

function extractErrorMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.result?.message ||
    error?.message ||
    fallbackMessage
  );
}

function getFileFormat(file) {
  if (typeof file?.name !== "string") {
    return "";
  }

  const lastDotIndex = file.name.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex >= file.name.length - 1) {
    return "";
  }

  return file.name.slice(lastDotIndex + 1).trim().replace(/^\.+/, "").toLowerCase();
}

function defaultStatusText(status) {
  switch (status) {
    case "preparing":
      return "업로드 정보를 준비하고 있습니다.";
    case "pending":
      return "업로드 대기 중입니다.";
    case "uploading":
      return "업로드를 진행하고 있습니다.";
    case "merging":
      return "서버에서 업로드를 마무리하고 있습니다.";
    case "completed":
      return "업로드 완료";
    case "canceling":
      return "업로드를 정리하고 있습니다.";
    case "canceled":
      return "업로드가 취소되었습니다.";
    case "failed":
      return "업로드에 실패했습니다.";
    default:
      return "업로드 상태를 확인하고 있습니다.";
  }
}

function createUploadItem(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file?.name || "이름 없는 파일",
    fileSize: Number(file?.size || 0),
    progress: 0,
    uploadedBytes: 0,
    speedBytesPerSecond: 0,
    speedSampleAt: 0,
    speedSampleBytes: 0,
    status: "preparing",
    statusText: defaultStatusText("preparing"),
    uploadMetas: [],
  };
}

function setItemState(itemId, patch) {
  const item = uploadItems.value.find((candidate) => candidate.id === itemId);
  if (!item) {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    const nextStatus = patch.status;
    if (nextStatus === "uploading" && item.status !== "uploading") {
      item.speedBytesPerSecond = 0;
      item.speedSampleAt = 0;
      item.speedSampleBytes = Number(item.uploadedBytes || 0);
    } else if (nextStatus !== "uploading") {
      item.speedBytesPerSecond = 0;
      item.speedSampleAt = 0;
      item.speedSampleBytes = Number(item.uploadedBytes || 0);
    }
  }

  Object.assign(item, patch);
}

function updateItemProgress(itemId, uploadedBytes, statusText) {
  const item = uploadItems.value.find((candidate) => candidate.id === itemId);
  if (!item) {
    return;
  }

  const safeUploadedBytes = Math.max(0, Math.min(Number(item.fileSize || 0), Number(uploadedBytes || 0)));
  const progress = item.fileSize > 0 ? Math.min(100, Math.round((safeUploadedBytes / item.fileSize) * 100)) : 0;
  const now = Date.now();

  if (!item.speedSampleAt || safeUploadedBytes < Number(item.speedSampleBytes || 0)) {
    item.speedSampleAt = now;
    item.speedSampleBytes = safeUploadedBytes;
    item.speedBytesPerSecond = 0;
  } else {
    const deltaBytes = safeUploadedBytes - Number(item.speedSampleBytes || 0);
    const deltaMs = now - Number(item.speedSampleAt || 0);

    if (deltaBytes > 0 && deltaMs >= 200) {
      const nextBytesPerSecond = (deltaBytes / deltaMs) * 1000;
      const previousBytesPerSecond = Number(item.speedBytesPerSecond || 0);
      item.speedBytesPerSecond = previousBytesPerSecond > 0
        ? (previousBytesPerSecond * 0.45) + (nextBytesPerSecond * 0.55)
        : nextBytesPerSecond;
      item.speedSampleAt = now;
      item.speedSampleBytes = safeUploadedBytes;
    }
  }

  item.uploadedBytes = safeUploadedBytes;
  item.progress = progress;
  if (statusText) {
    item.statusText = statusText;
  }
}

function buildAbortPayload(uploadMetas) {
  const metaList = Array.isArray(uploadMetas) ? uploadMetas : [];
  const firstMeta = metaList[0];
  const finalObjectKey = firstMeta?.finalObjectKey || firstMeta?.objectKey || null;
  const chunkObjectKeys = firstMeta?.partitioned === true
    ? metaList.map((meta) => meta?.objectKey).filter(Boolean)
    : [];

  return {
    finalObjectKey,
    chunkObjectKeys,
  };
}

function getExpectedUploadCount(file, firstMeta) {
  const partitionCount = Number(firstMeta?.partitionCount || 0);
  if (firstMeta?.partitioned === true && Number.isInteger(partitionCount) && partitionCount > 0) {
    return partitionCount;
  }

  if (!file?.size || Number(file.size) <= PARTITION_SIZE_BYTES) {
    return 1;
  }

  return Math.ceil(Number(file.size) / CHUNK_SIZE_BYTES);
}

function buildUploadJobs(selectedFiles, uploadMetas) {
  const jobs = [];
  let responseIndex = 0;

  for (const [fileIndex, file] of selectedFiles.entries()) {
    const firstMeta = uploadMetas?.[responseIndex];
    const item = uploadItems.value[fileIndex];

    if (!firstMeta || !item) {
      throw new Error(`"${file?.name || "파일"}" 업로드 정보를 찾을 수 없습니다.`);
    }

    const expectedCount = getExpectedUploadCount(file, firstMeta);
    const group = uploadMetas.slice(responseIndex, responseIndex + expectedCount);

    if (group.length !== expectedCount) {
      throw new Error(`"${file.name}" 업로드 메타 개수가 올바르지 않습니다.`);
    }

    Object.assign(item, {
      status: "pending",
      statusText: defaultStatusText("pending"),
      uploadMetas: group,
    });

    jobs.push({
      file,
      metas: group,
      itemId: item.id,
      partitioned: firstMeta?.partitioned === true,
    });

    responseIndex += expectedCount;
  }

  if (responseIndex !== uploadMetas.length) {
    throw new Error("업로드 메타 개수와 선택한 파일 수가 일치하지 않습니다.");
  }

  return jobs;
}

async function uploadChunkToUrl(blob, uploadMeta, contentType, options = {}) {
  if (!uploadMeta?.presignedUploadUrl) {
    throw new Error("업로드 URL을 찾을 수 없습니다.");
  }

  await axios.put(uploadMeta.presignedUploadUrl, blob, {
    signal: options.signal,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
    },
    onUploadProgress: (event) => {
      options.onProgress?.(event?.loaded ?? 0);
    },
  });
}

async function abortUploadedFile(uploadMetas) {
  const payload = buildAbortPayload(uploadMetas);
  if (!payload.finalObjectKey) {
    return;
  }

  try {
    await abortUpload(payload);
  } catch {
  }
}

async function uploadFileByChunks(file, uploadMetas, itemId) {
  const chunkCount = Array.isArray(uploadMetas) ? uploadMetas.length : 0;
  if (chunkCount === 0) {
    throw new Error(`"${file?.name || "파일"}" 업로드 정보를 찾을 수 없습니다.`);
  }

  setItemState(itemId, {
    status: "uploading",
    statusText: defaultStatusText("uploading"),
  });

  let completedBytes = 0;
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    if (isCancelRequested.value) {
      throw new DOMException("Upload canceled", "AbortError");
    }

    const start = chunkIndex * CHUNK_SIZE_BYTES;
    const end =
      chunkIndex === chunkCount - 1
        ? Number(file.size || 0)
        : Math.min(start + CHUNK_SIZE_BYTES, Number(file.size || 0));
    const chunkBlob = file.slice(start, end, file.type || "application/octet-stream");
    const chunkSize = Number(chunkBlob.size || 0);
    const controller = new AbortController();

    activeUploadControllers.set(itemId, controller);

    try {
      await uploadChunkToUrl(chunkBlob, uploadMetas[chunkIndex], file.type, {
        signal: controller.signal,
        onProgress: (loadedBytes) => {
          const nextBytes = completedBytes + Math.min(chunkSize, Number(loadedBytes || 0));
          const progress = Number(file.size || 0) > 0
            ? Math.min(100, Math.round((nextBytes / Number(file.size || 0)) * 100))
            : 0;
          updateItemProgress(itemId, nextBytes, `업로드 중 (${progress}%)`);
        },
      });
    } finally {
      activeUploadControllers.delete(itemId);
    }

    completedBytes += chunkSize;
    updateItemProgress(itemId, completedBytes, "업로드를 마무리하고 있습니다.");
  }
}

async function completeUploadedFile(file, uploadMetas, partitioned, itemId, parentId) {
  const firstMeta = uploadMetas?.[0];
  const finalObjectKey = firstMeta?.finalObjectKey || firstMeta?.objectKey;
  const chunkObjectKeys = partitioned ? uploadMetas.map((meta) => meta?.objectKey).filter(Boolean) : [];

  if (!finalObjectKey) {
    throw new Error(`"${file?.name || "파일"}" 완료 정보를 찾을 수 없습니다.`);
  }

  setItemState(itemId, {
    status: partitioned ? "merging" : "uploading",
    statusText: partitioned ? "서버에서 파일을 병합하고 있습니다." : "업로드 완료를 확인하고 있습니다.",
    progress: 100,
    uploadedBytes: Number(file?.size || 0),
  });

  await completeUpload({
    fileOriginName: file?.name || "unnamed-file",
    fileFormat: getFileFormat(file),
    fileSize: Number(file?.size || 0),
    finalObjectKey,
    chunkObjectKeys,
    parentId,
    relativePath: file?.webkitRelativePath || file?.name || "unnamed-file",
    lastModified: Number(file?.lastModified || 0) || 0,
  });

  setItemState(itemId, {
    status: "completed",
    statusText: defaultStatusText("completed"),
    progress: 100,
    uploadedBytes: Number(file?.size || 0),
  });
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ERR_CANCELED";
}

async function runJobs(jobs, parentId) {
  const successList = [];
  const failureList = [];
  let nextJobIndex = 0;
  const workerCount = Math.min(normalizeUploadConcurrency(uploadConcurrency.value), jobs.length);

  const worker = async () => {
    while (!isCancelRequested.value) {
      const currentIndex = nextJobIndex;
      nextJobIndex += 1;

      if (currentIndex >= jobs.length) {
        return;
      }

      const job = jobs[currentIndex];

      try {
        await uploadFileByChunks(job.file, job.metas, job.itemId);
        await completeUploadedFile(job.file, job.metas, job.partitioned, job.itemId, parentId);
        successList.push(job.file.name);
      } catch (error) {
        await abortUploadedFile(job.metas);

        if (isAbortError(error)) {
          setItemState(job.itemId, {
            status: "canceled",
            statusText: defaultStatusText("canceled"),
            progress: 0,
          });
          continue;
        }

        setItemState(job.itemId, {
          status: "failed",
          statusText: extractErrorMessage(error, defaultStatusText("failed")),
        });
        failureList.push(job.file?.name || "파일");
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return { successList, failureList };
}

async function terminateUploadsForExit() {
  if (!hasBlockingUploads.value) {
    return;
  }

  isCancelRequested.value = true;
  const abortableItems = getAbortableItems();

  abortableItems.forEach((item) => {
    item.status = "canceling";
    item.statusText = defaultStatusText("canceling");
  });

  activeUploadControllers.forEach((controller) => controller.abort());
  activeUploadControllers.clear();

  try {
    await Promise.all(abortableItems.map((item) => abortUploadedFile(item.uploadMetas)));
  } finally {
    abortableItems.forEach((item) => {
      item.status = "canceled";
      item.statusText = defaultStatusText("canceled");
      item.progress = 0;
    });
    isUploading.value = false;
  }
}

function abortUploadsKeepalive() {
  const token = window.localStorage.getItem("ACCESS_TOKEN");
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = String(api?.defaults?.baseURL || "").replace(/\/$/, "");
  const abortUrl = `${baseUrl}/file/upload/abort`;

  getAbortableItems().forEach((item) => {
    const payload = buildAbortPayload(item.uploadMetas);
    if (!payload.finalObjectKey) {
      return;
    }

    try {
      fetch(abortUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "include",
      }).catch(() => {});
    } catch {
    }
  });
}

async function handleUpload(event, uploadTypeLabel) {
  const selectedFiles = Array.from(event?.target?.files || []);
  if (selectedFiles.length === 0) {
    return;
  }

  try {
    if (!fileStore.storageSummary && !fileStore.storageLoading) {
      await fileStore.fetchStorageSummary().catch(() => {});
    }

    if (selectedFiles.length > maxUploadCount.value) {
      throw new Error(`한 번에 최대 ${maxUploadCount.value}개까지 업로드할 수 있습니다.`);
    }

    const oversizedFile = selectedFiles.find((file) => Number(file?.size || 0) > maxUploadFileBytes.value);
    if (oversizedFile) {
      throw new Error(
        `"${oversizedFile.name}" 파일은 최대 제한 크기(${formatBytes(maxUploadFileBytes.value)})를 초과합니다.`,
      );
    }

    const invalidFile = selectedFiles.find((file) => !getFileFormat(file));
    if (invalidFile) {
      throw new Error(`"${invalidFile.name}" 파일은 확장자를 확인할 수 없습니다.`);
    }

    uploadError.value = "";
    isUploading.value = true;
    isCancelRequested.value = false;
    clearCompletedHistoryIfIdle();
    isPanelCollapsed.value = false;
    openPanel();
    uploadItems.value = selectedFiles.map((file) => createUploadItem(file));

    const response = await initUploadFiles(selectedFiles, fileStore.currentFolderId);
    const uploadMetas = parseUploadResponse(response?.data);
    if (!Array.isArray(uploadMetas) || uploadMetas.length === 0) {
      throw new Error("업로드 준비 응답이 비어 있습니다.");
    }

    const jobs = buildUploadJobs(selectedFiles, uploadMetas);
    const { successList, failureList } = await runJobs(jobs, fileStore.currentFolderId);

    if (isCancelRequested.value) {
      return;
    }

    if (successList.length > 0) {
      if (fileStore.driveHasLoaded && !fileStore.hasLoaded) {
        await fileStore.refreshDrivePage().catch(() => {});
      } else {
        await fileStore.fetchFiles().catch(() => {});
      }
      emit("upload-complete", successList);
    }

    if (failureList.length > 0) {
      const failureMessage = "일부 업로드에 실패했습니다.";
      uploadError.value = failureMessage;
      emit("upload-fail", failureMessage);
    }
  } catch (error) {
    const message = extractErrorMessage(error, `${uploadTypeLabel} 업로드에 실패했습니다.`);
    uploadError.value = message;
    emit("upload-fail", message);
  } finally {
    isUploading.value = false;
    closeDropdown();
    if (event?.target) {
      event.target.value = "";
    }
  }
}

async function cancelUploads() {
  if (!canCancel.value) {
    return;
  }

  await terminateUploadsForExit();
}

async function handleRefreshRequest() {
  const confirmed = await openExitDialog("refresh");
  if (!confirmed) {
    return;
  }

  await terminateUploadsForExit();
  allowWindowUnload.value = true;
  window.location.reload();
}

function createNewFolder() {
  const folderName = prompt("폴더 이름을 입력해 주세요.");
  if (!folderName?.trim()) {
    closeDropdown();
    return;
  }

  fileStore.createFolder(folderName.trim()).catch((error) => {
    uploadError.value = extractErrorMessage(error, "폴더를 생성하지 못했습니다.");
  });
  closeDropdown();
}

async function handleFileChange(event) {
  await handleUpload(event, "파일");
}

async function handleFolderChange(event) {
  await handleUpload(event, "폴더");
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    closeDropdown();
    return;
  }

  const normalizedKey = String(event.key || "").toLowerCase();
  const isRefreshShortcut =
    event.key === "F5" || ((event.ctrlKey || event.metaKey) && !event.altKey && normalizedKey === "r");

  if (isRefreshShortcut && hasBlockingUploads.value) {
    event.preventDefault();
    void handleRefreshRequest();
  }
}

function handleBeforeUnload(event) {
  if (!hasBlockingUploads.value || allowWindowUnload.value) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

function handlePageHide() {
  if (!hasBlockingUploads.value || allowWindowUnload.value) {
    return;
  }

  abortUploadsKeepalive();
}

onBeforeRouteLeave(async () => {
  if (!hasBlockingUploads.value) {
    return true;
  }

  const confirmed = await openExitDialog("leave");
  if (!confirmed) {
    return false;
  }

  await terminateUploadsForExit();
  return true;
});

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
  fileStore.fetchStorageSummary().catch(() => {});
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("pagehide", handlePageHide);
  activeUploadControllers.forEach((controller) => controller.abort());
  activeUploadControllers.clear();
  if (exitDialogResolver) {
    closeExitDialog(false);
  }
});
</script>

<style scoped>
.upload-widget {
  position: relative;
}

.upload-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: linear-gradient(
    135deg,
    var(--bg-elevated),
    color-mix(in srgb, var(--bg-elevated) 84%, var(--accent) 16%)
  );
  color: var(--text-main);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.upload-trigger:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-color) 55%);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
}

.upload-trigger__count {
  min-width: 1.5rem;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.78rem;
}

.upload-dropdown {
  position: absolute;
  top: calc(100% + 0.75rem);
  left: 0;
  right: 0;
  z-index: 30;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--bg-elevated) 96%, var(--bg-main) 4%);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(16px);
}

.upload-dropdown__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 0.95rem;
  border: none;
  border-radius: 0.85rem;
  background: transparent;
  color: var(--text-main);
  font: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.upload-dropdown__item:hover {
  background: var(--bg-input);
}

.upload-dropdown__footer {
  margin-top: 0.6rem;
  padding: 0.8rem;
  border-radius: 0.9rem;
  background: var(--bg-input);
}

.upload-dropdown__label {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

.upload-dropdown__select {
  width: 100%;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: 0.8rem;
  background: var(--bg-elevated);
  color: var(--text-main);
}

.upload-dropdown__hint {
  margin-top: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.5;
}

.upload-error {
  margin-top: 0.7rem;
  color: #dc2626;
  font-size: 0.82rem;
  line-height: 1.5;
}

.upload-float {
  position: fixed;
  right: clamp(1rem, 2vw, 1.5rem);
  bottom: clamp(1rem, 2vw, 1.5rem);
  z-index: 120;
  width: min(24rem, calc(100vw - 1.5rem));
}

.upload-panel {
  margin: 0;
  padding: 0.95rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--bg-elevated) 96%, var(--bg-main) 4%);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(16px);
}

.upload-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.upload-panel__heading {
  min-width: 0;
}

.upload-panel__heading strong {
  display: block;
  color: var(--text-main);
  font-size: 1rem;
  font-weight: 800;
}

.upload-panel__heading p {
  margin-top: 0.3rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
}

.upload-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.upload-panel__icon {
  width: 2.15rem;
  height: 2.15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.upload-panel__icon:hover {
  background: var(--bg-input);
  border-color: var(--border-strong);
  color: var(--text-main);
}

.upload-panel__cancel {
  flex-shrink: 0;
  padding: 0.55rem 0.8rem;
  border: 1px solid color-mix(in srgb, #dc2626 45%, var(--border-color) 55%);
  border-radius: 999px;
  background: transparent;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.upload-panel__clear {
  flex-shrink: 0;
  padding: 0.42rem 0.62rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.upload-panel__clear:hover {
  background: var(--bg-input);
  color: var(--text-main);
}

.upload-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  max-height: min(22rem, 60vh);
  margin-top: 0.85rem;
  overflow-y: auto;
}

.upload-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem;
  border-radius: 0.95rem;
  background: var(--bg-input);
}

.upload-item__main {
  min-width: 0;
}

.upload-item__name {
  color: var(--text-main);
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upload-item__status {
  margin-top: 0.3rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.45;
}

.upload-item__speed {
  margin-top: 0.2rem;
  color: var(--text-main);
  font-size: 0.76rem;
  font-weight: 700;
}

.upload-item__bar {
  margin-top: 0.6rem;
  height: 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border-color) 68%, transparent 32%);
  overflow: hidden;
}

.upload-item__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #ffffff 40%));
}

.upload-item__percent {
  min-width: 3rem;
  text-align: right;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

.upload-item__percent.is-completed {
  color: #16a34a;
}

.upload-item__percent.is-canceled,
.upload-item__percent.is-failed {
  color: #dc2626;
}

.upload-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: transparent;
}

.upload-exit {
  position: fixed;
  inset: 0;
  z-index: 180;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(10px);
}

.upload-exit__dialog {
  width: min(26rem, calc(100vw - 2rem));
  padding: 1.3rem;
  border: 1px solid var(--border-color);
  border-radius: 1.1rem;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
}

.upload-exit__title {
  display: block;
  color: var(--text-main);
  font-size: 1.02rem;
  font-weight: 800;
}

.upload-exit__description {
  margin-top: 0.55rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.55;
}

.upload-exit__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.2rem;
}

.upload-exit__button {
  min-width: 5.5rem;
  padding: 0.68rem 1rem;
  border-radius: 0.8rem;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, opacity 0.18s ease, border-color 0.18s ease;
}

.upload-exit__button:disabled {
  opacity: 0.6;
  cursor: default;
}

.upload-exit__button--secondary {
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-main);
}

.upload-exit__button--primary {
  border: 1px solid color-mix(in srgb, #dc2626 38%, var(--border-color) 62%);
  background: color-mix(in srgb, #dc2626 12%, var(--bg-elevated) 88%);
  color: #dc2626;
}

@media (max-width: 640px) {
  .upload-float {
    right: 0.75rem;
    left: 0.75rem;
    width: auto;
  }

  .upload-panel__header {
    align-items: stretch;
  }

  .upload-panel__actions {
    justify-content: flex-end;
  }

  .upload-panel__cancel {
    padding-inline: 0.65rem;
  }
}
</style>
