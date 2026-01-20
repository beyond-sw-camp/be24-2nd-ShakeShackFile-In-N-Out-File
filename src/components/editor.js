import { ref, onUnmounted, computed, watch } from 'vue'
import Quill from 'quill'
import postApi from '@/api/postApi'
import QuillCursors from 'quill-cursors'
import * as Y from 'yjs'
import { QuillBinding } from 'y-quill'
import { WebsocketProvider } from 'y-websocket'

// Quill 모듈 등록
Quill.register('modules/cursors', QuillCursors)

// [공유 상태] 컴포저블 간 데이터 공유를 위해 최상단에 선언
let quill = null
const title = ref('') 
const hasContent = ref(false) 
const remoteMice = ref({})

export function useEditorSocket() {
  let ydoc = null
  let provider = null

  // 사용자 색상 팔레트
  const colorPalette = [
    '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF',
    '#4B0082', '#8B00FF', '#FF1493', '#00CED1', '#ADFF2F',
  ]

  // 랜덤 사용자 설정 (아이디/색상/이름)
  const myNumber = Math.floor(Math.random() * 10) 
  const myColor = colorPalette[myNumber]
  const myName = `사용자 ${myNumber + 1}`

  // 마우스 이동 이벤트 핸들러 (unmounted 시 제거를 위해 별도 선언)
  const handleMouseMove = (e) => {
    if (provider?.awareness) {
      provider.awareness.setLocalStateField('mouse', {
        left: e.clientX,
        top: e.clientY,
      })
    }
  }

  const initEditor = (elementId, roomName = 'default-room') => {
    if (!roomName) roomName = 'default-room'

    ydoc = new Y.Doc()
    provider = new WebsocketProvider(
      'wss://cheeseduck.kro.kr', 
      roomName,
      ydoc,
    )

    // 1. Quill 초기화
    quill = new Quill(elementId, {
      theme: 'snow',
      placeholder: '내용을 입력하세요...',
      modules: {
        cursors: true,
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ header: 1 }, { header: 2 }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          ['link', 'image', 'video'],
          ['clean'],
        ],
      },
    })

    // 2. [저장 버튼 로직] 본문 내용 변화 감지 (한 글자라도 있으면 true)
    quill.on('text-change', () => {
      const text = quill.getText().trim()
      hasContent.value = text.length > 0
    })

    // 3. Yjs-Quill 자동 동기화 바인딩
    const ytext = ydoc.getText('quill')
    new QuillBinding(ytext, quill, provider.awareness)

    // 4. 제목 실시간 동기화 (Yjs 관찰)
    const yTitle = ydoc.getText('title')
    yTitle.observe(() => {
      if (title.value !== yTitle.toString()) title.value = yTitle.toString()
    })
    watch(title, (newVal) => {
      if (yTitle.toString() !== newVal) {
        ydoc.transact(() => {
          yTitle.delete(0, yTitle.length)
          yTitle.insert(0, newVal)
        })
      }
    })

    // 5. [마우스 커서 로직] 내 정보 설정 및 이벤트 등록
    provider.awareness.setLocalStateField('user', {
      name: myName,
      color: myColor,
    })

    window.addEventListener('mousemove', handleMouseMove)

    // 6. [마우스 커서 로직] 다른 사용자 정보 수집
    provider.awareness.on('update', () => {
      const states = provider.awareness.getStates()
      const mice = {}
      states.forEach((state, clientID) => {
        // 내 마우스가 아니고, 위치 정보와 사용자 정보가 모두 있을 때만 추가
        if (clientID !== ydoc.clientID && state.mouse && state.user) {
          mice[clientID] = {
            left: state.mouse.left,
            top: state.mouse.top,
            name: state.user.name,
            color: state.user.color
          }
        }
      })
      remoteMice.value = mice
    })
  }

  // 컴포넌트 언마운트 시 소켓 및 이벤트 정리
  onUnmounted(() => {
    window.removeEventListener('mousemove', handleMouseMove)
    // [핵심 수정] 나갈 때 내 상태를 null로 만들어 다른 사람에게 알림
    if (provider?.awareness) {
        provider.awareness.setLocalState(null)
    }
    if (provider) provider.destroy()
    if (ydoc) ydoc.destroy
  })

  return {
    initEditor,
    title,
    remoteMice,
  }
}

export function save() {
  // [저장 버튼 로직] 제목과 본문이 모두 존재할 때만 활성화
  const isFormValid = computed(() => {
    return title.value.trim().length > 0 && hasContent.value
  })

  const savePost = async () => {
    // 버튼이 비활성 상태일 때는 실행 방지
    if (!isFormValid.value) return

    const payload = {
      title: title.value,
      content: JSON.stringify(quill.getContents()),
      updatedAt: new Date().toISOString(),
    }

    try {
      await postApi.savePost(payload)
      alert('저장되었습니다!')
    } catch (err) {
      console.error('저장 실패:', err)
    }
  }

  return {
    isFormValid,
    savePost,
  }
}