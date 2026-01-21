// editor.js
import { ref, onUnmounted, computed, watch, onMounted } from 'vue'
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

import postApi from '@/api/postApi'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const editor = ref(null)
const title = ref('')
const hasContent = ref(false)
const remoteMice = ref({})
const status = ref('connecting')

export function useEditorSocket() {
  let ydoc = null
  let provider = null

  // 랜덤 사용자 정보 생성
  const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D']
  const myColor = colors[Math.floor(Math.random() * colors.length)]
  const myName = `사용자 ${Math.floor(Math.random() * 10)}`

  const initEditor = (elementId, roomName = 'default-room') => {
    // 이미 에디터가 있다면 초기화 방지
    if (editor.value) return 

    const element = document.getElementById(elementId)
    if (!element) {
        console.error(`ID가 ${elementId}인 요소를 찾을 수 없습니다.`)
        return
    }

    // 1. Yjs 문서 생성
    ydoc = new Y.Doc()
    
    // 2. 웹소켓 프로바이더 연결
    provider = new WebsocketProvider(
      'http://localhost:1234', 
      roomName,
      ydoc
    )

    provider.on('status', (event) => {
      status.value = event.status
    })

    // 3. 에디터 생성 (확장 프로그램 순서 중요!)
    onMounted(() => {
    editor.value = new Editor({
      element: element,
      extensions: [
        // 협업 모드에서는 history: false 필수 (Yjs가 히스토리 관리)
        StarterKit.configure({
          history: false, 
        }),
        Placeholder.configure({
          placeholder: '내용을 입력하세요...',
        }),
        Highlight,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        // [중요] Collaboration이 반드시 Cursor보다 먼저 와야 함
        Collaboration.configure({
          document: ydoc,
        }),
        // [중요] Cursor 설정 시 provider와 awareness 모두 전달
        CollaborationCursor.configure({
          provider: provider,
          awareness: provider.awareness,
          user: {
            name: myName,
            color: myColor,
          },
        }),
      ],
      // 에디터 내용 변경 감지
      onUpdate({ editor: e }) {
        hasContent.value = !e.isEmpty
      },
      // 에디터 생성 직후 실행
      onCreate() {
        console.log('에디터가 성공적으로 생성되었습니다.')
      }
    })
    })

    // 제목 동기화 (Yjs Text 타입 사용)
    const yTitle = ydoc.getText('title')
    
    // 초기값 동기화
    if (yTitle.toString()) {
        title.value = yTitle.toString()
    }

    yTitle.observe(() => {
      if (title.value !== yTitle.toString()) {
        title.value = yTitle.toString()
      }
    })

    watch(title, (newVal) => {
      if (yTitle.toString() !== newVal) {
        ydoc.transact(() => {
          yTitle.delete(0, yTitle.length)
          yTitle.insert(0, newVal)
        })
      }
    })

    // 마우스 커서 위치 공유 (Awareness)
    const handleMouseMove = (e) => {
      // provider가 연결된 상태에서만 전송
      if (provider?.awareness) {
        provider.awareness.setLocalStateField('mouse', { 
          left: e.clientX, 
          top: e.clientY 
        })
        provider.awareness.setLocalStateField('user', {
          name: myName,
          color: myColor
        })
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    
    provider.awareness.on('update', () => {
      const states = provider.awareness.getStates()
      const mice = {}
      states.forEach((state, clientID) => {
        // 내 마우스는 제외하고 다른 사람만 표시
        if (clientID !== ydoc.clientID && state.mouse && state.user) {
          mice[clientID] = { ...state.mouse, ...state.user }
        }
      })
      remoteMice.value = mice
    })
  }

  onUnmounted(() => {
    // 메모리 누수 방지: 반드시 destroy 호출
    if (provider) provider.destroy()
    if (ydoc) ydoc.destroy()
    if (editor.value) editor.value.destroy()
  })

  return { initEditor, title, remoteMice, editor, status }
}

export function save() {
  const isFormValid = computed(() => title.value.trim().length > 0 && hasContent.value)
  
  const savePost = async () => {
    if (!isFormValid.value || !editor.value) return
    try {
      await postApi.savePost({
        title: title.value,
        content: JSON.stringify(editor.value.getJSON()),
        updatedAt: new Date().toISOString(),
      })
      alert('저장되었습니다!')
    } catch (err) { 
      console.error('저장 실패:', err) 
    }
  }
  return { isFormValid, savePost }
}