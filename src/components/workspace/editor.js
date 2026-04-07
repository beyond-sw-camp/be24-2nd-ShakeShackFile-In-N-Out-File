import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import Quote from '@editorjs/quote'
import Table from '@editorjs/table'
import CodeTool from '@editorjs/code'
import Embed from '@editorjs/embed'
import ImageTool from '@editorjs/image'
import LinkTool from '@editorjs/link'
import InlineCode from '@editorjs/inline-code'
import Delimiter from '@editorjs/delimiter'
import Marker from '@editorjs/marker'
import Warning from '@editorjs/warning'

import AlignmentTuneTool from 'editorjs-text-alignment-blocktune'
import YouTubeEmbed from 'editorjs-youtube-embed'

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

import { ref } from 'vue'
import postApi from '@/api/postApi'
import { getYjsWebsocketUrl } from '@/utils/yjsUrl'
import loadpost from './loadpost'

export async function initEditor(holderElement, room, initialData, idx, initialTitle, isPrivate, options = {}) {
  if (!holderElement) throw new Error('holderElement is required')

  const ydoc = new Y.Doc()
  let provider = null
  let currentIdx = idx ?? null

  if (!isPrivate) {
    provider = new WebsocketProvider(getYjsWebsocketUrl(), room, ydoc)
  }

  const yMap         = ydoc.getMap('workspace_data')
  const yTitle       = ydoc.getText('title')
  const yPermissions = ydoc.getMap('permissions')
  const LOCAL_EDIT_ORIGIN = Symbol('local-edit-origin')
  let hasSeededInitialTitle = false
  let hasSeededInitialContents = false

  let initialParsedData = { blocks: [] }
  try {
    if (typeof initialData === 'string' && initialData.trim() !== '' && initialData !== '""') {
      initialParsedData = JSON.parse(initialData)
    } else if (initialData && typeof initialData === 'object' && initialData.blocks) {
      initialParsedData = initialData
    }
  } catch (e) {
    console.warn('Initial data parsing failed', e)
  }

  const hasInitialBlocks = Array.isArray(initialParsedData.blocks) && initialParsedData.blocks.length > 0
  const initialContentsString = hasInitialBlocks ? JSON.stringify(initialParsedData) : ''

  const runLocalTransaction = (callback) => {
    ydoc.transact(callback, LOCAL_EDIT_ORIGIN)
  }

  const seedInitialTitleIfNeeded = () => {
    if (hasSeededInitialTitle) {
      return
    }

    hasSeededInitialTitle = true
    const fallbackTitle = String(initialTitle ?? '')
    if (!fallbackTitle || yTitle.toString() !== '') {
      return
    }

    runLocalTransaction(() => {
      yTitle.insert(0, fallbackTitle)
    })
  }

  const seedInitialContentsIfNeeded = () => {
    if (hasSeededInitialContents) {
      return
    }

    hasSeededInitialContents = true
    if (!initialContentsString || yMap.get('contents')) {
      return
    }

    runLocalTransaction(() => {
      yMap.set('contents', initialContentsString)
    })
  }

  if (provider) {
    provider.on('sync', (isSynced) => {
      if (!isSynced) return
      seedInitialTitleIfNeeded()
      seedInitialContentsIfNeeded()
    })
  } else {
    seedInitialTitleIfNeeded()
    seedInitialContentsIfNeeded()
  }

  const awareness        = provider ? provider.awareness : null
  const remoteCursorsRef = ref({})
  const activeUsersRef   = ref([])

  const colors = ['#FF6B6B', '#6BCB77', '#4D96FF', '#FF7BD1', '#FFD93D', '#8E6BFF']
  const myId    = Math.floor(Math.random() * colors.length)
  const myColor = colors[myId]

  let myName    = `사용자 ${myId + 1}`
  let myUserIdx = null
  const userRole = options?.userRole ?? 'READ'  // ✅ 옵션에서 역할 수신

  const token = localStorage.getItem('ACCESS_TOKEN')
  if (token) {
    try {
      const base64Url   = token.split('.')[1]
      const base64      = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      )
      const payload = JSON.parse(jsonPayload)
      myName    = payload.name || payload.username || payload.nickname || myName
      myUserIdx = payload.idx ?? null  // ✅ 백엔드 유저 ID 추출
    } catch (e) {
      console.warn('토큰에서 사용자 정보를 읽어오는데 실패했습니다.', e)
    }
  }

  // ─── awareness 업데이트 핸들러 ────────────────────────────────────────────
  function runAwarenessUpdate() {
    if (!awareness) return
    const states   = awareness.getStates()
    const remotes  = {}
    const userList = []

    states.forEach((state, clientId) => {
      if (!state || !state.user) return

      userList.push({
        clientId: String(clientId),
        name:     state.user.name,
        color:    state.user.color,
        isMe:     clientId === ydoc.clientID,
        role:     state.user.role    ?? 'READ',  // ✅ 역할
        userIdx:  state.user.userIdx ?? null,     // ✅ 백엔드 유저 ID
      })

      if (clientId === ydoc.clientID) return

      const mouse = state.mouse || {}
      if (mouse.x != null) {
        remotes[clientId] = {
          name:  state.user.name,
          color: state.user.color,
          style: {
            position:   'absolute',
            left:       `${mouse.x}%`,
            top:        `${mouse.y}%`,
            willChange: 'left, top',
            transition: 'none',
          },
        }
      }
    })

    remoteCursorsRef.value = remotes
    activeUsersRef.value   = userList
  }

  if (awareness) {
    awareness.on('update', runAwarenessUpdate)
    awareness.setLocalState({
      user: {
        name:     myName,
        color:    myColor,
        clientId: ydoc.clientID,
        role:     userRole,   // ✅ 역할 공유
        userIdx:  myUserIdx,  // ✅ 백엔드 유저 ID 공유
      },
    })
  }

  yPermissions.observe(() => {
    if (yPermissions.get(String(ydoc.clientID)) === 'redirect') {
      window.location.href = '/workspace'
    }
  })

  // ─── 이미지 업로드 설정 ────────────────────────────────────────────────────
  const trackedImageAssets = new Map()
  const imageToolConfig = {
    class: ImageTool,
    config: {
      uploader: {
        async uploadByFile(files) {
          try {
            if (!currentIdx) {
              await savePost()
              if (!currentIdx) throw new Error('게시물 생성에 실패하여 이미지를 업로드할 수 없습니다.')
            }
            const result = await postApi.uploadEditorJsImage(currentIdx, files)
            if (result?.file?.assetIdx) {
              trackedImageAssets.set(result.file.assetIdx, true)
            }
            return result
          } catch (e) {
            console.error('[Editor] 이미지 업로드 실패:', e)
            return { success: 0, message: e.message || '업로드 중 오류가 발생했습니다.' }
          }
        },
      },
    },
  }

  const tools = {
    header:     { class: Header, tunes: ['alignment'], config: { levels: [1, 2, 3, 4], defaultLevel: 1 } },
    list:       { class: List, inlineToolbar: true, tunes: ['alignment'] },
    quote:      { class: Quote, inlineToolbar: true, tunes: ['alignment'] },
    table:      { class: Table, inlineToolbar: true },
    code:       { class: CodeTool },
    embed:      { class: Embed, inlineToolbar: false },
    image:      imageToolConfig,
    linkTool:   { class: LinkTool },
    inlineCode: { class: InlineCode },
    delimiter:  Delimiter,
    marker:     Marker,
    warning:    Warning,
    alignment:  { class: AlignmentTuneTool, config: { default: 'left' } },
    youtube:    { class: YouTubeEmbed },
  }

  let editor                = null
  let suppressLocal         = false
  let isRendering           = false
  let previousImageAssets   = new Map()
  let pendingYVal           = null
  let remoteRenderInFlight  = false
  let localSyncTimer        = null
  let currentRenderedContents = ''
  let pendingLocalSnapshot  = null
  let titleObserver         = null

  const isDirtyRef = ref(false)

  const markDirty = () => {
    isDirtyRef.value = true
  }

  const markSaved = () => {
    isDirtyRef.value = false
  }

  const refreshImageAssetSnapshot = (blocks = []) => {
    previousImageAssets = new Map(
      (blocks || [])
        .filter(b => b.type === 'image' && b.data?.file?.assetIdx)
        .map(b => [b.data.file.assetIdx, true])
    )
  }

  const parseEditorSnapshot = (value) => {
    if (value == null || value === '') {
      return { blocks: [] }
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed || trimmed === '""') {
        return { blocks: [] }
      }

      try {
        const parsed = JSON.parse(trimmed)
        return parsed && typeof parsed === 'object' ? parsed : { blocks: [] }
      } catch (error) {
        console.warn('[YJS] failed to parse editor snapshot', error)
        return { blocks: [] }
      }
    }

    if (typeof value === 'object') {
      return value && typeof value === 'object' ? value : { blocks: [] }
    }

    return { blocks: [] }
  }

  const syncEditorToYjs = async (serializedSnapshot = null) => {
    if (suppressLocal || isRendering || !editor) {
      return
    }

    try {
      const newString =
        typeof serializedSnapshot === 'string'
          ? serializedSnapshot
          : JSON.stringify(await editor.save())
      if (yMap.get('contents') === newString) {
        currentRenderedContents = newString
        return
      }

      runLocalTransaction(() => {
        yMap.set('contents', newString)
      })

      currentRenderedContents = newString
    } catch (error) {
      console.error('[YJS] local editor sync failed', error)
    }
  }

  const scheduleLocalSync = (savedSnapshot = null) => {
    if (suppressLocal || isRendering) {
      return
    }

    if (savedSnapshot) {
      pendingLocalSnapshot = JSON.stringify(savedSnapshot)
    }

    clearTimeout(localSyncTimer)
    localSyncTimer = setTimeout(() => {
      const nextSnapshot = pendingLocalSnapshot
      pendingLocalSnapshot = null
      void syncEditorToYjs(nextSnapshot)
    }, 100)
  }
  // ─── 블록 단위 diff 적용 ──────────────────────────────────────────────────
  async function renderFromY(yval) {
    if (!yval || yval === '""' || yval === '') {
      return
    }

    if (!editor) {
      pendingYVal = yval
      return
    }

    if (isRendering || remoteRenderInFlight) {
      pendingYVal = yval
      return
    }

    const parsed = parseEditorSnapshot(yval)
    const serialized = JSON.stringify(parsed)

    if (!serialized || serialized === currentRenderedContents) {
      return
    }

    remoteRenderInFlight = true
    isRendering = true
    suppressLocal = true

    try {
      await editor.isReady
      await editor.render(parsed)
      currentRenderedContents = serialized
      refreshImageAssetSnapshot(parsed.blocks || [])
    } catch (error) {
      console.warn('[YJS] remote render failed', error)
    } finally {
      setTimeout(() => {
        suppressLocal = false
        isRendering = false
        remoteRenderInFlight = false

        if (!pendingYVal) {
          return
        }

        const nextYVal = pendingYVal
        pendingYVal = null
        if (nextYVal !== yval) {
          void renderFromY(nextYVal).catch((error) => {
            console.warn('[YJS] pending remote render flush failed', error)
          })
        }
      }, 50)
    }
  }

  const flushPendingRender = async () => {
    if (isRendering || remoteRenderInFlight || !pendingYVal) {
      return
    }

    const nextYVal = pendingYVal
    pendingYVal = null
    await renderFromY(nextYVal)
  }

  // ─── 초기 데이터 파싱 ─────────────────────────────────────────────────────
  let parsedData = { blocks: [] }
  try {
    if (typeof initialData === 'string' && initialData.trim() !== '' && initialData !== '""') {
      parsedData = JSON.parse(initialData)
    } else if (initialData && typeof initialData === 'object' && initialData.blocks) {
      parsedData = initialData
    }
  } catch (e) {
    console.warn('Initial data parsing failed', e)
  }
  currentRenderedContents = JSON.stringify(parsedData)

  // ─── EditorJS 인스턴스 ────────────────────────────────────────────────────
  editor = new EditorJS({
    holder:      holderElement,
    placeholder: '명령어 "/" 로 블록 추가',
    data:        parsedData,
    tools,
    onReady: async () => {
      const initialY = yMap.get('contents')
      if (initialY) {
        await renderFromY(initialY)
      } else if (!provider && hasInitialBlocks) {
        runLocalTransaction(() => {
          yMap.set('contents', initialContentsString)
        })
      }

      const initialSaved = await editor.save()
      refreshImageAssetSnapshot(initialSaved.blocks)
      currentRenderedContents = JSON.stringify(initialSaved)
      await flushPendingRender()
    },
    onChange: async () => {
      if (suppressLocal || isRendering) return
      markDirty()
      try {
        const saved = await editor.save()

        const currentImageAssets = new Map()
        saved.blocks
          .filter(b => b.type === 'image' && b.data?.file?.assetIdx)
          .forEach(b => currentImageAssets.set(b.data.file.assetIdx, true))

        for (const assetIdx of previousImageAssets.keys()) {
          if (!currentImageAssets.has(assetIdx) && currentIdx) {
            postApi.deleteEditorJsImage(currentIdx, assetIdx).catch(e =>
              console.warn('[Editor] 이미지 삭제 실패:', assetIdx, e)
            )
          }
        }

        previousImageAssets = currentImageAssets

        scheduleLocalSync(saved)
      } catch (err) {
        console.error('editor save failed', err)
      }
    },
  })

  await editor.isReady

  // ─── 타이틀 바인딩 ────────────────────────────────────────────────────────
  function bindTitleRef(titleRef) {
    if (!titleRef) return
    const current = yTitle.toString()
    if (current && titleRef.value !== current) {
      titleRef.value = current
    }

    const observer = (event) => {
      if (event?.transaction?.origin === LOCAL_EDIT_ORIGIN) return
      const t = yTitle.toString()
      if (titleRef.value !== t) titleRef.value = t
    }

    if (titleObserver) {
      yTitle.unobserve(titleObserver)
    }
    titleObserver = observer
    yTitle.observe(titleObserver)
  }

  function updateTitleFromLocal(val) {
    const nextTitle = String(val ?? '')
    const current = yTitle.toString()
    if (current !== nextTitle) {
      runLocalTransaction(() => {
        yTitle.delete(0, yTitle.length)
        if (nextTitle) {
          yTitle.insert(0, nextTitle)
        }
      })
    }
  }

  // ─── 저장 ─────────────────────────────────────────────────────────────────
  async function savePost() {
    if (!editor) return
    try {
      await editor.isReady
      const savedData     = await editor.save()
      const resolvedTitle = yTitle.toString().trim() || (initialTitle ?? '').trim() || '제목 없음'
      const postData      = { idx: currentIdx, title: resolvedTitle, contents: JSON.stringify(savedData) }
      const response      = await postApi.savePost(postData)
      const savedIdx      = response?.idx ?? null
      if (savedIdx != null) currentIdx = savedIdx
      await loadpost.side_list()
      markSaved()
      return response
    } catch (e) {
      console.error('savePost error:', e)
    }
  }

  // ─── Y.js 콘텐츠 변경 감지 ────────────────────────────────────────────────
  yMap.observe((event) => {
    if (event?.transaction?.origin === LOCAL_EDIT_ORIGIN) return
    const newContents = yMap.get('contents')
    void renderFromY(newContents)
  })

  // ─── 마우스 커서 트래킹 ────────────────────────────────────────────────────
  let animationFrameId = null

  function handleMouseMove(e) {
    if (animationFrameId || !awareness) return
    animationFrameId = requestAnimationFrame(() => {
      const shell = holderElement.closest('.editor-shell')
      if (!shell) { animationFrameId = null; return }
      const rect        = shell.getBoundingClientRect()
      const xPercentage = ((e.clientX - rect.left) / rect.width)  * 100
      const yPercentage = ((e.clientY - rect.top)  / rect.height) * 100
      awareness.setLocalStateField('mouse', { x: xPercentage, y: yPercentage })
      animationFrameId = null
    })
  }

  if (!isPrivate) {
    window.addEventListener('mousemove', handleMouseMove)
  }

  function updateUserPermission(clientId, status) {
    yPermissions.set(String(clientId), status)
  }

  // ─── 정리 ─────────────────────────────────────────────────────────────────
  function destroy() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    window.removeEventListener('mousemove', handleMouseMove)
    clearTimeout(localSyncTimer)
    if (titleObserver) {
      yTitle.unobserve(titleObserver)
      titleObserver = null
    }
    try { if (provider) { provider.disconnect(); provider.destroy() } } catch (e) {}
    try { if (editor && typeof editor.destroy === 'function') editor.destroy() } catch (e) {}
    try { if (ydoc) ydoc.destroy() } catch (e) {}
  }
  window.__activeEditorDestroy = destroy

  return {
    editor,
    destroy,
    remoteCursorsRef,
    activeUsersRef,
    isDirtyRef,
    updateUserPermission,
    bindTitleRef,
    updateTitleFromLocal,
    savePost,
    markDirty,
    markSaved,
  }
}
