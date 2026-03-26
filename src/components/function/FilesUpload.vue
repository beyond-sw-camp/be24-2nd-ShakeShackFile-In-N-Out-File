<template>
  <div class="relative">
    <button
      @click="toggleDropdown"
      class="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold text-blue-700 bg-sky-200 rounded-xl transition-all duration-150 hover:bg-sky-300 active:bg-sky-400"
    >
      <i class="fa-solid fa-plus"></i>
      <span>업로드 / 새로 만들기</span>
      <span
        v-if="activeUploadCountComputed > 0"
        class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold"
      >
        {{ activeUploadCountComputed }}
      </span>
    </button>

    <div
      v-if="isDropdownOpen"
      class="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50"
    >
      <div class="relative group/sub">
        <div
          class="flex items-center justify-between px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors rounded-t-2xl"
        >
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-plus-to-slot w-5 text-center text-gray-600 dark:text-gray-400"></i>
            <span>생성</span>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
        </div>

        <div
          class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block"
        >
          <RouterLink :to="{ name: 'workspace' }">
            <div class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl text-gray-800 dark:text-gray-200">
              문서 작성
            </div>
          </RouterLink>
          <div
            @click="createNewFolder"
            class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl text-gray-800 dark:text-gray-200"
          >
            새 폴더 만들기
          </div>
        </div>
      </div>

      <div class="relative group/sub">
        <div
          class="flex items-center justify-between px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-t border-gray-100 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-cloud-arrow-up w-5 text-center text-gray-600 dark:text-gray-400"></i>
            <span>업로드</span>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
        </div>

        <div
          class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block"
        >
          <label
            class="block px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl text-gray-800 dark:text-gray-200"
          >
            파일 업로드
            <input
              type="file"
              multiple
              hidden
              :disabled="isUploading"
              @change="handleFileChange"
            />
          </label>
          <label
            class="block px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl text-gray-800 dark:text-gray-200"
          >
            폴더 업로드
            <input
              type="file"
              webkitdirectory
              directory
              multiple
              hidden
              :disabled="isUploading"
              @change="handleFolderChange"
            />
          </label>
        </div>
      </div>

      <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 rounded-b-2xl">
        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-300 mb-2">
          동시 업로드 수
        </label>
        <select
          v-model.number="uploadConcurrency"
          :disabled="isUploading"
          class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option
            v-for="count in uploadConcurrencyOptions"
            :key="count"
            :value="count"
          >
            {{ count }}
          </option>
        </select>
        <p class="mt-2 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
          {{ `현재 멤버십 한도: 한 번에 최대 ${maxUploadCount}개, 파일당 ${formatUploadLimitBytes(maxUploadFileBytes)}` }}
        </p>
      </div>
    </div>

    <p v-if="uploadError" class="mt-2 text-xs text-rose-500">
      {{ uploadError }}
    </p>

    <Teleport to="body">
      <button
        v-if="hasUploadItems && !uploadPanelVisible"
        type="button"
        class="upload-panel-chip"
        @click="uploadPanelVisible = true"
      >
        <span class="upload-panel-chip__dot"></span>
        <span>{{ uploadPanelTitle }}</span>
      </button>

      <div
        v-if="hasUploadItems && uploadPanelVisible"
        class="upload-panel"
      >
        <div class="upload-panel__header">
          <div class="upload-panel__header-copy">
            <strong class="upload-panel__title">{{ uploadPanelTitle }}</strong>
            <span class="upload-panel__subtitle">{{ uploadPanelSubtitle }}</span>
          </div>

          <div class="upload-panel__actions">
            <button
              type="button"
              class="upload-panel__icon-button"
              @click="uploadPanelCollapsed = !uploadPanelCollapsed"
              :title="uploadPanelCollapsed ? '펼치기' : '접기'"
            >
              <svg
                class="upload-panel__chevron"
                :class="{ 'is-collapsed': uploadPanelCollapsed }"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              class="upload-panel__icon-button"
              @click="dismissUploadPanel"
              title="닫기"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          v-if="!uploadPanelCollapsed"
          class="upload-panel__body"
        >
          <div class="upload-panel__summary-bar">
            <span>{{ uploadPanelEtaText }}</span>
            <button
              v-if="canCancelUploads"
              type="button"
              class="upload-panel__cancel"
              @click="cancelActiveUploads"
            >
              취소
            </button>
          </div>

          <div class="upload-panel__list">
            <div
              v-for="item in uploadItems"
              :key="item.id"
              class="upload-item"
            >
              <div class="upload-item__file-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 3.75h6.586a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V19.5A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4Z"
                    fill="#dbeafe"
                  />
                  <path
                    d="M14 4v3a1 1 0 0 0 1 1h3"
                    stroke="#93c5fd"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>

              <div class="upload-item__copy">
                <div class="upload-item__name-row">
                  <span class="upload-item__name">{{ item.name }}</span>
                </div>
                <div class="upload-item__detail">
                  {{ item.statusText }}
                </div>
              </div>

              <div
                class="upload-item__indicator"
                :class="`is-${item.status}`"
                :style="getProgressCircleStyle(item)"
                :title="item.statusText"
              >
                <span v-if="item.status === 'completed'" class="upload-item__indicator-symbol">✓</span>
                <span v-else-if="item.status === 'failed'" class="upload-item__indicator-symbol">!</span>
                <span v-else-if="item.status === 'canceled'" class="upload-item__indicator-symbol">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div
      v-if="isDropdownOpen"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import axios from "axios"
import { abortUpload, completeUpload, fetchUploadSessions, initUploadFiles, parseUploadResponse } from "@/api/filesApi.js"
import { useFileStore } from "@/stores/useFileStore"

const isDropdownOpen = ref(false)
const uploadedFiles = ref([])
const isUploading = ref(false)
const uploadError = ref("")
const uploadItems = ref([])
const uploadPanelVisible = ref(false)
const uploadPanelCollapsed = ref(false)
const totalUploadCount = ref(0)
const completedUploadCount = ref(0)
const activeUploadCount = ref(0)
const mergingUploadCount = ref(0)
const uploadSessionStartedAt = ref(null)
const nowTick = ref(Date.now())
const isCancelRequested = ref(false)
const fileStore = useFileStore()
const planCapabilities = computed(() => fileStore.planCapabilities)
const maxUploadCount = computed(() => Number(planCapabilities.value?.maxUploadCount || 30))
const maxUploadFileBytes = computed(() => Number(planCapabilities.value?.maxUploadFileBytes || 5 * 1024 * 1024 * 1024))

const emit = defineEmits(["upload-complete", "upload-fail"])
const PARTITION_SIZE_BYTES = 100 * 1024 * 1024
const CHUNK_SIZE_BYTES = 80 * 1024 * 1024
const DEFAULT_UPLOAD_CONCURRENCY = 3
const MAX_UPLOAD_CONCURRENCY = 5
const UPLOAD_CONCURRENCY_STORAGE_KEY = "file-upload-concurrency"
const uploadConcurrencyOptions = [1, 2, 3, 4, 5]
const ACTIVE_UPLOAD_STATUSES = new Set(["preparing", "pending", "uploading", "merging", "canceling"])
const activeUploadControllers = new Map()
const SPEED_SAMPLE_WINDOW_MS = 12000
const MAX_SPEED_SAMPLES = 8
const MIN_PROGRESS_SAMPLE_INTERVAL_MS = 400

let tickTimerId = null

const formatUploadLimitBytes = (bytes) => {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** unitIndex
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`
}

const normalizeUploadConcurrency = (value) => {
  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue)) {
    return DEFAULT_UPLOAD_CONCURRENCY
  }

  return Math.min(MAX_UPLOAD_CONCURRENCY, Math.max(1, parsedValue))
}

const readStoredUploadConcurrency = () => {
  if (typeof window === "undefined") {
    return DEFAULT_UPLOAD_CONCURRENCY
  }

  return normalizeUploadConcurrency(
    window.localStorage.getItem(UPLOAD_CONCURRENCY_STORAGE_KEY),
  )
}

const uploadConcurrency = ref(readStoredUploadConcurrency())

watch(uploadConcurrency, (value) => {
  const normalizedValue = normalizeUploadConcurrency(value)

  if (normalizedValue !== value) {
    uploadConcurrency.value = normalizedValue
    return
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      UPLOAD_CONCURRENCY_STORAGE_KEY,
      String(normalizedValue),
    )
  }
})

const hasUploadItems = computed(() => uploadItems.value.length > 0)

const activeUploadCountComputed = computed(() =>
  uploadItems.value.filter((item) => ACTIVE_UPLOAD_STATUSES.has(item.status)).length,
)

const resumableUploadCount = computed(() =>
  uploadItems.value.filter(
    (item) => item.status === "resumable" || item.status === "awaiting-complete",
  ).length,
)

const failedUploadCount = computed(() =>
  uploadItems.value.filter((item) => item.status === "failed").length,
)

const canceledUploadCount = computed(() =>
  uploadItems.value.filter((item) => item.status === "canceled").length,
)

const abortableSessionIds = computed(() =>
  Array.from(
    new Set(
      uploadItems.value
        .filter((item) =>
          item?.sessionId &&
          !["completed", "failed", "canceled"].includes(item.status),
        )
        .map((item) => item.sessionId),
    ),
  ),
)

const totalTrackedBytes = computed(() =>
  uploadItems.value.reduce((sum, item) => sum + (item.fileSize || 0), 0),
)

const uploadedTrackedBytes = computed(() =>
  uploadItems.value.reduce((sum, item) => sum + (item.uploadedBytes || 0), 0),
)

const overallTransferSpeedBytes = computed(() =>
  uploadItems.value.reduce((sum, item) => {
    if (!ACTIVE_UPLOAD_STATUSES.has(item.status) || item.status === "merging") {
      return sum
    }

    return sum + Math.max(0, item.averageBytesPerSecond || 0)
  }, 0),
)

const overallTransferSpeedText = computed(() => {
  if (overallTransferSpeedBytes.value <= 0) {
    return ""
  }

  return formatTransferSpeed(overallTransferSpeedBytes.value)
})

const overallEstimatedSeconds = computed(() => {
  if (activeUploadCountComputed.value === 0 || mergingUploadCount.value > 0) {
    return null
  }

  const remainingBytes = uploadItems.value.reduce((sum, item) => {
    if (item.status === "completed") {
      return sum
    }

    return sum + Math.max(0, (item.fileSize || 0) - (item.uploadedBytes || 0))
  }, 0)

  if (remainingBytes <= 0 || overallTransferSpeedBytes.value <= 0) {
    return null
  }

  return Math.max(1, Math.ceil(remainingBytes / overallTransferSpeedBytes.value))
})

const uploadPanelTitle = computed(() => {
  if (activeUploadCountComputed.value > 0) {
    return `${activeUploadCountComputed.value}개 업로드 중`
  }

  if (failedUploadCount.value > 0 && completedUploadCount.value > 0) {
    return `${completedUploadCount.value}개 완료, ${failedUploadCount.value}개 실패`
  }

  if (failedUploadCount.value > 0) {
    return `${failedUploadCount.value}개 업로드 실패`
  }

  if (canceledUploadCount.value > 0) {
    return "업로드가 취소됨"
  }

  if (completedUploadCount.value > 0) {
    return `${completedUploadCount.value}개 업로드 완료`
  }

  return "업로드 상태"
})

const uploadPanelSubtitle = computed(() => {
  if (activeUploadCountComputed.value > 0) {
    return `${completedUploadCount.value}/${totalUploadCount.value} 완료`
  }

  if (failedUploadCount.value > 0) {
    return "실패한 파일을 확인해 주세요."
  }

  if (canceledUploadCount.value > 0) {
    return "중단된 업로드가 있습니다."
  }

  if (completedUploadCount.value > 0) {
    return "모든 업로드가 완료되었습니다."
  }

  return ""
})

const uploadPanelEtaText = computed(() => {
  if (activeUploadCountComputed.value === 0) {
    if (failedUploadCount.value > 0) {
      return "업로드가 중단되었거나 일부 파일이 실패했습니다."
    }

    if (canceledUploadCount.value > 0) {
      return "업로드가 취소되었습니다."
    }

    return "모든 업로드가 완료되었습니다."
  }

  if (mergingUploadCount.value > 0) {
    return "서버에서 업로드를 마무리하는 중입니다..."
  }

  if (overallEstimatedSeconds.value == null) {
    return overallTransferSpeedText.value
      ? `${overallTransferSpeedText.value} 전송 중`
      : "남은 시간을 계산 중입니다..."
  }

  const speedSuffix = overallTransferSpeedText.value
    ? ` · ${overallTransferSpeedText.value}`
    : ""

  return `${formatRemainingTime(overallEstimatedSeconds.value)} 남음${speedSuffix}`
})

const canCancelUploads = computed(() =>
  abortableSessionIds.value.length > 0,
)

const applyUploadPanelSafeArea = () => {
  if (typeof document === "undefined") {
    return
  }

  const rootStyle = document.documentElement.style
  let safeSpace = "0px"

  if (hasUploadItems.value) {
    if (uploadPanelVisible.value && !uploadPanelCollapsed.value) {
      safeSpace = window.innerWidth < 768 ? "220px" : "260px"
    } else {
      safeSpace = "72px"
    }
  }

  rootStyle.setProperty("--upload-panel-safe-space", safeSpace)
}

const handleViewportResize = () => {
  applyUploadPanelSafeArea()
}

watch(
  [hasUploadItems, uploadPanelVisible, uploadPanelCollapsed],
  () => {
    applyUploadPanelSafeArea()
  },
  { immediate: true },
)

const createUploadItem = (file, index) => ({
  id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  name: file.name,
  fileSize: file.size || 0,
  uploadedBytes: 0,
  progress: 0,
  status: "pending",
  statusText: "업로드 대기 중",
  errorMessage: "",
  startedAt: null,
  lastProgressAt: null,
  lastProgressBytes: 0,
  speedSamples: [],
  averageBytesPerSecond: 0,
  estimatedSeconds: null,
})

const getUploadItem = (itemId) =>
  uploadItems.value.find((item) => item.id === itemId)

const setUploadItemState = (itemId, patch) => {
  const item = getUploadItem(itemId)
  if (!item) return
  Object.assign(item, patch)
}

const calculateWeightedAverageSpeed = (speedSamples) => {
  if (!Array.isArray(speedSamples) || speedSamples.length === 0) {
    return 0
  }

  const weighted = speedSamples.reduce(
    (sum, sample, index) => {
      const weight = index + 1
      return {
        speed: sum.speed + sample.speed * weight,
        weight: sum.weight + weight,
      }
    },
    { speed: 0, weight: 0 },
  )

  if (weighted.weight <= 0) {
    return 0
  }

  return weighted.speed / weighted.weight
}

const updateUploadItemProgress = (itemId, uploadedBytes) => {
  const item = getUploadItem(itemId)
  if (!item) return

  const safeUploadedBytes = Math.min(
    item.fileSize || uploadedBytes,
    Math.max(0, uploadedBytes),
  )
  const progress = item.fileSize
    ? Math.min(100, Math.round((safeUploadedBytes / item.fileSize) * 100))
    : safeUploadedBytes > 0
      ? 100
      : 0

  const nextPatch = {
    uploadedBytes: safeUploadedBytes,
    progress,
  }

  const now = Date.now()
  const currentSamples = Array.isArray(item.speedSamples) ? [...item.speedSamples] : []
  const lastProgressAt = item.lastProgressAt || item.startedAt || now
  const lastProgressBytes = Number(item.lastProgressBytes || 0)
  const deltaBytes = Math.max(0, safeUploadedBytes - lastProgressBytes)
  const deltaMs = Math.max(0, now - lastProgressAt)

  let speedSamples = currentSamples.filter((sample) => now - sample.at <= SPEED_SAMPLE_WINDOW_MS)

  if (deltaBytes > 0 && deltaMs >= MIN_PROGRESS_SAMPLE_INTERVAL_MS) {
    speedSamples = [
      ...speedSamples,
      {
        at: now,
        speed: (deltaBytes / deltaMs) * 1000,
      },
    ].slice(-MAX_SPEED_SAMPLES)
    nextPatch.lastProgressAt = now
    nextPatch.lastProgressBytes = safeUploadedBytes
  } else {
    nextPatch.lastProgressAt = item.lastProgressAt || now
    nextPatch.lastProgressBytes = Math.max(lastProgressBytes, safeUploadedBytes)
  }

  const averageBytesPerSecond = calculateWeightedAverageSpeed(speedSamples)
  const remainingBytes = Math.max(0, (item.fileSize || 0) - safeUploadedBytes)
  const estimatedSeconds =
    averageBytesPerSecond > 0 && remainingBytes > 0
      ? Math.max(1, Math.ceil(remainingBytes / averageBytesPerSecond))
      : null

  nextPatch.speedSamples = speedSamples
  nextPatch.averageBytesPerSecond = averageBytesPerSecond
  nextPatch.estimatedSeconds = estimatedSeconds

  if (item.startedAt && safeUploadedBytes > 0 && safeUploadedBytes < item.fileSize) {
    const speedText = averageBytesPerSecond > 0
      ? formatTransferSpeed(averageBytesPerSecond)
      : ""
    const etaText = estimatedSeconds != null
        ? `${formatRemainingTime(estimatedSeconds)} 남음`
      : ""

    nextPatch.statusText = [progress > 0 ? `${progress}%` : "업로드 중", speedText, etaText]
      .filter(Boolean)
      .join(" · ")
  } else if (safeUploadedBytes >= item.fileSize && item.fileSize > 0) {
    nextPatch.statusText = "업로드 완료, 마무리 중"
    nextPatch.averageBytesPerSecond = 0
    nextPatch.estimatedSeconds = 0
  } else {
    nextPatch.statusText = progress > 0 ? `${progress}% 업로드 중` : "업로드 준비 중"
  }

  setUploadItemState(itemId, nextPatch)
}

const formatRemainingTime = (seconds) => {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
    return "곧 완료"
  }

  if (seconds < 60) {
    return `${Math.ceil(seconds)}초`
  }

  if (seconds < 3600) {
    return `${Math.ceil(seconds / 60)}분`
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.ceil((seconds % 3600) / 60)

  if (minutes === 0) {
    return `${hours}시간`
  }

  return `${hours}시간 ${minutes}분`
}

const formatTransferSpeed = (bytesPerSecond) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return ""
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s"]
  let value = bytesPerSecond
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const fractionDigits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`
}

const getProgressCircleStyle = (item) => ({
  "--progress": `${item.progress || 0}%`,
})

const isAbortError = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError"

const toggleDropdown = () => {
  if (isUploading.value) return
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

const dismissUploadPanel = () => {
  uploadPanelVisible.value = false
}

const createNewFolder = () => {
  const folderName = prompt("폴더 이름을 입력해 주세요")
  if (folderName) {
    fileStore.createFolder(folderName).catch((error) => {
      uploadError.value =
        error?.response?.data?.message ||
        error?.message ||
        "폴더를 생성하지 못했습니다."
    })
  }
  closeDropdown()
}

const getFileFormat = (file) => {
  if (typeof file?.name !== "string") return ""

  const lastDot = file.name.lastIndexOf(".")
  if (lastDot < 0 || lastDot === file.name.length - 1) {
    return ""
  }

  return file.name
    .slice(lastDot + 1)
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase()
}

const uploadToPresignedUrl = async (
  payload,
  uploadMeta,
  fileName,
  contentType = "application/octet-stream",
  options = {},
) => {
  const { signal, onProgress } = options
  const presignedUploadUrl = uploadMeta?.presignedUploadUrl

  if (!presignedUploadUrl) {
    throw new Error("업로드 URL이 없습니다.")
  }

  const presignedFormData = uploadMeta?.presignedFormData
  if (presignedFormData && typeof presignedFormData === "object") {
    const formData = new FormData()

    Object.entries(presignedFormData).forEach(([key, value]) => {
      formData.append(key, value)
    })
    if (!presignedFormData.key && uploadMeta?.objectKey) {
      formData.append("key", uploadMeta.objectKey)
    }
    formData.append("file", payload, fileName || "upload.bin")

    await axios.post(presignedUploadUrl, formData, {
      signal,
      onUploadProgress: (event) => {
        onProgress?.(event?.loaded ?? 0)
      },
    })
    return
  }

  await axios.put(presignedUploadUrl, payload, {
    signal,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
    },
    onUploadProgress: (event) => {
      onProgress?.(event?.loaded ?? 0)
    },
  })
}

const getExpectedUploadCount = (file) => {
  if (!file?.size || file.size <= PARTITION_SIZE_BYTES) {
    return 1
  }

  return Math.ceil(file.size / CHUNK_SIZE_BYTES)
}

const getUploadMetaCount = (file, firstUploadMeta) => {
  const partitionCount = Number(firstUploadMeta?.partitionCount)

  if (
    firstUploadMeta?.partitioned === true &&
    Number.isInteger(partitionCount) &&
    partitionCount > 0
  ) {
    return partitionCount
  }

  return getExpectedUploadCount(file)
}

const buildUploadJobs = (selectedFiles, presignedResponses, createdItems) => {
  const uploadJobs = []
  let responseIndex = 0

  for (const [fileIndex, targetFile] of selectedFiles.entries()) {
    const firstUploadMeta = presignedResponses[responseIndex]
    const uploadItem = createdItems[fileIndex]

    if (!firstUploadMeta || !uploadItem) {
      throw new Error(`${targetFile.name} 업로드 정보를 찾을 수 없습니다.`)
    }

    const expectedUploadCount = getUploadMetaCount(targetFile, firstUploadMeta)
    const uploadMetas = presignedResponses.slice(
      responseIndex,
      responseIndex + expectedUploadCount,
    )

    if (uploadMetas.length !== expectedUploadCount) {
      throw new Error(`${targetFile.name} 업로드 메타 개수가 맞지 않습니다.`)
    }

    uploadJobs.push({
      file: targetFile,
      uploadMetas,
      partitioned: uploadMetas[0]?.partitioned === true,
      uploadItemId: uploadItem.id,
    })

    responseIndex += expectedUploadCount
  }

  if (responseIndex !== presignedResponses.length) {
    throw new Error("업로드 메타 개수와 선택한 파일 수가 일치하지 않습니다.")
  }

  return uploadJobs
}

const buildAbortPayload = (uploadMetas) => {
  const metaList = Array.isArray(uploadMetas) ? uploadMetas : []
  const firstMeta = metaList[0]
  const objectKeys = metaList.map((meta) => meta?.objectKey).filter(Boolean)
  const finalObjectKey = firstMeta?.finalObjectKey || firstMeta?.objectKey || null
  const chunkObjectKeys = firstMeta?.partitioned === true ? objectKeys : []

  return {
    finalObjectKey,
    chunkObjectKeys,
  }
}

const abortUploadedFile = async (uploadMetas) => {
  const payload = buildAbortPayload(uploadMetas)

  if (!payload.finalObjectKey) {
    return
  }

  try {
    await abortUpload(payload)
  } catch {
  }
}

const uploadFileByChunks = async (file, uploadMetas, uploadItemId) => {
  const uploadChunkCount = Array.isArray(uploadMetas) ? uploadMetas.length : 0

  if (uploadChunkCount === 0) {
    throw new Error(`${file?.name || "unknown-file"} 업로드 정보가 올바르지 않습니다.`)
  }

  setUploadItemState(uploadItemId, {
    status: "uploading",
    startedAt: Date.now(),
    statusText: "업로드 시작 중",
  })

  let completedBytes = 0

  for (let chunkIndex = 0; chunkIndex < uploadChunkCount; chunkIndex++) {
    if (isCancelRequested.value) {
      throw new DOMException("Upload canceled", "AbortError")
    }

    const start = chunkIndex * CHUNK_SIZE_BYTES
    const end =
      chunkIndex === uploadChunkCount - 1
        ? file.size
        : Math.min(start + CHUNK_SIZE_BYTES, file.size)
    const chunkBlob = file.slice(
      start,
      end,
      file.type || "application/octet-stream",
    )
    const chunkSize = chunkBlob.size || 0
    const controller = new AbortController()

    activeUploadControllers.set(uploadItemId, controller)

    try {
      await uploadToPresignedUrl(
        chunkBlob,
        uploadMetas[chunkIndex],
        uploadChunkCount === 1
          ? file.name
          : `${file.name}.part${String(chunkIndex + 1).padStart(5, "0")}`,
        file.type,
        {
          signal: controller.signal,
          onProgress: (loadedBytes) => {
            updateUploadItemProgress(
              uploadItemId,
              completedBytes + Math.min(chunkSize, loadedBytes),
            )
          },
        },
      )
    } finally {
      activeUploadControllers.delete(uploadItemId)
    }

    completedBytes += chunkSize
    updateUploadItemProgress(uploadItemId, completedBytes)
  }
}

const completeUploadedFile = async (file, uploadMetas, partitioned, uploadItemId, parentId) => {
  const firstMeta = uploadMetas?.[0]
  const finalObjectKey = firstMeta?.finalObjectKey || firstMeta?.objectKey
  const chunkObjectKeys = partitioned
    ? uploadMetas.map((meta) => meta?.objectKey).filter(Boolean)
    : []

  if (!finalObjectKey) {
    throw new Error(`${file.name} 업로드 완료 정보를 확인할 수 없습니다.`)
  }

  if (partitioned && chunkObjectKeys.length !== uploadMetas.length) {
    throw new Error(`${file.name} 청크 정보가 올바르지 않습니다.`)
  }

  setUploadItemState(uploadItemId, {
    status: partitioned ? "merging" : "uploading",
    statusText: partitioned ? "서버에서 파일을 병합하는 중..." : "업로드 완료를 확인하는 중...",
    progress: 100,
    uploadedBytes: file.size || 0,
  })

  try {
    await completeUpload({
      fileOriginName: file.name,
      fileFormat: getFileFormat(file),
      fileSize: file.size,
      finalObjectKey,
      chunkObjectKeys,
      parentId,
    })
  } catch (error) {
    await abortUploadedFile(uploadMetas)
    throw error
  }

  setUploadItemState(uploadItemId, {
    status: "completed",
    statusText: "업로드 완료",
    progress: 100,
    uploadedBytes: file.size || 0,
  })
}
const runUploadJobs = async (uploadJobs, concurrency, parentId) => {
  const successList = new Array(uploadJobs.length)
  const workerCount = Math.min(concurrency, uploadJobs.length)
  let nextJobIndex = 0
  let firstError = null

  const worker = async () => {
    while (true) {
      if (firstError || isCancelRequested.value) {
        return
      }

      const currentJobIndex = nextJobIndex
      nextJobIndex += 1

      if (currentJobIndex >= uploadJobs.length) {
        return
      }

      const currentJob = uploadJobs[currentJobIndex]
      activeUploadCount.value += 1

      try {
        await uploadFileByChunks(
          currentJob.file,
          currentJob.uploadMetas,
          currentJob.uploadItemId,
        )

        if (currentJob.partitioned) {
          mergingUploadCount.value += 1

          try {
            await completeUploadedFile(
              currentJob.file,
              currentJob.uploadMetas,
              true,
              currentJob.uploadItemId,
              parentId,
            )
          } finally {
            mergingUploadCount.value = Math.max(0, mergingUploadCount.value - 1)
          }
        } else {
          await completeUploadedFile(
            currentJob.file,
            currentJob.uploadMetas,
            false,
            currentJob.uploadItemId,
            parentId,
          )
        }

        completedUploadCount.value += 1
        successList[currentJobIndex] = currentJob.file.name
      } catch (error) {
        await abortUploadedFile(currentJob.uploadMetas)
        if (isAbortError(error)) {
          setUploadItemState(currentJob.uploadItemId, {
            status: "canceled",
            statusText: "업로드 취소됨",
          })
        } else {
          setUploadItemState(currentJob.uploadItemId, {
            status: "failed",
            statusText: error?.message || "업로드 실패",
            errorMessage: error?.message || "업로드 실패",
          })
          firstError = error
        }
      } finally {
        activeUploadCount.value = Math.max(0, activeUploadCount.value - 1)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker))

  if (firstError) {
    throw firstError
  }

  return successList.filter(Boolean)
}

const cancelActiveUploads = () => {
  if (!canCancelUploads.value) return

  isCancelRequested.value = true

  uploadItems.value.forEach((item) => {
    if (item.status === "pending" || item.status === "preparing") {
      item.status = "canceled"
      item.statusText = "업로드 취소됨"
      return
    }

    if (item.status === "uploading" || item.status === "merging") {
      item.status = "canceling"
      item.statusText = "취소 중..."
    }
  })

  activeUploadControllers.forEach((controller) => {
    controller.abort()
  })
}

const markUnfinishedUploadsStopped = (reasonText) => {
  uploadItems.value.forEach((item) => {
    if (item.status === "pending" || item.status === "preparing") {
      item.status = "failed"
      item.statusText = reasonText
    }
  })
}

const toNormalizedError = (error) => {
  if (!error) return "업로드 중 오류가 발생했습니다."
  if (typeof error === "string") return error

  if (isAbortError(error)) {
    return "업로드가 취소되었습니다."
  }

  if (error.code === "ECONNABORTED") {
    return "업로드 시간이 초과되었습니다. 서버 상태를 확인해 주세요."
  }

  if (error.response) {
    if (typeof error.response.data === "string") return error.response.data
    if (error.response.data?.message) return error.response.data.message
    if (error.response.data?.result?.message) {
      return error.response.data.result.message
    }
    return `업로드 중 오류가 발생했습니다. 상태 코드: ${error.response.status}`
  }

  if (error.message) return error.message
  return "업로드에 실패했습니다."
}

const handleUpload = async (event, uploadTypeLabel) => {
  const selectedFiles = Array.from(event?.target?.files || [])
  if (!selectedFiles.length) return

  if (!fileStore.storageSummary && !fileStore.storageLoading) {
    await fileStore.fetchStorageSummary().catch(() => {})
  }

  if (selectedFiles.length > maxUploadCount.value) {
    const message = `\uD55C \uBC88\uC5D0 \uCD5C\uB300 ${maxUploadCount.value}\uAC1C\uAE4C\uC9C0 \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`
    uploadError.value = message
    emit("upload-fail", message)

    if (event?.target) {
      event.target.value = ""
    }

    return
  }

  const oversizedFile = selectedFiles.find((file) => Number(file?.size || 0) > maxUploadFileBytes.value)
  if (oversizedFile) {
    const message = `\"${oversizedFile.name}\" \uD30C\uC77C\uC740 \uD604\uC7AC \uBA64\uBC84\uC2ED \uD55C\uB3C4(${formatUploadLimitBytes(maxUploadFileBytes.value)})\uB97C \uCD08\uACFC\uD574 \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.`
    uploadError.value = message
    emit("upload-fail", message)

    if (event?.target) {
      event.target.value = ""
    }

    return
  }

  const uploadParentId = fileStore.currentFolderId

  uploadError.value = ""
  uploadedFiles.value = []
  uploadPanelVisible.value = true
  uploadPanelCollapsed.value = false
  isUploading.value = true
  isCancelRequested.value = false
  totalUploadCount.value = selectedFiles.length
  completedUploadCount.value = 0
  activeUploadCount.value = 0
  mergingUploadCount.value = 0
  uploadSessionStartedAt.value = Date.now()
  uploadItems.value = selectedFiles.map((file, index) => createUploadItem(file, index))

  try {

    const invalidName = selectedFiles.find(
      (file) => !file?.name || typeof file.name !== "string",
    )
    if (invalidName) {
      throw new Error("이름이 올바르지 않은 파일이 포함되어 있습니다.")
    }

    const invalidFormat = selectedFiles.find((file) => {
      const idx = file.name.lastIndexOf(".")
      return idx <= 0 || idx === file.name.length - 1
    })
    if (invalidFormat) {
      throw new Error(`"${invalidFormat.name}" 파일은 확장자가 없습니다.`)
    }

    uploadItems.value.forEach((item) => {
      item.status = "preparing"
      item.statusText = "업로드 정보 준비 중"
    })

    const response = await uploadFiles(selectedFiles, uploadParentId)
    const presignedResponses = parseUploadResponse(response?.data)

    if (!Array.isArray(presignedResponses) || presignedResponses.length === 0) {
      throw new Error("업로드 응답이 비어 있습니다.")
    }

    uploadItems.value.forEach((item) => {
      item.status = "pending"
      item.statusText = "업로드 대기 중"
    })

    const uploadJobs = buildUploadJobs(
      selectedFiles,
      presignedResponses,
      uploadItems.value,
    )

    const successList = await runUploadJobs(
      uploadJobs,
      normalizeUploadConcurrency(uploadConcurrency.value),
      uploadParentId,
    )

    if (isCancelRequested.value) {
      return
    }

    uploadedFiles.value = successList
    if (fileStore.driveHasLoaded && !fileStore.hasLoaded) {
      await fileStore.refreshDrivePage().catch(() => {})
    } else {
      await fileStore.fetchFiles().catch(() => {})
    }
    emit("upload-complete", uploadedFiles.value)
    console.log(`[${uploadTypeLabel}] 업로드 완료:`, uploadedFiles.value)
  } catch (error) {
    const message = toNormalizedError(error)

    if (!isAbortError(error)) {
      markUnfinishedUploadsStopped("업로드 중단됨")
    }

    uploadError.value = message
    emit("upload-fail", message)
    console.error(`[${uploadTypeLabel}] 업로드 실패:`, error)
  } finally {
    isUploading.value = false
    activeUploadCount.value = 0
    mergingUploadCount.value = 0
    activeUploadControllers.clear()
    closeDropdown()

    if (event?.target) {
      event.target.value = ""
    }
  }
}

const handleFileChange = async (event) => {
  await handleUpload(event, "파일")
}

const handleFolderChange = async (event) => {
  await handleUpload(event, "폴더")
}

const handleKeydown = (event) => {
  if (event.key === "Escape" && isDropdownOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeydown)
  window.addEventListener("resize", handleViewportResize)
  applyUploadPanelSafeArea()
  tickTimerId = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown)
  window.removeEventListener("resize", handleViewportResize)

  if (tickTimerId) {
    window.clearInterval(tickTimerId)
  }

  activeUploadControllers.forEach((controller) => {
    controller.abort()
  })
  activeUploadControllers.clear()
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--upload-panel-safe-space", "0px")
  }
})
</script>

<style scoped>
.upload-panel-chip {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  isolation: isolate;
  transform: translateZ(0);
  font-size: 13px;
  font-weight: 700;
}

.upload-panel-chip__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #60a5fa;
  box-shadow: 0 0 0 6px rgba(96, 165, 250, 0.18);
}

.upload-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 10000;
  width: 340px;
  max-width: calc(100vw - 32px);
  border-radius: 22px;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  isolation: isolate;
  transform: translateZ(0);
  will-change: transform;
}

.upload-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  background: var(--bg-elevated);
}

.upload-panel__header-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.upload-panel__title {
  color: var(--text-main);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.15;
}

.upload-panel__subtitle {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.upload-panel__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.upload-panel__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  color: var(--text-secondary);
  transition: background-color 0.18s ease, color 0.18s ease;
}

.upload-panel__icon-button:hover {
  background: var(--bg-input);
  color: var(--accent);
}

.upload-panel__chevron {
  transition: transform 0.18s ease;
}

.upload-panel__chevron.is-collapsed {
  transform: rotate(180deg);
}

.upload-panel__body {
  border-top: 1px solid var(--border-color);
}

.upload-panel__summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  background: var(--bg-input);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.upload-panel__cancel {
  color: var(--accent);
  font-weight: 700;
}

.upload-panel__cancel:hover {
  text-decoration: underline;
}

.upload-panel__list {
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg-elevated);
}

.upload-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
}

.upload-item + .upload-item {
  border-top: 1px solid var(--border-color);
}

.upload-item__file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.upload-item__copy {
  min-width: 0;
}

.upload-item__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.upload-item__name {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-item__detail {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-item__indicator {
  --progress: 0%;
  position: relative;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1.5px solid var(--border-strong);
  background: var(--bg-main);
}

.upload-item__indicator::before {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: var(--bg-main);
}

.upload-item__indicator.is-uploading,
.upload-item__indicator.is-merging,
.upload-item__indicator.is-canceling {
  border: none;
  background: conic-gradient(var(--accent) var(--progress), var(--accent-soft) 0);
}

.upload-item__indicator.is-merging {
  background: conic-gradient(var(--accent-hover) var(--progress), var(--accent-soft) 0);
}

.upload-item__indicator.is-completed {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.upload-item__indicator.is-failed {
  border-color: var(--danger);
  background: var(--danger-soft);
}

.upload-item__indicator.is-canceled {
  border-color: var(--border-strong);
  background: var(--bg-input);
}

.upload-item__indicator-symbol {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 14px;
  font-weight: 900;
  z-index: 1;
}

.upload-item__indicator.is-failed .upload-item__indicator-symbol {
  color: var(--danger);
}

.upload-item__indicator.is-canceled .upload-item__indicator-symbol {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .upload-panel,
  .upload-panel-chip {
    right: 12px;
    bottom: 12px;
  }

  .upload-panel {
    width: min(100vw - 24px, 340px);
  }
}
</style>
