<script setup>
import { ref, onMounted } from 'vue'
import { computed } from 'vue'
import ChatRoom from './ChatRoom.vue'
import ChatList from './Chatlist.vue'
import {useAuthStore} from '@/stores/useAuthStore'
import api from '@/plugins/axiosinterceptor.js' // axios 인스턴스 임포트

const props = defineProps({ isOpen: Boolean })
const emit = defineEmits(['close'])

// 너비 조절을 위한 상태값
const DEFAULT_WIDTH = 320; // 처음 크기 (20rem)
const chatWidth = ref(320) // 기본값 20rem (320px)
const isResizing = ref(false)

// 드래그 시작 함수
const startResizing = (event) => {
  isResizing.value = true
  // 마우스 이동 및 버튼 뗌 감지 이벤트 등록
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', stopResizing)
  // 드래그 중 텍스트 선택 방지
  document.body.style.userSelect = 'none'
}

// 마우스 이동 시 너비 계산
const handleMouseMove = (event) => {
  if (!isResizing.value) return

  // 오른쪽 사이드바인 경우: 브라우저 전체 너비 - 마우스 X 좌표
  // (마우스를 왼쪽으로 끌수록 너비가 커짐)
  const newWidth = window.innerWidth - event.clientX
  
  // 최소/최대 너비 제한 (250px ~ 600px)
  if (newWidth > 80 && newWidth < 600) {
    chatWidth.value = newWidth
  }
}

// 드래그 종료 함수
const stopResizing = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', stopResizing)
  document.body.style.userSelect = 'auto'
}

const viewMode = ref('list')
const selectedRoom = ref(null)
const authStore = useAuthStore()

const currentUser = computed(() => ({ 
  name: authStore.user?.userName || 'Guest',
}))

const chatRooms = ref([])
const fetchRooms = async () => {
  try {
    const response = await api.api.get('/json/chat/chathistory.json')
    const allData = response.data 

    // JSON의 Key(room-1, room-2 등)를 순회
    chatRooms.value = Object.keys(allData).map(roomId => {
      const roomData = allData[roomId] // 방 정보 객체 { name, icon, messages }
      const messages = roomData.messages || []
      const lastMessage = messages[messages.length - 1]

      return {
        id: roomId,
        name: roomData.name, // JSON에 있는 이름을 그대로 사용
        icon: roomData.icon || 'fa-comments', // JSON에 있는 아이콘 사용
        lastMsg: lastMessage ? lastMessage.text : '메시지가 없습니다.',
        count: messages.length,
        time: lastMessage ? lastMessage.time : ''
      }
    })
  } catch (error) {
    console.error('방 목록 로드 실패:', error)
  }
}
onMounted(() => {
  fetchRooms()
})

const handleSelectRoom = (room) => {
  selectedRoom.value = room
  viewMode.value = 'room'
}
</script>

<template>
  <aside 
    class="chat-panel" 
    :class="isOpen ? 'chat-panel-open' : 'chat-panel-closed'"
    :style="isOpen ? { width: chatWidth + 'px' } : {}"
  >
    <div 
      v-if="isOpen"
      class="resizer" 
      @mousedown="startResizing"
      :class="{ 'is-resizing': isResizing }"
    ></div>
    <div class="chat-header">
      <div class="flex items-center gap-2">
        <button
          v-if="viewMode === 'room'"
          @click="viewMode = 'list'"
          class="back-button"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="chat-title">
          {{ viewMode === 'list' ? '채팅 목록' : selectedRoom.name }}
        </span>
      </div>
      <button @click="emit('close')" class="close-button">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <ChatList v-if="viewMode === 'list'" :rooms="chatRooms" @select-room="handleSelectRoom" />
    <ChatRoom v-else :room="selectedRoom" :currentUser="currentUser" @back="viewMode = 'list'" />
  </aside>
</template>

<style scoped>
.chat-panel {
  position: relative; /* 핸들 배치를 위해 필수 */
  background-color: var(--bg-main);
  border-left: 1px solid var(--border-color);
  transition: width 0.3s ease; /* 너비 조절 시 부드럽게 (단, 드래그 중에는 transition을 끄는 게 좋습니다) */
  overflow: visible; /* 핸들이 밖으로 살짝 나가야 하므로 visible */
  display: flex;
  flex-direction: column;
  z-index: 40;
}

.chat-panel[style*="width"] {
  transition: none;
}

.chat-panel-closed {
  width: 0 !important;
  border-left: none;
}

/* 리사이저 핸들 스타일 */
.resizer {
  position: absolute;
  left: -3px; /* 사이드바 왼쪽 경계선에 걸치게 배치 */
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 50;
  transition: background-color 0.2s;
}

.resizer:hover, .is-resizing {
  background-color: var(--accent); /* 호버하거나 드래그 중일 때 강조색상 */
}

.chat-header {
  height: 4rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  flex-shrink: 0;
}

.back-button {
  margin-right: 0.25rem;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.back-button:hover {
  color: var(--accent);
}

.chat-title {
  font-weight: 900;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-main);
}

.close-button {
  color: var(--text-muted);
  transition: color 0.2s;
}

.close-button:hover {
  color: var(--text-main);
}
</style>