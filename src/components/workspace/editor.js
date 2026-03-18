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

export async function initEditor(holderElement, room, initialData, idx, initialTitle, isCollaborative = false) {
  if (!holderElement) throw new Error('holderElement is required')

  const ydoc = new Y.Doc()
  let provider = null
  
  // type이 true일 때만 웹소켓 연결
  if (isCollaborative) {
    provider = new WebsocketProvider('ws://localhost:1234', room, ydoc)
  }
  
  const yMap = ydoc.getMap('workspace_data')
  const yTitle = ydoc.getText('title')
  const yPermissions = ydoc.getMap('permissions')

  if (provider) {
    provider.on('sync', (isSynced) => {
      if (isSynced && initialTitle && yTitle.toString() === '') {
        yTitle.insert(0, initialTitle)
      }
    })
  }

  const awareness = provider ? provider.awareness : null
  const remoteCursorsRef = ref({})
  const activeUsersRef = ref([])
  
  const colors = ['#FF6B6B','#6BCB77','#4D96FF','#FF7BD1','#FFD93D','#8E6BFF']
  const myId = Math.floor(Math.random() * colors.length)
  const myColor = colors[myId]

  let myName = `사용자 ${myId + 1}`
  const token = localStorage.getItem('ACCESS_TOKEN') 
  if (token) {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload)
      myName = payload.name || payload.username || payload.nickname || myName
    } catch (e) {
      console.warn('토큰에서 사용자 정보를 읽어오는데 실패했습니다.', e)
    }
  }

  if (awareness) {
    awareness.setLocalState({ user: { name: myName, color: myColor, clientId: ydoc.clientID } })
  }

  yPermissions.observe((event) => {
    if (yPermissions.get(String(ydoc.clientID)) === 'redirect') {
      window.location.href = '/workspace';
    }
  })

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

  if (awareness) {
    awareness.on('update', () => {
      const states = awareness.getStates();
      const remotes = {};
      const userList = [];

      states.forEach((state, clientId) => {
        if (!state || !state.user) return;
        
        userList.push({
          clientId: String(clientId),
          name: state.user.name,
          color: state.user.color,
          isMe: clientId === ydoc.clientID
        });

        if (clientId === ydoc.clientID) return;
        
        const mouse = state.mouse || {};
        if (mouse.x != null) {
          remotes[clientId] = {
            name: state.user.name,
            color: state.user.color,
            style: {
              position: 'absolute',
              left: `${mouse.x}%`, 
              top: `${mouse.y}%`,
              willChange: 'left, top',
              transition: 'none'
            }
          };
        }
      });
      remoteCursorsRef.value = remotes;
      activeUsersRef.value = userList;
    });
  }

  yMap.observe(() => {
    const newContents = yMap.get('contents')
    renderFromY(newContents)
  })

  let animationFrameId = null;

  function handleMouseMove(e) {
    if (animationFrameId || !awareness) return;

    animationFrameId = requestAnimationFrame(() => {
      const shell = holderElement.closest('.editor-shell');
      if (!shell) {
        animationFrameId = null;
        return;
      }

      const rect = shell.getBoundingClientRect();
      const xPercentage = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercentage = ((e.clientY - rect.top) / rect.height) * 100;

      awareness.setLocalStateField('mouse', { x: xPercentage, y: yPercentage });
      animationFrameId = null;
    });
  }

  // 협업 모드일 때만 마우스 트래킹 활성화
  if (isCollaborative) {
    window.addEventListener('mousemove', handleMouseMove)
  }

  function destroy() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('mousemove', handleMouseMove)
    try { 
      if (provider) {
        provider.disconnect()
        provider.destroy() 
      } 
    } catch (e) {}
    try { if (editor && typeof editor.destroy === 'function') editor.destroy() } catch (e) {}
    try { if (ydoc) ydoc.destroy() } catch (e) {}
  }
  window.__activeEditorDestroy = destroy;

  function updateUserPermission(clientId, status) {
    yPermissions.set(String(clientId), status);
  }

  return { 
    editor, 
    destroy, 
    remoteCursorsRef, 
    activeUsersRef, 
    updateUserPermission, 
    bindTitleRef, 
    updateTitleFromLocal, 
    savePost 
  }
}