// useEditor.js
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

// Alignment tune and YouTube embed (community tools)
import AlignmentTuneTool from 'editorjs-text-alignment-blocktune'
import YouTubeEmbed from 'editorjs-youtube-embed'

// Yjs
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// Vue reactivity helpers
import { ref, reactive } from 'vue'
import postApi from '@/api/postApi'
import loadpost from './loadpost'

/**
 * initEditor(holderElement, room = 'default-room')
 */


// // 커스텀 명령어 확장 생성
// const Commands = Extension.create({
//   name: 'mention',
//   addOptions() {
//     return {
//       suggestion: {
//         char: '/',
//         command: ({ editor, range, props }) => {
//           props.command({ editor, range })
//         },
//       },
//     }
//   },
//   addProseMirrorPlugins() {
//     return [
//       Suggestion({
//         editor: this.editor,
//         ...this.options.suggestion,
//       }),
//     ]
//   },
// })

export async function initEditor(holderElement, room = 'default-room', initialData, idx) {
  if (!holderElement) throw new Error('holderElement is required')

  // Yjs setup
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider('ws://10.10.10.100:8080', room, ydoc)
  const yText = ydoc.getText('contents')
  const yTitle = ydoc.getText('title')

  // awareness presence
  const awareness = provider.awareness

  // remote cursors reactive store
  const remoteCursorsRef = ref({})

  // local user identity
  const colors = ['#FF6B6B','#6BCB77','#4D96FF','#FF7BD1','#FFD93D','#8E6BFF']
  const myId = Math.floor(Math.random() * colors.length)
  const myColor = colors[myId]
  const myName = `사용자 ${myId + 1}`

  awareness.setLocalState({ user: { name: myName, color: myColor } })

  const tools = {
    header: {
      class: Header,
      tunes: ['alignment'],
      config: { levels: [1,2,3,4], defaultLevel: 1 }
    },
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
    alignment: {
      class: AlignmentTuneTool,
      config: { default: 'left' }
    },
    youtube: {
      class: YouTubeEmbed
    }
  }

  let editor = null
  let suppressLocal = false

  // ⭐ 수정된 renderFromY: 안전장치 추가
  async function renderFromY(yval) {
    if (!editor) return
    if (!yval || yval === "") return // 빈 데이터면 렌더링 스킵
    
    try {
      // 에디터가 준비될 때까지 기다림 (TypeError: render of undefined 방지)
      await editor.isReady; 
      
      const parsed = JSON.parse(yval)
      // blocks가 유효한 배열인지 확인 (Incorrect data 방지)
      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        suppressLocal = true
        await editor.blocks.render(parsed.blocks)
        suppressLocal = false
      }
    } catch (e) {
      console.warn('failed to parse yval', e)
      suppressLocal = false
    }
  }
  // console.log(initialData);

  // Initialize EditorJS
  editor = new EditorJS({
    holder: holderElement,
    placeholder: '명령어 "/" 로 블록 추가',
    data: initialData || {},
    tools,
    onReady: async () => {
      const initial = yText.toString()
      if (initial) {
        await renderFromY(initial)
      }
    },
    onChange: async () => {
      if (suppressLocal) return
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

  // bindTitleRef (그대로 유지)
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

  // savePost (그대로 유지)
  async function savePost() {
  if (!editor) return;
  try {
    await editor.isReady;
    const savedData = await editor.save(); 

    console.log(idx);

    // FormData 대신 일반 객체(JSON) 생성
    const postData = {
      idx : idx ?? null,
      title: yTitle.toString(),
      contents: JSON.stringify(savedData)
    };

    /**
     * 수정 포인트:
     * 1. 토큰을 여기서 직접 가져올 필요가 없습니다. (인터셉터가 Pinia에서 꺼내서 넣어줌)
     * 2. fetch 문법({method, body}) 대신 위에서 정의한 서비스 함수를 사용합니다.
     */
    const response = await postApi.savePost(postData);
    await loadpost.side_list();

    // axios는 성공 시 데이터 자체를 반환하므로 바로 사용 가능합니다.
    console.log('저장 성공:', response);
    return response;
    
  } catch (e) {
    console.error('savePost error:', e);
  }
}

  // awareness listeners (그대로 유지)
  awareness.on('update', () => {
    const states = awareness.getStates()
    const remotes = {}
    states.forEach((state, clientId) => {
      if (!state || !state.user) return
      if (clientId === ydoc.clientID) return
      const mouse = state.mouse || {}
      const user = state.user || {}
      remotes[clientId] = {
        name: user.name || `user-${clientId}`,
        color: user.color || '#888',
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

  // yText observe (그대로 유지)
  yText.observe(event => {
    if (event.transaction.local) return 
    const val = yText.toString()
    renderFromY(val)
  })

  function handleMouseMove(e) {
    awareness.setLocalStateField('mouse', { x: e.clientX, y: e.clientY })
  }

  function reportSelection() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    let node = range.startContainer
    while (node && node !== holderElement) {
      if (node.classList && node.classList.contains('ce-block')) break
      node = node.parentNode
    }
    let blockIndex = null
    if (node && node !== holderElement) {
      const blocks = Array.from(holderElement.querySelectorAll('.ce-block'))
      blockIndex = blocks.indexOf(node)
    }
    awareness.setLocalStateField('selection', { blockIndex, offset: range.startOffset })
  }

  window.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('selectionchange', reportSelection)

  function destroy() {
    window.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('selectionchange', reportSelection)
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

  return {
    editor,
    destroy,
    remoteCursorsRef,
    bindTitleRef,
    updateTitleFromLocal,
    savePost
  }
}