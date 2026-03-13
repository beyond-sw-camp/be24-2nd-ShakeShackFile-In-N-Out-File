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
  const provider = new WebsocketProvider('ws://localhost:1234', room, ydoc)
  
  const yMap = ydoc.getMap('workspace_data')
  const yTitle = ydoc.getText('title')

  provider.on('sync', (isSynced) => {
    if (isSynced && initialTitle && yTitle.toString() === '') {
      yTitle.insert(0, initialTitle)
    }
  })

  const awareness = provider.awareness
  const remoteCursorsRef = ref({})
  
  const colors = ['#FF6B6B','#6BCB77','#4D96FF','#FF7BD1','#FFD93D','#8E6BFF']
  const myId = Math.floor(Math.random() * colors.length)
  const myColor = colors[myId]

 // ✨ 수정: 토큰의 'name' 키를 참조하고 한글 깨짐 방지 로직 추가
  let myName = `사용자 ${myId + 1}`
  const token = localStorage.getItem('ACCESS_TOKEN') 
  if (token) {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      
      // 한글(유니코드) 깨짐 방지를 위한 디코딩 처리
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload)
      
      // 보내주신 페이로드 구조에 맞춰 payload.name을 최우선으로 가져옵니다.
      myName = payload.name || payload.username || payload.nickname || myName
      console.log(myName);
    } catch (e) {
      console.warn('토큰에서 사용자 정보를 읽어오는데 실패했습니다.', e)
    }
  }

  awareness.setLocalState({ user: { name: myName, color: myColor } })

  awareness.setLocalState({ user: { name: myName, color: myColor } })

  const tools = {
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
  let isRendering = false 

  async function renderFromY(yval) {
    if (!editor || isRendering) return
    if (!yval || yval === '""' || yval === '') return;

    try {
      await editor.isReady;
      const parsed = JSON.parse(yval)
      if (parsed && Array.isArray(parsed.blocks)) {
        const currentData = await editor.save();
        if (JSON.stringify(currentData.blocks) === JSON.stringify(parsed.blocks)) return;

        isRendering = true; 
        suppressLocal = true;
        await editor.render(parsed);
        
        setTimeout(() => {
          suppressLocal = false;
          isRendering = false;
        }, 100);
      }
    } catch (e) {
      console.warn('failed to parse yval', e)
      suppressLocal = false
      isRendering = false;
    }
  }

  let parsedData = { blocks: [] }; 
  try {
    if (typeof initialData === 'string' && initialData.trim() !== '' && initialData !== '""') {
      parsedData = JSON.parse(initialData);
    } else if (initialData && typeof initialData === 'object' && initialData.blocks) {
      parsedData = initialData;
    }
  } catch (e) {
    console.warn('Initial data parsing failed', e);
  }

  editor = new EditorJS({
    holder: holderElement,
    placeholder: '명령어 "/" 로 블록 추가',
    data: parsedData,
    tools,
    onReady: async () => {
      const initialY = yMap.get('contents')
      if (initialY) {
        await renderFromY(initialY)
      } else if (parsedData.blocks && parsedData.blocks.length > 0) {
        yMap.set('contents', JSON.stringify(parsedData))
      }
    },
    onChange: async () => {
      if (suppressLocal || isRendering) return
      try {
        const saved = await editor.save()
        if (saved.blocks.length === 0) return;
        const newString = JSON.stringify(saved)
        if (yMap.get('contents') === newString) return
        ydoc.transact(() => {
          yMap.set('contents', newString)
        })
      } catch (err) {
        console.error('editor save failed', err)
      }
    }
  })

  await editor.isReady;

  function bindTitleRef(titleRef) {
    if (!titleRef) return
    yTitle.observe(() => {
      const t = yTitle.toString()
      if (titleRef.value !== t) titleRef.value = t
    })
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
      remotes[clientId] = {
        name: user.name,
        color: user.color,
        style: {
          position: 'fixed',
          left: mouse.x ? `${mouse.x}px` : '-9999px',
          top: mouse.y ? `${mouse.y}px` : '-9999px',
        }
      }
    })
    remoteCursorsRef.value = remotes
  })

  yMap.observe(() => {
    const newContents = yMap.get('contents')
    renderFromY(newContents)
  })

  function handleMouseMove(e) {
    awareness.setLocalStateField('mouse', { x: e.clientX, y: e.clientY })
  }

  window.addEventListener('mousemove', handleMouseMove)

  function destroy() {
    // 1. 마우스 이벤트 즉시 제거
    window.removeEventListener('mousemove', handleMouseMove)
    
    // 2. 웹소켓 연결을 즉시 물리적으로 끊음 (가장 중요)
    try { 
      if (provider) {
        provider.disconnect() // 연결 먼저 끊기
        provider.destroy() 
      } 
    } catch (e) {}

    // 3. 에디터 및 문서 객체 정리
    try { if (editor && typeof editor.destroy === 'function') editor.destroy() } catch (e) {}
    try { if (ydoc) ydoc.destroy() } catch (e) {}
    
    console.log(`Room ${room} 연결이 종료되었습니다.`);
  }
  window.__activeEditorDestroy = destroy;

  return { editor, destroy, remoteCursorsRef, bindTitleRef, updateTitleFromLocal, savePost }
}