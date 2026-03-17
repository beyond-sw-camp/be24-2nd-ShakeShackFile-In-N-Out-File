<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useFileStore } from "@/stores/useFileStore";
import { downloadFileAsset } from "@/api/filesApi.js";

const props = defineProps({
  file: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close"]);
const fileStore = useFileStore();
const textPreview = ref(null);
const textPreviewError = ref("");
const isTextPreviewLoading = ref(false);
const isDownloading = ref(false);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "heic", "avif", "apng", "jfif", "tif", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "wmv", "m4v", "mpeg", "mpg", "ogv", "3gp"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "flac", "ogg", "m4a"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "log", "json", "xml", "html", "htm", "css", "js", "ts", "java", "py", "sql", "yml", "yaml", "properties", "sh", "bat"]);

const extension = computed(() => String(props.file?.extension || props.file?.fileFormat || "").toLowerCase());
const contentType = computed(() => String(props.file?.contentType || props.file?.raw?.contentType || "").toLowerCase());

const previewKind = computed(() => {
  if (contentType.value.startsWith("image/") || IMAGE_EXTENSIONS.has(extension.value)) return "image";
  if (contentType.value.startsWith("video/") || VIDEO_EXTENSIONS.has(extension.value)) return "video";
  if (AUDIO_EXTENSIONS.has(extension.value)) return "audio";
  if (PDF_EXTENSIONS.has(extension.value)) return "pdf";
  if (TEXT_EXTENSIONS.has(extension.value)) return "text";
  return "none";
});

const previewUrl = computed(() => props.file?.downloadUrl || props.file?.presignedDownloadUrl || "");
const isLockedFile = computed(() => Boolean(props.file?.lockedFile));
const canDownload = computed(() => Boolean(!isLockedFile.value && previewUrl.value));

const handleDownload = async () => {
  if (!canDownload.value || isDownloading.value) return;

  try {
    isDownloading.value = true;
    await downloadFileAsset(props.file);
  } catch (error) {
    window.alert(error?.message || "\uD30C\uC77C\uC744 \uB2E4\uC6B4\uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  } finally {
    isDownloading.value = false;
  }
};
const statusChips = computed(() => {
  const chips = [];

  if (props.file?.sharedWithMe) {
    chips.push({ key: "shared-with-me", label: "공유받음", icon: "in", tone: "shared-in" });
  }

  if (props.file?.sharedFile && !props.file?.sharedWithMe) {
    chips.push({ key: "shared-file", label: "공유 중", icon: "out", tone: "shared-out" });
  }

  if (isLockedFile.value) {
    chips.push({ key: "locked", label: "잠금", icon: "lock", tone: "locked" });
  }

  if (!chips.length) {
    chips.push({ key: "normal", label: "일반", icon: "dot", tone: "normal" });
  }

  return chips;
});

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const formatDate = (value) => {
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

const locationLabel = computed(() => {
  if (!props.file) {
    return "홈";
  }

  if (props.file.sharedWithMe) {
    return "공유 문서함";
  }

  const parentPath = props.file.parentId != null
    ? fileStore.getFolderPath(props.file.parentId).map((folder) => folder.name)
    : [];

  return ["홈", ...parentPath].join(" / ");
});

const closeOnEscape = (event) => {
  if (event.key === "Escape") {
    emit("close");
  }
};

const loadTextPreview = async () => {
  if (!props.file?.id || previewKind.value !== "text") {
    textPreview.value = null;
    textPreviewError.value = "";
    isTextPreviewLoading.value = false;
    return;
  }

  if (isLockedFile.value) {
    textPreview.value = null;
    textPreviewError.value = "이 파일은 잠겨있습니다.";
    isTextPreviewLoading.value = false;
    return;
  }

  isTextPreviewLoading.value = true;
  textPreviewError.value = "";

  try {
    textPreview.value = await fileStore.fetchTextPreviewFor(props.file);
  } catch (error) {
    textPreviewError.value = error?.response?.data?.message || error?.message || "텍스트 미리보기를 불러오지 못했습니다.";
  } finally {
    isTextPreviewLoading.value = false;
  }
};

watch(
  () => props.file,
  (file) => {
    window.removeEventListener("keydown", closeOnEscape);
    if (file) {
      window.addEventListener("keydown", closeOnEscape);
    }
    loadTextPreview();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", closeOnEscape);
});
</script>

<template>
  <div v-if="file" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4" @click.self="emit('close')">
    <div class="flex h-[min(88vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl lg:flex-row">
      <section class="flex min-h-[320px] flex-1 items-center justify-center bg-slate-950/95 p-4">
        <div v-if="isLockedFile" class="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl border border-amber-400/30 bg-amber-100/5 px-6 text-center text-amber-100">
          <div class="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20">
            <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5s-3 1.343-3 3 1.343 3 3 3Zm-6 9v-3a6 6 0 0 1 12 0v3" />
            </svg>
          </div>
          <p class="text-lg font-semibold">이 파일은 잠겨있습니다.</p>
          <p class="text-sm text-amber-200/80">조회, 다운로드, 공유 등 관련 기능이 제한됩니다.</p>
        </div>

        <img v-else-if="previewKind === 'image' && previewUrl" :src="previewUrl" :alt="file.name" class="max-h-full max-w-full rounded-2xl object-contain" />
        <video v-else-if="previewKind === 'video' && previewUrl" :src="previewUrl" controls preload="metadata" class="max-h-full max-w-full rounded-2xl bg-black"></video>
        <audio v-else-if="previewKind === 'audio' && previewUrl" :src="previewUrl" controls class="w-full max-w-xl"></audio>
        <iframe v-else-if="previewKind === 'pdf' && previewUrl" :src="previewUrl" class="h-full min-h-[70vh] w-full rounded-2xl bg-white" title="pdf-preview"></iframe>

        <div v-else-if="previewKind === 'text'" class="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
          <div v-if="isTextPreviewLoading" class="flex h-full items-center justify-center text-sm text-slate-300">텍스트 미리보기를 불러오는 중입니다.</div>
          <div v-else-if="textPreviewError" class="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300">{{ textPreviewError }}</div>
          <div v-else class="flex h-full min-h-0 flex-col">
            <div class="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">{{ textPreview?.truncated ? '미리보기용으로 일부만 표시합니다.' : '전체 텍스트를 표시합니다.' }}</div>
            <pre class="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm leading-6 text-slate-100">{{ textPreview?.content || '' }}</pre>
          </div>
        </div>

        <div v-else class="rounded-3xl border border-dashed border-slate-700 px-8 py-14 text-center text-sm text-slate-300">현재 형식은 바로 미리보기를 지원하지 않습니다.</div>
      </section>

      <aside class="flex w-full flex-col border-l border-gray-200 bg-white lg:w-[360px]">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-5">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">파일 정보</p>
            <h3 class="mt-2 truncate text-xl font-bold text-gray-900">{{ file.name }}</h3>
            <p class="mt-2 text-sm text-gray-500">{{ locationLabel }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="chip in statusChips"
                :key="chip.key"
                class="status-pill"
                :class="`status-pill--${chip.tone}`"
              >
                <span class="status-pill__icon" :class="`status-pill__icon--${chip.icon}`"></span>
                {{ chip.label }}
              </span>
            </div>
          </div>

          <button type="button" class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600" @click="emit('close')">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div class="rounded-2xl bg-slate-50 px-4 py-4"><p class="text-xs font-semibold uppercase tracking-wide text-gray-400">형식</p><p class="mt-2 text-sm font-bold text-gray-900">{{ (extension || '-').toUpperCase() }}</p></div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4"><p class="text-xs font-semibold uppercase tracking-wide text-gray-400">크기</p><p class="mt-2 text-sm font-bold text-gray-900">{{ formatBytes(file.sizeBytes) }}</p></div>
          </div>

          <div class="rounded-2xl border border-gray-200 px-4 py-4">
            <dl class="space-y-3 text-sm text-gray-600">
              <div class="flex items-center justify-between gap-4"><dt>업로드 시각</dt><dd class="text-right font-semibold text-gray-900">{{ formatDate(file.uploadDate) }}</dd></div>
              <div class="flex items-center justify-between gap-4"><dt>수정 시각</dt><dd class="text-right font-semibold text-gray-900">{{ formatDate(file.updatedAt) }}</dd></div>
              <div class="flex items-center justify-between gap-4"><dt>위치</dt><dd class="text-right font-semibold text-gray-900">{{ locationLabel }}</dd></div>
              <div v-if="file.sharedWithMe" class="flex items-center justify-between gap-4"><dt>공유한 사람</dt><dd class="text-right font-semibold text-gray-900">{{ file.ownerName || file.ownerEmail || '-' }}</dd></div>
              <div v-if="file.sharedWithMe" class="flex items-center justify-between gap-4"><dt>공유 시각</dt><dd class="text-right font-semibold text-gray-900">{{ formatDate(file.sharedAt) }}</dd></div>
              <div class="flex items-start justify-between gap-4">
                <dt>상태</dt>
                <dd>
                  <div class="flex flex-wrap justify-end gap-2">
                    <span
                      v-for="chip in statusChips"
                      :key="`panel-${chip.key}`"
                      class="status-pill"
                      :class="`status-pill--${chip.tone}`"
                    >
                      <span class="status-pill__icon" :class="`status-pill__icon--${chip.icon}`"></span>
                      {{ chip.label }}
                    </span>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="border-t border-gray-200 px-6 py-5">
          <button v-if="!canDownload" type="button" class="inline-flex w-full items-center justify-center rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500" disabled>
            {{ isLockedFile ? '잠긴 파일은 다운로드할 수 없습니다.' : '다운로드 불가' }}
          </button>
          <button v-else type="button" class="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300" :disabled="isDownloading" @click="handleDownload">{{ isDownloading ? "\uB2E4\uC6B4\uB85C\uB4DC \uC911..." : "\uB2E4\uC6B4\uB85C\uB4DC" }}</button>
        </div>
      </aside>
    </div>
  </div>
</template>
<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.38rem 0.72rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.status-pill__icon {
  position: relative;
  display: inline-flex;
  height: 0.95rem;
  width: 0.95rem;
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
  border-color: #bae6fd;
  background: linear-gradient(135deg, #ecfeff 0%, #eff6ff 100%);
  color: #0f766e;
}

.status-pill--shared-in .status-pill__icon {
  background: rgba(6, 182, 212, 0.14);
}

.status-pill--shared-out {
  border-color: #bbf7d0;
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  color: #166534;
}

.status-pill--shared-out .status-pill__icon {
  background: rgba(34, 197, 94, 0.14);
}

.status-pill--locked {
  border-color: #fde68a;
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
  color: #b45309;
}

.status-pill--locked .status-pill__icon {
  background: rgba(245, 158, 11, 0.16);
}

.status-pill--normal {
  border-color: #e2e8f0;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  color: #475569;
}

.status-pill--normal .status-pill__icon {
  background: rgba(100, 116, 139, 0.12);
}
</style>
