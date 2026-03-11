<script setup>
import { computed, ref, watch } from "vue";
import { useFileStore } from "@/stores/useFileStore";

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

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "heic"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "wmv", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "flac", "ogg", "m4a"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "csv", "log", "json", "xml", "html", "htm",
  "css", "js", "ts", "java", "py", "sql", "yml", "yaml",
  "properties", "sh", "bat",
]);

const extension = computed(() =>
  String(props.file?.extension || props.file?.fileFormat || "").toLowerCase(),
);

const previewKind = computed(() => {
  if (IMAGE_EXTENSIONS.has(extension.value)) return "image";
  if (VIDEO_EXTENSIONS.has(extension.value)) return "video";
  if (AUDIO_EXTENSIONS.has(extension.value)) return "audio";
  if (PDF_EXTENSIONS.has(extension.value)) return "pdf";
  if (TEXT_EXTENSIONS.has(extension.value)) return "text";
  return "none";
});

const previewUrl = computed(() =>
  props.file?.downloadUrl || props.file?.presignedDownloadUrl || "",
);

const formatBytes = (bytes) => {
  const size = Number(bytes || 0);
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
    return "내 드라이브";
  }

  const parentPath = props.file.parentId != null
    ? fileStore.getFolderPath(props.file.parentId).map((folder) => folder.name)
    : [];

  return ["내 드라이브", ...parentPath].join(" / ");
});

const loadTextPreview = async () => {
  if (!props.file?.id || previewKind.value !== "text") {
    textPreview.value = null;
    textPreviewError.value = "";
    isTextPreviewLoading.value = false;
    return;
  }

  isTextPreviewLoading.value = true;
  textPreviewError.value = "";

  try {
    textPreview.value = await fileStore.fetchTextPreview(props.file.id);
  } catch (error) {
    textPreviewError.value =
      error?.response?.data?.message ||
      error?.message ||
      "텍스트 미리보기를 불러오지 못했습니다.";
  } finally {
    isTextPreviewLoading.value = false;
  }
};

watch(() => props.file?.id, () => {
  loadTextPreview();
}, { immediate: true });
</script>

<template>
  <div
    v-if="file"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4"
    @click.self="emit('close')"
  >
    <div class="flex h-[min(88vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl lg:flex-row">
      <section class="flex min-h-[320px] flex-1 items-center justify-center bg-slate-950/95 p-4">
        <img
          v-if="previewKind === 'image' && previewUrl"
          :src="previewUrl"
          :alt="file.name"
          class="max-h-full max-w-full rounded-2xl object-contain"
        />

        <video
          v-else-if="previewKind === 'video' && previewUrl"
          :src="previewUrl"
          controls
          preload="metadata"
          class="max-h-full max-w-full rounded-2xl bg-black"
        ></video>

        <audio
          v-else-if="previewKind === 'audio' && previewUrl"
          :src="previewUrl"
          controls
          class="w-full max-w-xl"
        ></audio>

        <iframe
          v-else-if="previewKind === 'pdf' && previewUrl"
          :src="previewUrl"
          class="h-full min-h-[70vh] w-full rounded-2xl bg-white"
          title="pdf-preview"
        ></iframe>

        <div
          v-else-if="previewKind === 'text'"
          class="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
        >
          <div
            v-if="isTextPreviewLoading"
            class="flex h-full items-center justify-center text-sm text-slate-300"
          >
            텍스트 미리보기를 불러오는 중입니다.
          </div>

          <div
            v-else-if="textPreviewError"
            class="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300"
          >
            {{ textPreviewError }}
          </div>

          <div v-else class="flex h-full min-h-0 flex-col">
            <div class="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
              {{ textPreview?.truncated ? "미리보기는 앞부분만 표시됩니다." : "전체 텍스트를 표시합니다." }}
            </div>
            <pre class="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm leading-6 text-slate-100">{{ textPreview?.content || "" }}</pre>
          </div>
        </div>

        <div
          v-else
          class="rounded-3xl border border-dashed border-slate-700 px-8 py-14 text-center text-sm text-slate-300"
        >
          이 형식은 바로 미리보기를 제공하지 않습니다.
        </div>
      </section>

      <aside class="flex w-full flex-col border-l border-gray-200 bg-white lg:w-[360px]">
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-5">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">파일 정보</p>
            <h3 class="mt-2 truncate text-xl font-bold text-gray-900">{{ file.name }}</h3>
            <p class="mt-2 text-sm text-gray-500">{{ locationLabel }}</p>
          </div>

          <button
            type="button"
            class="rounded-full p-2 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">형식</p>
              <p class="mt-2 text-sm font-bold text-gray-900">{{ (extension || "-").toUpperCase() }}</p>
            </div>
            <div class="rounded-2xl bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">크기</p>
              <p class="mt-2 text-sm font-bold text-gray-900">{{ formatBytes(file.sizeBytes) }}</p>
            </div>
          </div>

          <div class="rounded-2xl border border-gray-200 px-4 py-4">
            <dl class="space-y-3 text-sm text-gray-600">
              <div class="flex items-center justify-between gap-4">
                <dt>업로드 시간</dt>
                <dd class="text-right font-semibold text-gray-900">{{ formatDate(file.uploadDate) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt>수정 시간</dt>
                <dd class="text-right font-semibold text-gray-900">{{ formatDate(file.updatedAt) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt>위치</dt>
                <dd class="text-right font-semibold text-gray-900">{{ locationLabel }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="border-t border-gray-200 px-6 py-5">
          <a
            :href="previewUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            다운로드
          </a>
        </div>
      </aside>
    </div>
  </div>
</template>
