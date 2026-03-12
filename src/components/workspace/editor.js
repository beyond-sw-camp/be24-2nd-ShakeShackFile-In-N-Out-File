// useEditor.js 수정본

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
import loadpost from './loadpost'

export async function initEditor(holderElement, room, initialData, idx, initialTitle) {
  if (!holderElement) throw new Error('holderElement is required')

  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider('ws://10.10.10.100:8080', room, ydoc)
  const yText = ydoc.getText('contents')
  const yTitle = ydoc.getText('title')

  if (initialTitle && yTitle.toString() === '') {
    yTitle.insert(0, initialTitle)
  }

  const awareness = provider.awareness
  const remoteCursorsRef = ref({})
  // 수정: {} -> [] (배열로 수정)
  const colors = ['#FF6B6B','#6BCB77','#4D96FF','#FF7BD1','#FFD93D','#8E6BFF']
  const myId = Math.floor(Math.random() * colors.length)
  // 수정: {} -> [] (배열 인덱스 접근)
  const myColor = colors[myId]
  const myName = `사용자 ${myId + 1}`

  awareness.setLocalState({ user: { name: myName, color: myColor } })

  const tools = {
    // 수정: tunes와 levels의 {} -> [] (배열로 수정)
    header: { class: Header, tunes: ['alignment'], config: { levels: [1,2,3,4], defaultLevel: 1 } },
    list: { class: List, inlineToolbar: true, tunes: ['alignment'] },
    quote: { class: Quote, inlineToolbar: true, tunes: ['alignment'] },
    table: { class: Table, inlineToolbar: true },
    code: { class: CodeTool },
    embed: { class: Embed, inlineToolbar: false },
    image: { class: ImageTool },
    linkTool: { class: LinkTool },
    inlineCode: { class: InlineCode },
    delimiter: Delimiter,
    marker: Marker,
    warning: Warning,
    alignment: { class: AlignmentTuneTool, config: { default: 'left' } },
    youtube: { class: YouTubeEmbed }
  }

  let editor = null
  let suppressLocal = false
  let isRendering = false // 렌더링 중복 방지 플래그

  async function renderFromY(yval) {
    if (!editor || !yval || isRendering) return
    
    try {
      await editor.isReady;
      
      // 현재 에디터 데이터와 수신된 데이터 비교 (중복 방지 핵심)
      const currentData = await editor.save();
      if (JSON.stringify(currentData) === yval) return;

      const parsed = JSON.parse(yval)
      if (parsed && Array.isArray(parsed.blocks)) {
        isRendering = true; 
        suppressLocal = true
        await editor.blocks.render(parsed.blocks)
        suppressLocal = false
        isRendering = false;
      }
    } catch (e) {
      console.warn('failed to parse yval', e)
      suppressLocal = false
      isRendering = false;
    }
  }

  let parsedData = { blocks: [] }; // 수정: {} -> [] (blocks는 보통 배열임)
  try {
    if (typeof initialData === 'string' && initialData.trim() !== '') {
      parsedData = JSON.parse(initialData);
    } else if (initialData && typeof initialData === 'object' && Object.keys(initialData).length > 0) {
      parsedData = initialData;
    }
  } catch (e) {
    console.warn('Data parsing failed', e);
  }

  editor = new EditorJS({
    holder: holderElement,
    placeholder: '명령어 "/" 로 블록 추가',
    data: parsedData,
    tools,
    onReady: async () => {
      // Yjs에 이미 서버 데이터가 있다면 그것을 우선 적용
      const initialY = yText.toString()
      if (initialY && initialY !== JSON.stringify(parsedData)) {
        await renderFromY(initialY)
      }
    },
    onChange: async () => {
      if (suppressLocal || isRendering) return
      try {
        const saved = await editor.save()
        const newString = JSON.stringify(saved)
        
        if (yText.toString() === newString) return

        ydoc.transact(() => {
          yText.delete(0, yText.length)
          yText.insert(0, newString)
        })
      } catch (err) {
        console.error('editor save failed', err)
      }
    }
  })

  await editor.isReady;

  function bindTitleRef(titleRef) {
    if (!titleRef) return
    const t0 = yTitle.toString()
    if (t0 && titleRef.value !== t0) titleRef.value = t0

    yTitle.observe(() => {
      const t = yTitle.toString()
      if (titleRef.value !== t) titleRef.value = t
    })

    titleRef.__updateOnLocal = (val) => {
      const current = yTitle.toString()
      if (current !== val) {
        ydoc.transact(() => {
          yTitle.delete(0, yTitle.length)
          yTitle.insert(0, val)
        })
      }
    }
  }

  async function savePost() {
    if (!editor) return;
    try {
      await editor.isReady;
      const savedData = await editor.save(); 

      const postData = {
        idx : idx ?? null,
        title: yTitle.toString(), 
        contents: JSON.stringify(savedData)
      };

      const response = await postApi.savePost(postData);
      await loadpost.side_list();
      return response;
    } catch (e) {
      console.error('savePost error:', e);
    }
  }

  awareness.on('update', () => {
    const states = awareness.getStates()
    const remotes = {}
    states.forEach((state, clientId) => {
      if (!state || !state.user || clientId === ydoc.clientID) return
      const mouse = state.mouse || {}
      const user = state.user || {}
      // 수정: {} -> [] (객체 속성 접근)
      remotes[clientId] = {
        name: user.name,
        color: user.color,
        style: {
          position: 'fixed',
          left: mouse.x ? `${mouse.x}px` : '-9999px',
          top: mouse.y ? `${mouse.y}px` : '-9999px',
          transform: 'translate(-50%, -120%)'
        }
      }
    })
    remoteCursorsRef.value = remotes
  })

  yText.observe(event => {
    if (event.transaction.local) return 
    renderFromY(yText.toString())
  })

  function handleMouseMove(e) {
    awareness.setLocalStateField('mouse', { x: e.clientX, y: e.clientY })
  }

  window.addEventListener('mousemove', handleMouseMove)

  function destroy() {
    window.removeEventListener('mousemove', handleMouseMove)
    try { editor?.destroy() } catch (e) {}
    try { provider?.destroy() } catch (e) {}
    try { ydoc?.destroy() } catch (e) {}
  }

  function updateTitleFromLocal(val) {
    const current = yTitle.toString()
    if (current !== val) {
      ydoc.transact(() => {
        yTitle.delete(0, yTitle.length)
        yTitle.insert(0, val)
      })
    }
  }

  return { editor, destroy, remoteCursorsRef, bindTitleRef, updateTitleFromLocal, savePost }
}