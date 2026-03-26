<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { downloadFileAsset } from '@/api/filesApi'
import postApi from '@/api/postApi'

const route = useRoute()
const router = useRouter()

// ── 상태 ──────────────────────────────────────────────────────────────────────
const title = ref('')
const contentBlocks = ref([])
const rawContent = ref('')

const workspaceId = ref(null)
const workspaceAssets = ref([])
const workspaceAssetLoading = ref(false)
const workspaceAssetError = ref('')
const isLoading = ref(true)
const loadError = ref('')
const activeAssetId = ref(null)

// ── 계산 ──────────────────────────────────────────────────────────────────────
const workspaceImages = computed(() => workspaceAssets.value.filter((a) => a.assetType === 'IMAGE'))
const workspaceFiles = computed(() => workspaceAssets.value.filter((a) => a.assetType === 'FILE'))
const hasAssets = computed(() => workspaceAssets.value.length > 0)

// ── 유틸 ──────────────────────────────────────────────────────────────────────
const formatBytes = (bytes) => {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const idx = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const val = size / 1024 ** idx
  const digits = idx === 0 ? 0 : val >= 100 ? 0 : val >= 10 ? 1 : 2
  return `${val.toFixed(digits)} ${units[idx]}`
}

const formatDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

const normalizeAsset = (asset = {}) => ({
  id: asset.idx ?? asset.id ?? null,
  workspaceId: asset.workspaceIdx ?? asset.workspaceId ?? workspaceId.value,
  assetType: String(asset.assetType || 'FILE').toUpperCase(),
  originalName: asset.originalName || asset.fileOriginName || '이름 없는 파일',
  storedFileName: asset.storedFileName || asset.fileSaveName || '',
  objectKey: asset.objectKey || asset.fileSavePath || '',
  contentType: asset.contentType || 'application/octet-stream',
  fileSize: Number(asset.fileSize || 0),
  previewUrl: asset.previewUrl || '',
  downloadUrl: asset.downloadUrl || asset.presignedDownloadUrl || '',
  createdAt: asset.createdAt || null,
  createdAtLabel: formatDateTime(asset.createdAt),
  fileSizeLabel: formatBytes(asset.fileSize),
})

// ── EditorJS 블록 렌더러 ──────────────────────────────────────────────────────
const renderBlock = (block) => {
  if (!block?.type) return ''

  const d = block.data || {}

  switch (block.type) {
    case 'header': {
      const level = Math.min(Math.max(Number(d.level) || 2, 1), 6)
      return `<h${level} class="ro-heading ro-heading--${level}">${d.text || ''}</h${level}>`
    }
    case 'paragraph':
      return `<p class="ro-paragraph">${d.text || ''}</p>`
    case 'list': {
      const tag = d.style === 'ordered' ? 'ol' : 'ul'
      const items = (d.items || []).map((item) => `<li>${item}</li>`).join('')
      return `<${tag} class="ro-list ro-list--${d.style || 'unordered'}">${items}</${tag}>`
    }
    case 'image': {
      const caption = d.caption ? `<figcaption class="ro-image-caption">${d.caption}</figcaption>` : ''
      const classes = ['ro-image-wrap', d.withBorder && 'ro-image-wrap--border', d.stretched && 'ro-image-wrap--stretched'].filter(Boolean).join(' ')
      return `<figure class="${classes}"><img src="${d.file?.url || d.url || ''}" alt="${d.caption || ''}" class="ro-image" />${caption}</figure>`
    }
    case 'delimiter':
      return `<hr class="ro-delimiter" />`
    case 'quote':
      return `<blockquote class="ro-quote"><p>${d.text || ''}</p>${d.caption ? `<cite>${d.caption}</cite>` : ''}</blockquote>`
    case 'code':
      return `<pre class="ro-code"><code>${(d.code || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
    case 'table': {
      const rows = (d.content || []).map((row, ri) => {
        const cells = row.map((cell) => ri === 0 && d.withHeadings ? `<th>${cell}</th>` : `<td>${cell}</td>`).join('')
        return `<tr>${cells}</tr>`
      }).join('')
      return `<div class="ro-table-wrap"><table class="ro-table">${rows}</table></div>`
    }
    case 'checklist': {
      const items = (d.items || []).map((item) =>
        `<li class="ro-checklist-item${item.checked ? ' ro-checklist-item--checked' : ''}">
          <span class="ro-checklist-mark">${item.checked ? '✓' : ''}</span>
          <span>${item.text || ''}</span>
        </li>`
      ).join('')
      return `<ul class="ro-checklist">${items}</ul>`
    }
    default:
      return d.text ? `<p class="ro-paragraph">${d.text}</p>` : ''
  }
}

const renderContent = (raw) => {
  if (!raw) return ''

  // EditorJS JSON 형식인 경우
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed?.blocks && Array.isArray(parsed.blocks)) {
      return parsed.blocks.map(renderBlock).join('\n')
    }
  } catch {}

  // 이미 HTML인 경우 그대로 반환
  if (typeof raw === 'string' && raw.trim().startsWith('<')) {
    return raw
  }

  // 일반 텍스트
  return `<p class="ro-paragraph">${raw}</p>`
}

// ── 데이터 로드 ──────────────────────────────────────────────────────────────
const loadPost = async () => {
  const id = route.params.id
  if (!id) {
    loadError.value = '유효하지 않은 게시물 ID입니다.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  loadError.value = ''

  try {
    const data = await postApi.getPost(id)

    // READ 권한이 아닌 사용자는 일반 워크스페이스로 리다이렉트
    const role = String(data?.accessRole || data?.level || '').toUpperCase()
    if (role && role !== 'READ') {
      await router.replace(`/workspace/read/${id}`)
      return
    }

    title.value = data?.title || '제목 없음'
    workspaceId.value = data?.idx ? Number(data.idx) : null
    rawContent.value = data?.contents || ''

    // 에셋 로드
    if (workspaceId.value) {
      await loadAssets(workspaceId.value)
    }
  } catch (error) {
    loadError.value =
      error?.response?.data?.message ||
      error?.message ||
      '워크스페이스를 불러오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}

const loadAssets = async (wsId) => {
  workspaceAssetLoading.value = true
  workspaceAssetError.value = ''
  try {
    const result = await postApi.getWorkspaceAssets(wsId)
    workspaceAssets.value = (Array.isArray(result) ? result : []).map(normalizeAsset)
  } catch (error) {
    workspaceAssetError.value =
      error?.response?.data?.message ||
      error?.message ||
      '첨부 파일을 불러오지 못했습니다.'
    workspaceAssets.value = []
  } finally {
    workspaceAssetLoading.value = false
  }
}

// ── 파일 다운로드 ─────────────────────────────────────────────────────────────
const downloadAsset = async (asset) => {
  if (!asset?.downloadUrl) return
  try {
    await downloadFileAsset(asset, asset.originalName)
  } catch {
    workspaceAssetError.value = '파일 다운로드에 실패했습니다.'
  }
}

const toggleAssetActions = (assetId) => {
  if (assetId == null) return
  activeAssetId.value = activeAssetId.value === assetId ? null : assetId
}

const getAssetBadge = (asset) => (asset?.assetType === 'IMAGE' ? '이미지' : '파일')

const renderedContent = computed(() => renderContent(rawContent.value))

// ── 테마 동기화 ───────────────────────────────────────────────────────────────
const syncTheme = () => {
  const saved = localStorage.getItem('theme')
  const dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

onMounted(async () => {
  syncTheme()
  await loadPost()
})
</script>

<template>
  <div class="ro-layout">

    <!-- ── 로딩 / 에러 ──────────────────────────────────────────────────────── -->
    <div v-if="isLoading" class="ro-state-screen">
      <div class="ro-spinner"></div>
      <p>불러오는 중...</p>
    </div>

    <div v-else-if="loadError" class="ro-state-screen ro-state-screen--error">
      <p>{{ loadError }}</p>
    </div>

    <!-- ── 본문 ─────────────────────────────────────────────────────────────── -->
    <template v-else>
      <div class="ro-shell">

        <!-- 읽기 전용 배지 -->
        <div class="ro-badge-bar">
          <span class="ro-readonly-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            읽기 전용
          </span>
        </div>

        <!-- 제목 -->
        <h1 class="ro-title">{{ title || '제목 없음' }}</h1>

        <!-- 첨부 파일 섹션 -->
        <div v-if="workspaceAssetLoading" class="ro-assets-loading">첨부 파일을 불러오는 중...</div>
        <div v-else-if="workspaceAssetError" class="ro-assets-error">{{ workspaceAssetError }}</div>
        <div v-else-if="hasAssets" class="ro-assets">
          <div class="ro-assets__header">
            <span class="ro-assets__title">첨부 파일</span>
            <span class="ro-assets__count">{{ workspaceAssets.length }}</span>
          </div>

          <!-- 이미지 그리드 -->
          <section v-if="workspaceImages.length > 0" class="ro-assets__group">
            <p class="ro-assets__group-label">이미지 {{ workspaceImages.length }}개</p>
            <div class="ro-image-grid">
              <article v-for="asset in workspaceImages" :key="asset.id" class="ro-image-card">
                <a :href="asset.previewUrl" target="_blank" rel="noopener noreferrer" class="ro-image-card__preview">
                  <img :src="asset.previewUrl" :alt="asset.originalName" class="ro-image-card__img" />
                </a>
                <div class="ro-image-card__meta">
                  <strong>{{ asset.originalName }}</strong>
                  <span>{{ asset.fileSizeLabel }}</span>
                </div>
              </article>
            </div>
          </section>

          <!-- 파일 목록 -->
          <section v-if="workspaceFiles.length > 0" class="ro-assets__group">
            <p class="ro-assets__group-label">파일 {{ workspaceFiles.length }}개</p>
            <div class="ro-file-list">
              <article
                v-for="asset in workspaceFiles"
                :key="asset.id"
                class="ro-file-card"
                :class="{ 'ro-file-card--active': activeAssetId === asset.id }"
              >
                <button type="button" class="ro-file-card__main" @click="toggleAssetActions(asset.id)">
                  <div class="ro-file-card__icon">
                    <i class="fa-regular fa-file-lines"></i>
                  </div>
                  <div class="ro-file-card__meta">
                    <div class="ro-file-card__name-row">
                      <strong>{{ asset.originalName }}</strong>
                      <span class="ro-file-badge">{{ getAssetBadge(asset) }}</span>
                    </div>
                    <span>{{ asset.fileSizeLabel }}</span>
                    <span v-if="asset.createdAtLabel">{{ asset.createdAtLabel }}</span>
                  </div>
                </button>

                <div v-if="activeAssetId === asset.id" class="ro-file-card__actions">
                  <button type="button" class="ro-file-card__action" @click="downloadAsset(asset)">
                    <i class="fa-solid fa-download"></i> 로컬에 저장
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <!-- 본문 콘텐츠 -->
        <div class="ro-content" v-html="renderedContent"></div>

      </div>

      <!-- ── 우측 플로팅 사이드바 (이미지 전용) ───────────────────────────── -->
      <aside v-if="hasAssets" class="ro-sidebar">
        <div class="ro-sidebar-panel">
          <div class="ro-sidebar-panel__header">
            <h3>첨부 파일</h3>
            <span class="ro-sidebar-panel__count">{{ workspaceAssets.length }}</span>
          </div>
          <div class="ro-sidebar-list">
            <article
              v-for="asset in workspaceAssets"
              :key="asset.id"
              class="ro-sidebar-item"
              :class="{ 'ro-sidebar-item--active': activeAssetId === asset.id }"
            >
              <button type="button" class="ro-sidebar-item__main" @click="toggleAssetActions(asset.id)">
                <div
                  class="ro-sidebar-item__icon"
                  :class="asset.assetType === 'IMAGE' ? 'ro-sidebar-item__icon--image' : 'ro-sidebar-item__icon--file'"
                >
                  <i :class="asset.assetType === 'IMAGE' ? 'fa-regular fa-image' : 'fa-regular fa-file-lines'"></i>
                </div>
                <div class="ro-sidebar-item__meta">
                  <div class="ro-sidebar-item__name-row">
                    <strong>{{ asset.originalName }}</strong>
                    <span class="ro-sidebar-item__badge">{{ getAssetBadge(asset) }}</span>
                  </div>
                  <span>{{ asset.fileSizeLabel }}</span>
                  <span v-if="asset.createdAtLabel">{{ asset.createdAtLabel }}</span>
                </div>
              </button>

              <div v-if="activeAssetId === asset.id" class="ro-sidebar-item__actions">
                <button
                  type="button"
                  class="ro-sidebar-item__action ro-sidebar-item__action--download"
                  @click.stop="downloadAsset(asset)"
                >
                  로컬에 저장
                </button>
              </div>
            </article>
          </div>
        </div>
      </aside>
    </template>
  </div>
</template>

<style scoped>
/* ── CSS 변수 (기존 워크스페이스와 동일) ─────────────────────────────────────── */
:root {
  --editor-bg: #ffffff;
  --editor-text: #1f2937;
  --editor-border: #e5e7eb;
  --editor-input-bg: #ffffff;
}
:global(html.dark) {
  --editor-bg: #1e1e1e;
  --editor-text: #e5e7eb;
  --editor-border: #333333;
  --editor-input-bg: #2d2d2d;
}

/* ── 레이아웃 ──────────────────────────────────────────────────────────────── */
.ro-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
  max-width: 1380px;
  margin: 24px auto;
  padding: 0 20px 40px;
}

/* ── 로딩 / 에러 상태 ────────────────────────────────────────────────────────── */
.ro-state-screen {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 40vh;
  color: #64748b;
  font-size: 15px;
}
.ro-state-screen--error { color: #dc2626; }
.ro-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--editor-border);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── 메인 쉘 ──────────────────────────────────────────────────────────────── */
.ro-shell {
  min-width: 0;
  background: var(--editor-bg);
  color: var(--editor-text);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  padding: 32px 36px 48px;
  transition: background 0.3s, color 0.3s;
}

/* ── 읽기 전용 배지 ─────────────────────────────────────────────────────────── */
.ro-badge-bar {
  margin-bottom: 20px;
}
.ro-readonly-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(245, 158, 11, 0.25);
  user-select: none;
}

/* ── 제목 ──────────────────────────────────────────────────────────────────── */
.ro-title {
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 800;
  line-height: 1.25;
  color: var(--editor-text);
  margin: 0 0 32px;
  word-break: break-word;
}

/* ── 첨부 파일 섹션 ─────────────────────────────────────────────────────────── */
.ro-assets-loading,
.ro-assets-error {
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 13px;
  margin-bottom: 28px;
}
.ro-assets-loading { background: rgba(37, 99, 235, 0.06); color: #64748b; }
.ro-assets-error { background: rgba(220, 38, 38, 0.06); color: #dc2626; }

.ro-assets {
  margin-bottom: 36px;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, var(--editor-bg) 97%, #eff6ff 3%);
}
.ro-assets__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.ro-assets__title {
  font-size: 14px;
  font-weight: 800;
  color: var(--editor-text);
}
.ro-assets__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
}
.ro-assets__group { margin-top: 16px; }
.ro-assets__group-label {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 10px;
}

/* ── 이미지 그리드 ──────────────────────────────────────────────────────────── */
.ro-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.ro-image-card {
  border-radius: 14px;
  border: 1px solid var(--editor-border);
  overflow: hidden;
  background: var(--editor-bg);
}
.ro-image-card__preview {
  display: block;
  aspect-ratio: 16 / 11;
  overflow: hidden;
}
.ro-image-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}
.ro-image-card:hover .ro-image-card__img { transform: scale(1.03); }
.ro-image-card__meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
}
.ro-image-card__meta strong { font-size: 12px; word-break: break-all; }
.ro-image-card__meta span { font-size: 11px; color: #64748b; }

/* ── 파일 목록 ──────────────────────────────────────────────────────────────── */
.ro-file-list { display: grid; gap: 10px; }
.ro-file-card {
  border: 1px solid var(--editor-border);
  border-radius: 14px;
  overflow: hidden;
  transition: border-color 0.15s;
}
.ro-file-card--active { border-color: rgba(37, 99, 235, 0.4); }
.ro-file-card__main {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--editor-text);
}
.ro-file-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}
.ro-file-card__meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.ro-file-card__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ro-file-card__name-row strong { font-size: 13px; word-break: break-all; flex: 1; min-width: 0; }
.ro-file-card__meta span { font-size: 12px; color: #64748b; }
.ro-file-badge {
  flex-shrink: 0;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 10px;
  font-weight: 700;
  color: #475569;
}
.ro-file-card__actions {
  padding: 0 14px 12px;
  display: flex;
  gap: 8px;
}
.ro-file-card__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

/* ── 본문 콘텐츠 렌더러 ──────────────────────────────────────────────────────── */
.ro-content {
  line-height: 1.75;
  color: var(--editor-text);
  font-size: 16px;
  word-break: break-word;
}

/* EditorJS 블록별 스타일 */
.ro-content :deep(.ro-heading) { font-weight: 700; line-height: 1.3; margin: 1.5em 0 0.5em; }
.ro-content :deep(.ro-heading--1) { font-size: 2em; }
.ro-content :deep(.ro-heading--2) { font-size: 1.6em; }
.ro-content :deep(.ro-heading--3) { font-size: 1.3em; }
.ro-content :deep(.ro-heading--4) { font-size: 1.1em; }
.ro-content :deep(.ro-heading--5),
.ro-content :deep(.ro-heading--6) { font-size: 1em; }

.ro-content :deep(.ro-paragraph) { margin: 0.75em 0; }

.ro-content :deep(.ro-list) { padding-left: 1.6em; margin: 0.75em 0; }
.ro-content :deep(.ro-list li) { margin: 0.3em 0; }
.ro-content :deep(.ro-list--ordered) { list-style: decimal; }
.ro-content :deep(.ro-list--unordered) { list-style: disc; }

.ro-content :deep(.ro-image-wrap) { margin: 1.5em 0; }
.ro-content :deep(.ro-image-wrap--border .ro-image) { border: 1px solid var(--editor-border); border-radius: 8px; }
.ro-content :deep(.ro-image-wrap--stretched .ro-image) { width: 100%; }
.ro-content :deep(.ro-image) { max-width: 100%; display: block; border-radius: 8px; }
.ro-content :deep(.ro-image-caption) { margin-top: 8px; font-size: 13px; color: #64748b; text-align: center; }

.ro-content :deep(.ro-delimiter) {
  border: none;
  border-top: 2px solid var(--editor-border);
  margin: 2em 0;
}

.ro-content :deep(.ro-quote) {
  border-left: 4px solid #2563eb;
  padding: 12px 18px;
  margin: 1.5em 0;
  background: rgba(37, 99, 235, 0.04);
  border-radius: 0 8px 8px 0;
}
.ro-content :deep(.ro-quote p) { margin: 0 0 6px; }
.ro-content :deep(.ro-quote cite) { font-size: 13px; color: #64748b; font-style: normal; }

.ro-content :deep(.ro-code) {
  background: color-mix(in srgb, var(--editor-bg) 85%, #0f172a 15%);
  border-radius: 10px;
  padding: 16px 18px;
  margin: 1em 0;
  overflow-x: auto;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.ro-content :deep(.ro-table-wrap) { overflow-x: auto; margin: 1.5em 0; }
.ro-content :deep(.ro-table) { border-collapse: collapse; width: 100%; font-size: 14px; }
.ro-content :deep(.ro-table td),
.ro-content :deep(.ro-table th) {
  border: 1px solid var(--editor-border);
  padding: 9px 12px;
  text-align: left;
}
.ro-content :deep(.ro-table th) { background: rgba(37, 99, 235, 0.06); font-weight: 700; }

.ro-content :deep(.ro-checklist) { list-style: none; padding: 0; margin: 0.75em 0; }
.ro-content :deep(.ro-checklist-item) {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.ro-content :deep(.ro-checklist-mark) {
  width: 18px;
  height: 18px;
  border: 2px solid #2563eb;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #2563eb;
  flex-shrink: 0;
}
.ro-content :deep(.ro-checklist-item--checked .ro-checklist-mark) {
  background: #2563eb;
  color: white;
}
.ro-content :deep(.ro-checklist-item--checked span:last-child) {
  text-decoration: line-through;
  color: #94a3b8;
}

/* ── 우측 사이드바 ──────────────────────────────────────────────────────────── */
.ro-sidebar {
  position: sticky;
  top: 24px;
}
.ro-sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100vh - 48px);
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, var(--editor-bg) 96%, #eff6ff 4%);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}
.ro-sidebar-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ro-sidebar-panel__header h3 { margin: 0; font-size: 15px; font-weight: 800; }
.ro-sidebar-panel__count {
  display: inline-flex;
  min-width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
}
.ro-sidebar-list {
  display: grid;
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
}
.ro-sidebar-item {
  border: 1px solid var(--editor-border);
  border-radius: 14px;
  background: var(--editor-input-bg);
  transition: border-color 0.15s;
}
.ro-sidebar-item--active { border-color: rgba(37, 99, 235, 0.38); }
.ro-sidebar-item__main {
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--editor-text);
}
.ro-sidebar-item__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}
.ro-sidebar-item__icon--image { background: rgba(14, 165, 233, 0.12); color: #0ea5e9; }
.ro-sidebar-item__icon--file { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
.ro-sidebar-item__meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.ro-sidebar-item__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ro-sidebar-item__name-row strong { flex: 1; min-width: 0; font-size: 12px; word-break: break-all; }
.ro-sidebar-item__meta span { font-size: 11px; color: #64748b; }
.ro-sidebar-item__badge {
  flex-shrink: 0;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 10px;
  font-weight: 700;
  color: #475569;
}
.ro-sidebar-item__actions {
  padding: 0 12px 12px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.ro-sidebar-item__action {
  border: none;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.ro-sidebar-item__action--download { background: rgba(37, 99, 235, 0.1); color: #1d4ed8; }

/* ── 반응형 ─────────────────────────────────────────────────────────────────── */
@media (max-width: 1100px) {
  .ro-layout { grid-template-columns: minmax(0, 1fr); }
  .ro-sidebar { position: static; }
  .ro-sidebar-panel { max-height: none; }
}

@media (max-width: 640px) {
  .ro-layout { padding: 0 12px 24px; }
  .ro-shell { padding: 20px 18px 36px; }
}
</style>
