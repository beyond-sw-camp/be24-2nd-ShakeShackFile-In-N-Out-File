<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { downloadFileAsset } from '@/api/filesApi'
import postApi from '@/api/postApi'
import { initEditor } from '@/components/workspace/editor'
import { useAuthStore } from '@/stores/useAuthStore'
import SockJS from 'sockjs-client'
import Stomp from 'stompjs'
import { SOCKET_BASE_URL } from '@/config/runtime'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const editorHolder = ref(null)
const editorApi = ref(null)
const title = ref('')
const isEditorLoading = ref(false)
const showUserList = ref(false)

const workspaceId = ref(null)
const workspaceAccessRole = ref('ADMIN')
const workspaceAssets = ref([])
const workspaceAssetLoading = ref(false)
const workspaceAssetUploading = ref(false)
const workspaceAssetError = ref('')
const deletingAssetIds = ref([])
const fileInput = ref(null)
const activeWorkspaceAssetId = ref(null)
const savingWorkspaceAssetIds = ref([])

const isValid = computed(() => title.value.trim().length > 0)
const remoteCursors = computed(() => editorApi.value?.remoteCursorsRef?.value || {})
const activeUsers = computed(() => editorApi.value?.activeUsersRef?.value || [])
const canManageAssets = computed(() => {
  if (!workspaceId.value) return true
  return ['ADMIN', 'WRITE'].includes(String(workspaceAccessRole.value || 'ADMIN').toUpperCase())
})
const workspaceImages = computed(() => workspaceAssets.value.filter((asset) => asset.assetType === 'IMAGE'))
const workspaceFiles = computed(() => workspaceAssets.value.filter((asset) => asset.assetType === 'FILE'))
const hasWorkspaceAssets = computed(() => workspaceAssets.value.length > 0)

let currentSetupId = 0
let workspaceAssetStompClient = null
let connectedWorkspaceAssetRoomId = null

const formatBytes = (bytes) => {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** unitIndex
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`
}

const formatDateTime = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const normalizeWorkspaceAsset = (asset = {}) => {
  return {
    id: asset.idx ?? asset.id ?? null,
    workspaceId: asset.workspaceIdx ?? asset.workspaceId ?? workspaceId.value,
    assetType: String(asset.assetType || 'FILE').toUpperCase(),
    originalName: asset.originalName || asset.fileOriginName || '이름 없는 파일',
    storedFileName: asset.storedFileName || asset.fileSaveName || '',
    objectFolder: asset.objectFolder || '',
    objectKey: asset.objectKey || asset.fileSavePath || '',
    contentType: asset.contentType || 'application/octet-stream',
    fileSize: Number(asset.fileSize || 0),
    previewUrl: asset.previewUrl || '',
    downloadUrl: asset.downloadUrl || asset.presignedDownloadUrl || '',
    createdAt: asset.createdAt || null,
    createdAtLabel: formatDateTime(asset.createdAt),
    fileSizeLabel: formatBytes(asset.fileSize),
  }
}

const syncTheme = () => {
  const savedTheme = localStorage.getItem('theme')
  const shouldUseDark =
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', shouldUseDark)
}

const mergeWorkspaceAssets = (nextAssets) => {
  const assetMap = new Map()
  ;[...nextAssets, ...workspaceAssets.value].forEach((asset) => {
    const normalized = normalizeWorkspaceAsset(asset)
    if (normalized.id != null) {
      assetMap.set(String(normalized.id), normalized)
    }
  })
  workspaceAssets.value = [...assetMap.values()].sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
}

const removeWorkspaceAssets = (assetIds) => {
  const deleteTargetSet = new Set((assetIds || []).map((assetId) => String(assetId)))
  if (!deleteTargetSet.size) return

  workspaceAssets.value = workspaceAssets.value.filter((asset) => !deleteTargetSet.has(String(asset.id)))
}

const handleWorkspaceAssetRealtimeEvent = (payload = {}) => {
  if (Number(payload.workspaceIdx || 0) !== Number(workspaceId.value || 0)) {
    return
  }

  if (payload.action === 'UPSERT') {
    mergeWorkspaceAssets(Array.isArray(payload.assets) ? payload.assets : [])
    return
  }

  if (payload.action === 'DELETE') {
    removeWorkspaceAssets(payload.assetIdxList)
    return
  }

  refreshWorkspaceAssets(workspaceId.value).catch(() => {})
}

const disconnectWorkspaceAssetRealtime = () => {
  connectedWorkspaceAssetRoomId = null

  if (!workspaceAssetStompClient) {
    return
  }

  try {
    workspaceAssetStompClient.disconnect(() => {})
  } catch (error) {
    console.error('Workspace asset realtime disconnect failed:', error)
  } finally {
    workspaceAssetStompClient = null
  }
}

const connectWorkspaceAssetRealtime = (targetWorkspaceId = workspaceId.value) => {
  const normalizedWorkspaceId = Number(targetWorkspaceId || 0)
  const accessToken = authStore.token || localStorage.getItem('ACCESS_TOKEN')

  if (!normalizedWorkspaceId || !accessToken) {
    disconnectWorkspaceAssetRealtime()
    return
  }

  if (
    workspaceAssetStompClient &&
    connectedWorkspaceAssetRoomId === normalizedWorkspaceId &&
    workspaceAssetStompClient.connected
  ) {
    return
  }

  disconnectWorkspaceAssetRealtime()

  const socket = new SockJS(SOCKET_BASE_URL)
  const stompClient = Stomp.over(socket)
  stompClient.debug = null

  workspaceAssetStompClient = stompClient
  stompClient.connect(
    { Authorization: `Bearer ${accessToken}` },
    () => {
      if (workspaceAssetStompClient !== stompClient) {
        stompClient.disconnect(() => {})
        return
      }

      connectedWorkspaceAssetRoomId = normalizedWorkspaceId
      stompClient.subscribe(`/sub/workspace/assets/${normalizedWorkspaceId}`, (message) => {
        try {
          const payload = JSON.parse(message.body)
          handleWorkspaceAssetRealtimeEvent(payload)
        } catch (error) {
          console.error('Workspace asset realtime payload parse failed:', error)
          refreshWorkspaceAssets(normalizedWorkspaceId).catch(() => {})
        }
      })
    },
    (error) => {
      if (workspaceAssetStompClient === stompClient) {
        console.error('Workspace asset realtime connection failed:', error)
      }
    },
  )
}

const refreshWorkspaceAssets = async (targetWorkspaceId = workspaceId.value) => {
  if (!targetWorkspaceId) {
    workspaceAssets.value = []
    workspaceAssetError.value = ''
    return []
  }

  workspaceAssetLoading.value = true
  workspaceAssetError.value = ''

  try {
    const result = await postApi.getWorkspaceAssets(targetWorkspaceId)
    workspaceAssets.value = (Array.isArray(result) ? result : []).map(normalizeWorkspaceAsset)
    return workspaceAssets.value
  } catch (error) {
    workspaceAssetError.value =
      error?.response?.data?.message ||
      error?.message ||
      '워크스페이스 첨부 파일을 불러오지 못했습니다.'
    workspaceAssets.value = []
    return []
  } finally {
    workspaceAssetLoading.value = false
  }
}

const handleSave = async () => {
  if (!editorApi.value?.savePost) return

  const response = await editorApi.value.savePost()
  const savedWorkspaceId = response?.result?.body?.idx ?? response?.data?.idx ?? response?.idx ?? null
  if (!savedWorkspaceId) return

  workspaceId.value = Number(savedWorkspaceId)
  workspaceAccessRole.value = 'ADMIN'
  router.push(`/workspace/read/${savedWorkspaceId}`)
}

const handlePermissionChange = (clientId, event) => {
  const newStatus = event.target.value
  if (editorApi.value?.updateUserPermission) {
    editorApi.value.updateUserPermission(clientId, newStatus)
    alert('권한 설정이 저장되었습니다.')
  }
}

watch(title, (newVal) => {
  if (editorApi.value?.updateTitleFromLocal) {
    editorApi.value.updateTitleFromLocal(newVal)
  }
})

watch(workspaceAssets, (assets) => {
  if (!assets.some((asset) => asset.id === activeWorkspaceAssetId.value)) {
    activeWorkspaceAssetId.value = null
  }
})

const prepareData = async () => {
  const id = route.params.id
  if (!id || route.path === '/workspace') {
    return {
      idx: null,
      title: '',
      contents: '',
      type: false,
      status: 'Private',
      uuid: '',
      accessRole: 'ADMIN',
    }
  }

  if (route.meta.initialData && String(route.meta.initialData.idx) === String(id)) {
    return route.meta.initialData
  }

  try {
    const response = await postApi.getPost(id)
    return response?.result?.body || response?.data || response
  } catch (error) {
    return {
      idx: Number(id),
      title: '',
      contents: '',
      type: false,
      status: 'Private',
      uuid: '',
      accessRole: 'READ',
    }
  }
}

const ensureWorkspacePersisted = async ({ navigate = false } = {}) => {
  if (workspaceId.value) {
    return workspaceId.value
  }

  if (!editorApi.value?.savePost) {
    throw new Error('워크스페이스를 먼저 저장할 수 없습니다.')
  }

  const response = await editorApi.value.savePost()
  const savedWorkspaceId = response?.result?.body?.idx ?? response?.data?.idx ?? response?.idx ?? null

  if (!savedWorkspaceId) {
    throw new Error('워크스페이스 저장에 실패했습니다.')
  }

  workspaceId.value = Number(savedWorkspaceId)
  workspaceAccessRole.value = 'ADMIN'

  if (navigate && String(route.params.id || '') !== String(savedWorkspaceId)) {
    await router.replace(`/workspace/read/${savedWorkspaceId}`)
  }

  return workspaceId.value
}

const uploadWorkspaceFiles = async (files, { autoPersist = true } = {}) => {
  const selectedFiles = Array.from(files || []).filter(Boolean)
  if (!selectedFiles.length) return []

  let targetWorkspaceId = workspaceId.value

  if (!targetWorkspaceId && autoPersist) {
    targetWorkspaceId = await ensureWorkspacePersisted({ navigate: false })
  }

  if (!targetWorkspaceId) {
    throw new Error('워크스페이스를 먼저 저장한 뒤 업로드해 주세요.')
  }

  workspaceAssetUploading.value = true
  workspaceAssetError.value = ''

  try {
    const uploaded = await postApi.uploadWorkspaceAssets(targetWorkspaceId, selectedFiles)
    const normalizedAssets = (Array.isArray(uploaded) ? uploaded : []).map(normalizeWorkspaceAsset)
    mergeWorkspaceAssets(normalizedAssets)
    if (normalizedAssets[0]?.id != null) {
      activeWorkspaceAssetId.value = normalizedAssets[0].id
    }
    return normalizedAssets
  } catch (error) {
    workspaceAssetError.value =
      error?.response?.data?.message ||
      error?.message ||
      '파일 업로드 중 오류가 발생했습니다.'
    throw error
  } finally {
    workspaceAssetUploading.value = false
  }
}

const handleEditorImageUpload = async (file) => {
  const uploadedAssets = await uploadWorkspaceFiles([file], { autoPersist: true })
  const uploadedImage = uploadedAssets.find((asset) => asset.assetType === 'IMAGE') || uploadedAssets[0]

  if (!uploadedImage?.previewUrl) {
    throw new Error('이미지 업로드 결과를 확인할 수 없습니다.')
  }

  return uploadedImage
}

const handleAssetSelection = async (event) => {
  const files = Array.from(event.target?.files || [])
  if (!files.length) return

  try {
    await uploadWorkspaceFiles(files, { autoPersist: true })
  } catch (error) {
    console.error('Workspace asset upload failed:', error)
  } finally {
    event.target.value = ''
  }
}

const triggerImageSelect = () => {
  if (!canManageAssets.value) return
}

const triggerFileSelect = () => {
  if (!canManageAssets.value) return
  fileInput.value?.click()
}

const toggleWorkspaceAssetActions = (assetId) => {
  if (assetId == null) return
  activeWorkspaceAssetId.value = activeWorkspaceAssetId.value === assetId ? null : assetId
}

const handleAssetDelete = async (asset) => {
  if (!asset?.id || !workspaceId.value || !canManageAssets.value) return

  deletingAssetIds.value = [...deletingAssetIds.value, asset.id]
  workspaceAssetError.value = ''

  try {
    await postApi.deleteWorkspaceAsset(workspaceId.value, asset.id)
    workspaceAssets.value = workspaceAssets.value.filter((item) => item.id !== asset.id)
    if (activeWorkspaceAssetId.value === asset.id) {
      activeWorkspaceAssetId.value = null
    }
  } catch (error) {
    workspaceAssetError.value =
      error?.response?.data?.message ||
      error?.message ||
      '첨부 파일을 삭제하지 못했습니다.'
  } finally {
    deletingAssetIds.value = deletingAssetIds.value.filter((id) => id !== asset.id)
  }
}

const isDeletingAsset = (assetId) => deletingAssetIds.value.includes(assetId)
const isSavingWorkspaceAsset = (assetId) => savingWorkspaceAssetIds.value.includes(assetId)

const saveWorkspaceAssetToDrive = async (asset) => {
  if (!asset?.id || !workspaceId.value) return

  savingWorkspaceAssetIds.value = [...savingWorkspaceAssetIds.value, asset.id]
  workspaceAssetError.value = ''

  try {
    await postApi.saveWorkspaceAssetToDrive(workspaceId.value, asset.id)
    window.alert('파일이 드라이브에 저장되었습니다.')
  } catch (error) {
    workspaceAssetError.value =
      error?.response?.data?.message ||
      error?.message ||
      '파일을 드라이브에 저장하지 못했습니다.'
  } finally {
    savingWorkspaceAssetIds.value = savingWorkspaceAssetIds.value.filter((id) => id !== asset.id)
  }
}

const downloadWorkspaceAsset = async (asset) => {
  if (!asset?.downloadUrl) return

  try {
    await downloadFileAsset(
      {
        presignedDownloadUrl: asset.downloadUrl,
        fileOriginName: asset.originalName,
      },
      asset.originalName,
    )
  } catch (error) {
    workspaceAssetError.value = '파일 다운로드에 실패했습니다.'
  }
}

const getWorkspaceAssetBadge = (asset) => {
  return asset?.assetType === 'IMAGE' ? '이미지' : '파일'
}

const setupEditor = async () => {
  const setupId = ++currentSetupId

  if (!editorHolder.value) return

  isEditorLoading.value = true
  const data = await prepareData()
  if (setupId !== currentSetupId) return

  title.value = data.title || ''
  workspaceId.value = data.idx ? Number(data.idx) : null
  workspaceAccessRole.value = data.accessRole || data.level || 'ADMIN'
  await refreshWorkspaceAssets(workspaceId.value)

  if (editorApi.value) {
    try {
      if (editorApi.value.editor?.isReady) {
        await editorApi.value.editor.isReady
      }
      await editorApi.value.destroy()
    } catch (error) {
      console.error('Editor destroy failed:', error)
    }
    editorApi.value = null
  }

  await nextTick()
  if (editorHolder.value) {
    editorHolder.value.innerHTML = ''
  }

  try {
    const newEditorApi = await initEditor(
      editorHolder.value,
      `notion-room-${data.idx ? data.idx : `new-${Date.now()}`}`,
      data.contents,
      data.idx ?? null,
      data.title,
      data.type,
      {
        uploadImage: handleEditorImageUpload,
      },
    )

    if (setupId !== currentSetupId) {
      if (newEditorApi.editor?.isReady) {
        await newEditorApi.editor.isReady
      }
      newEditorApi.destroy()
      return
    }

    editorApi.value = newEditorApi
    editorApi.value?.bindTitleRef?.(title)
  } catch (error) {
    console.error('에디터 초기화 실패:', error)
  } finally {
    if (setupId === currentSetupId) {
      isEditorLoading.value = false
    }
  }
}

const checkAndRedirectUuid = async () => {
  const uuid = route.query.uuid
  if (!route.path.includes('/invite') || !uuid) {
    return false
  }

  try {
    const response = await postApi.getPostByUuid(uuid)
    const data = response?.result?.body || response?.data || response

    if (data?.idx) {
      await router.replace({ name: 'workspace_read', params: { id: data.idx } })
      return true
    }
  } catch (error) {
    console.error('UUID redirect failed:', error)
  }

  await router.replace('/workspace')
  return true
}

onMounted(async () => {
  syncTheme()
  const redirected = await checkAndRedirectUuid()
  if (!redirected) {
    await setupEditor()
  }
})

watch(() => route.params.id, async () => {
  await setupEditor()
})

watch(() => route.path, async (newPath) => {
  if (newPath === '/workspace') {
    await setupEditor()
  }
})

watch(
  () => workspaceId.value,
  (nextWorkspaceId) => {
    connectWorkspaceAssetRealtime(nextWorkspaceId)
  },
  { immediate: true },
)

onBeforeUnmount(async () => {
  disconnectWorkspaceAssetRealtime()
  if (editorApi.value?.destroy) {
    if (editorApi.value.editor?.isReady) {
      await editorApi.value.editor.isReady
    }
    await editorApi.value.destroy()
  }
})
</script>

<template>
  <div class="workspace-layout">
    <div class="editor-shell">
    <div class="editor-header">
      <input v-model="title" placeholder="제목 없음" class="title-input" />

      <div class="user-presence-wrapper">
        <button class="presence-toggle-btn" @click="showUserList = !showUserList">
          <span class="user-count-badge">{{ activeUsers.length }}</span>
          참여자
        </button>

        <div v-if="showUserList" class="user-list-popover">
          <div class="popover-title">현재 참여 중인 사용자</div>
          <div class="user-item-list">
            <div v-for="user in activeUsers" :key="user.clientId" class="user-item">
              <div class="user-avatar" :style="{ background: user.color }">
                {{ user.name.charAt(0) }}
              </div>
              <div class="user-info">
                <div class="user-name">
                  {{ user.name }} <span v-if="user.isMe" class="me-tag">(나)</span>
                </div>
                <select
                  v-if="!user.isMe"
                  class="permission-select"
                  @change="handlePermissionChange(user.clientId, $event)"
                >
                  <option value="edit">편집 가능</option>
                  <option value="redirect">권한 회수</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button :disabled="!isValid" @click="handleSave" class="save-btn">저장</button>
    </div>

    <div class="workspace-assets">
      <div class="workspace-assets__header">
        <div>
          <p class="workspace-assets__summary workspace-assets__summary--plain">첨부 파일 {{ workspaceAssets.length }}개</p>
          <p class="workspace-assets__hint workspace-assets__hint--plain">
            업로드한 파일은 오른쪽 플로팅 목록에서 바로 저장하거나 확인할 수 있습니다.
          </p>
          <p class="workspace-assets__summary">
            이미지 {{ workspaceImages.length }}개 · 파일 {{ workspaceFiles.length }}개
          </p>
        </div>

        <div v-if="canManageAssets" class="workspace-assets__actions">
          <input ref="imageInput" type="file" accept="image/*" multiple hidden @change="handleAssetSelection" />
          <input ref="fileInput" type="file" multiple hidden @change="handleAssetSelection" />
          <button type="button" class="asset-action-btn" :disabled="workspaceAssetUploading" @click="triggerImageSelect">
            이미지 업로드
          </button>
          <button type="button" class="asset-action-btn asset-action-btn--secondary" :disabled="workspaceAssetUploading" @click="triggerFileSelect">
            파일 업로드
          </button>
        </div>
      </div>

      <p v-if="workspaceAssetError" class="workspace-assets__error">{{ workspaceAssetError }}</p>
      <p v-else-if="!workspaceId" class="workspace-assets__hint">처음 업로드할 때 워크스페이스가 먼저 저장됩니다.</p>

      <div v-if="workspaceAssetLoading" class="workspace-assets__loading">첨부 자산을 불러오는 중입니다...</div>

      <section v-if="workspaceImages.length > 0" class="workspace-assets__group">
        <div class="workspace-assets__group-header">
          <h4>이미지</h4>
        </div>
        <div class="workspace-image-grid">
          <article v-for="asset in workspaceImages" :key="asset.id" class="workspace-image-card">
            <button
              v-if="canManageAssets"
              type="button"
              class="asset-remove-btn"
              :disabled="isDeletingAsset(asset.id)"
              @click.stop="handleAssetDelete(asset)"
            >
              ×
            </button>
            <a :href="asset.previewUrl" target="_blank" rel="noopener noreferrer" class="workspace-image-card__preview">
              <img :src="asset.previewUrl" :alt="asset.originalName" class="workspace-image-card__image" />
            </a>
            <div class="workspace-image-card__meta">
              <strong>{{ asset.originalName }}</strong>
              <span>{{ asset.fileSizeLabel }}</span>
              <span v-if="asset.createdAtLabel">{{ asset.createdAtLabel }}</span>
            </div>
          </article>
        </div>
      </section>

      <section v-if="workspaceFiles.length > 0" class="workspace-assets__group">
        <div class="workspace-assets__group-header">
          <h4>파일</h4>
        </div>
        <div class="workspace-file-list">
          <article v-for="asset in workspaceFiles" :key="asset.id" class="workspace-file-card-wrap">
            <button
              v-if="canManageAssets"
              type="button"
              class="asset-remove-btn asset-remove-btn--file"
              :disabled="isDeletingAsset(asset.id)"
              @click.stop="handleAssetDelete(asset)"
            >
              ×
            </button>
            <button type="button" class="workspace-file-card" @click="downloadWorkspaceAsset(asset)">
              <div class="workspace-file-card__icon">
                <i class="fa-solid fa-file-arrow-down"></i>
              </div>
              <div class="workspace-file-card__meta">
                <strong>{{ asset.originalName }}</strong>
                <span>{{ asset.fileSizeLabel }}</span>
                <span v-if="asset.createdAtLabel">{{ asset.createdAtLabel }}</span>
              </div>
            </button>
          </article>
        </div>
      </section>

      <div v-if="!workspaceAssetLoading && workspaceImages.length === 0 && workspaceFiles.length === 0" class="workspace-assets__empty">
        업로드된 이미지나 파일이 없습니다.
      </div>
    </div>

    <div class="editor-body">
      <div v-if="isEditorLoading" class="loading-overlay">로딩 중...</div>
      <div ref="editorHolder" id="editor-holder" class="editor-holder"></div>
    </div>

    <div class="cursors-overlay" aria-hidden>
      <div v-for="(cursor, id) in remoteCursors" :key="id" class="remote-cursor" :style="cursor.style">
        <svg class="cursor-pointer" width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2L16 11L9 13L13 20L10 22L6 15L2 19V2Z" :fill="cursor.color" stroke="white" stroke-width="2" stroke-linejoin="round" />
        </svg>
        <div class="cursor-label" :style="{ background: cursor.color }">{{ cursor.name }}</div>
      </div>
    </div>

    </div>

    <aside class="workspace-floating-sidebar">
      <div class="workspace-floating-panel">
        <div class="workspace-floating-panel__header">
          <div>
            <h3>첨부 파일</h3>
          </div>
          <span class="workspace-floating-panel__count">{{ workspaceAssets.length }}</span>
        </div>

        <div v-if="workspaceAssetLoading" class="workspace-floating-panel__empty">
          첨부 파일을 불러오는 중입니다...
        </div>
        <div v-else-if="!hasWorkspaceAssets" class="workspace-floating-panel__empty">
          아직 첨부된 파일이 없습니다.
        </div>
        <div v-else class="workspace-floating-list">
          <article
            v-for="asset in workspaceAssets"
            :key="asset.id"
            class="workspace-floating-item"
            :class="{ 'workspace-floating-item--active': activeWorkspaceAssetId === asset.id }"
          >
            <button
              type="button"
              class="workspace-floating-item__main"
              @click="toggleWorkspaceAssetActions(asset.id)"
            >
              <div
                class="workspace-floating-item__icon"
                :class="asset.assetType === 'IMAGE' ? 'workspace-floating-item__icon--image' : 'workspace-floating-item__icon--file'"
              >
                <i :class="asset.assetType === 'IMAGE' ? 'fa-regular fa-image' : 'fa-regular fa-file-lines'"></i>
              </div>

              <div class="workspace-floating-item__meta">
                <div class="workspace-floating-item__title-row">
                  <strong>{{ asset.originalName }}</strong>
                  <span class="workspace-floating-item__badge">{{ getWorkspaceAssetBadge(asset) }}</span>
                </div>
                <span>{{ asset.fileSizeLabel }}</span>
                <span v-if="asset.createdAtLabel">{{ asset.createdAtLabel }}</span>
              </div>
            </button>

            <button
              v-if="canManageAssets"
              type="button"
              class="workspace-floating-item__remove"
              :disabled="isDeletingAsset(asset.id)"
              @click.stop="handleAssetDelete(asset)"
            >
              ×
            </button>

            <div v-if="activeWorkspaceAssetId === asset.id" class="workspace-floating-item__actions">
              <button
                type="button"
                class="workspace-floating-item__action workspace-floating-item__action--drive"
                :disabled="isSavingWorkspaceAsset(asset.id)"
                @click.stop="saveWorkspaceAssetToDrive(asset)"
              >
                {{ isSavingWorkspaceAsset(asset.id) ? '저장 중...' : '드라이브에 저장' }}
              </button>
              <button
                type="button"
                class="workspace-floating-item__action workspace-floating-item__action--download"
                @click.stop="downloadWorkspaceAsset(asset)"
              >
                로컬에 저장
              </button>
            </div>
          </article>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
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

.workspace-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
  max-width: 1380px;
  margin: 24px auto;
  padding: 0 20px 28px;
}

.editor-shell {
  position: relative;
  overflow: visible;
  min-width: 0;
  background: var(--editor-bg);
  color: var(--editor-text);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  transition: background 0.3s, color 0.3s;
}

.editor-header {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--editor-border);
}

.title-input {
  flex: 1;
  min-width: 0;
  font-size: 20px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--editor-border);
  background: var(--editor-input-bg);
  color: var(--editor-text);
}

.save-btn,
.asset-action-btn {
  padding: 9px 14px;
  background: #2563eb;
  color: white;
  border-radius: 10px;
  cursor: pointer;
  border: none;
  font-weight: 700;
}

.save-btn:disabled,
.asset-action-btn:disabled,
.workspace-floating-item__action:disabled,
.workspace-floating-item__remove:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.asset-action-btn--secondary {
  background: #0f172a;
}

.user-presence-wrapper {
  position: relative;
}

.presence-toggle-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--editor-input-bg);
  border: 1px solid var(--editor-border);
  border-radius: 10px;
  cursor: pointer;
  color: var(--editor-text);
  font-size: 14px;
}

.user-count-badge {
  background: #16a34a;
  color: white;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: bold;
}

.user-list-popover {
  position: absolute;
  top: 45px;
  right: 0;
  width: 260px;
  background: var(--editor-bg);
  border: 1px solid var(--editor-border);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 16px;
}

.popover-title {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
  font-weight: 600;
}

.user-item-list {
  display: grid;
  gap: 10px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 14px;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
}

.me-tag {
  font-size: 11px;
  color: #888;
}

.permission-select {
  display: block;
  width: 100%;
  margin-top: 4px;
  font-size: 11px;
  background: transparent;
  border: none;
  color: #2563eb;
  cursor: pointer;
}

.workspace-assets {
  padding: 20px;
  border-bottom: 1px solid var(--editor-border);
}

.workspace-assets__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.workspace-assets__title {
  font-size: 16px;
  font-weight: 800;
}

.workspace-assets__summary,
.workspace-assets__hint {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}

.workspace-assets__summary--plain,
.workspace-assets__hint--plain {
  display: block;
}

.workspace-assets__summary:not(.workspace-assets__summary--plain) {
  display: none;
}

.workspace-assets__hint--notice {
  margin-top: 12px;
}

.workspace-assets__hint:not(.workspace-assets__hint--plain) {
  font-size: 0;
}

.workspace-assets__hint:not(.workspace-assets__hint--plain)::before {
  content: "처음 파일을 추가하면 워크스페이스가 먼저 저장됩니다.";
  font-size: 13px;
}

.workspace-assets__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.workspace-assets__actions .asset-action-btn:first-of-type {
  display: none;
}

.workspace-assets__actions .asset-action-btn--secondary {
  font-size: 0;
}

.workspace-assets__actions .asset-action-btn--secondary::after {
  content: "파일 추가";
  font-size: 14px;
}

.workspace-assets__error {
  margin-top: 12px;
  color: #dc2626;
  font-size: 13px;
  font-weight: 600;
}

.workspace-assets__loading,
.workspace-assets__empty {
  margin-top: 16px;
  padding: 18px;
  border: 1px dashed var(--editor-border);
  border-radius: 14px;
  font-size: 13px;
  color: #64748b;
  text-align: center;
}

.workspace-assets__group,
.workspace-assets__empty {
  display: none;
}

.workspace-assets__loading {
  font-size: 0;
}

.workspace-assets__loading::before {
  content: "첨부 파일을 불러오는 중입니다...";
  font-size: 13px;
}

.workspace-assets__group-header {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
}

.workspace-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.workspace-image-card,
.workspace-file-card-wrap {
  position: relative;
}

.workspace-image-card {
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, var(--editor-bg) 96%, #eff6ff 4%);
}

.workspace-image-card__preview {
  display: block;
  aspect-ratio: 16 / 11;
  overflow: hidden;
}

.workspace-image-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.workspace-image-card__meta,
.workspace-file-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
}

.workspace-image-card__meta strong,
.workspace-file-card__meta strong {
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
}

.workspace-image-card__meta span,
.workspace-file-card__meta span {
  font-size: 12px;
  color: #64748b;
}

.workspace-file-list {
  display: grid;
  gap: 12px;
}

.workspace-file-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  border: 1px solid var(--editor-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--editor-bg) 97%, #f8fafc 3%);
  padding: 12px 14px;
  cursor: pointer;
}

.workspace-file-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

.asset-remove-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.72);
  color: white;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
}

.asset-remove-btn--file {
  top: 12px;
  right: 12px;
}

.asset-remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.workspace-floating-sidebar {
  position: sticky;
  top: 24px;
}

.workspace-floating-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 48px);
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--editor-border);
  background: color-mix(in srgb, var(--editor-bg) 96%, #eff6ff 4%);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.workspace-floating-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.workspace-floating-panel__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.workspace-floating-panel__header p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.workspace-floating-panel__count {
  display: inline-flex;
  min-width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-size: 13px;
  font-weight: 800;
}

.workspace-floating-panel__empty {
  padding: 18px 14px;
  border-radius: 14px;
  border: 1px dashed var(--editor-border);
  text-align: center;
  font-size: 13px;
  color: #64748b;
}

.workspace-floating-list {
  display: grid;
  gap: 12px;
  overflow-y: auto;
  min-height: 0;
  padding-right: 2px;
}

.workspace-floating-item {
  position: relative;
  border: 1px solid var(--editor-border);
  border-radius: 16px;
  background: var(--editor-input-bg);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.workspace-floating-item--active {
  border-color: rgba(37, 99, 235, 0.38);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.08);
}

.workspace-floating-item__main {
  display: flex;
  width: 100%;
  gap: 12px;
  padding: 14px 44px 14px 14px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
}

.workspace-floating-item__icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

.workspace-floating-item__icon--image {
  background: rgba(14, 165, 233, 0.12);
  color: #0ea5e9;
}

.workspace-floating-item__icon--file {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.workspace-floating-item__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.workspace-floating-item__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.workspace-floating-item__title-row strong {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.45;
  word-break: break-all;
}

.workspace-floating-item__meta span {
  font-size: 12px;
  color: #64748b;
}

.workspace-floating-item__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.08);
  color: #334155;
  font-size: 11px;
  font-weight: 700;
}

.workspace-floating-item__remove {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.72);
  color: white;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.workspace-floating-item__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 0 14px 14px;
}

.workspace-floating-item__action {
  border: none;
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.workspace-floating-item__action--drive {
  background: rgba(6, 182, 212, 0.14);
  color: #0f766e;
}

.workspace-floating-item__action--download {
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.editor-body {
  position: relative;
  min-height: 60vh;
  padding: 20px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.editor-holder {
  min-height: 48vh;
  border-radius: 12px;
  border: 1px solid var(--editor-border);
  padding: 18px;
  font-size: 16px;
  background: var(--editor-bg);
}

.cursors-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
}

.remote-cursor {
  position: absolute;
  display: flex;
  align-items: flex-start;
  transition: none !important;
  will-change: transform;
}

.cursor-pointer {
  position: absolute;
  top: -2px;
  left: -2px;
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3));
}

.cursor-label {
  color: white;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 12px;
  white-space: nowrap;
  margin-top: 18px;
  margin-left: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

:deep(.ce-block h1) {
  font-size: 40px !important;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .workspace-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .workspace-floating-sidebar {
    position: static;
  }

  .workspace-floating-panel {
    max-height: none;
  }
}

@media (max-width: 900px) {
  .editor-header,
  .workspace-assets__header {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-assets__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .workspace-layout {
    padding: 0 12px 20px;
  }

  .workspace-floating-item__actions {
    grid-template-columns: 1fr;
  }
}
</style>
