<script setup>
import { ref, onMounted } from 'vue'
import { computed, watch } from 'vue'
import ChatRoom from './ChatRoom.vue'
import ChatList from './Chatlist.vue'
import {useAuthStore} from '@/stores/useAuthStore'
import api from '@/plugins/axiosinterceptor.js' // axios 인스턴스 임포트

const props = defineProps({ isOpen: Boolean })
const emit = defineEmits(['close'])

// 너비 조절을 위한 상태값
const DEFAULT_WIDTH = 320; // 처음 크기 (20rem)
const MIN_THRESHOLD = 60; // 이 너비보다 작아지면 닫힘
const MAX_WIDTH = 600
const chatWidth = ref(320) // 기본값 20rem (320px)
const lastWidth = ref(DEFAULT_WIDTH) // 마지막으로 사용자가 조절한 너비를 기억하는 변수
const isForcedClosed = ref(false) // 강제로 밀어서 닫혔는지 여부
const isResizing = ref(false)
// 열릴 때마다 크기 초기화
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (isForcedClosed.value) {
      // 강제로 밀어서 닫혔던 경우 -> 기본 크기로 복구
      chatWidth.value = DEFAULT_WIDTH
      lastWidth.value = DEFAULT_WIDTH
      isForcedClosed.value = false // 상태 초기화
    } else {
      // X 버튼 등으로 일반 종료된 경우 -> 기존 크기 유지
      chatWidth.value = lastWidth.value
    }
  }
})

// 드래그 시작 함수
const startResizing = (event) => {
  isResizing.value = true
  // 마우스 이동 및 버튼 뗌 감지 이벤트 등록
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', stopResizing)
  // 드래그 중 텍스트 선택 방지
  document.body.style.userSelect = 'none'
}

const handleMouseMove = (event) => {
  if (!isResizing.value) return
  
  const newWidth = window.innerWidth - event.clientX
  
  // 최소 임계값보다 작아졌을 때 처리
  if (newWidth < MIN_THRESHOLD) {
    isForcedClosed.value = true // 강제 종료 상태 기록
    stopResizing()
    emit('close')
    return
  }

  if (newWidth < MAX_WIDTH) {
    chatWidth.value = newWidth
    lastWidth.value = newWidth
    isForcedClosed.value = false // 적절한 크기라면 강제 종료 상태 해제
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
  position: relative;
  background-color: var(--bg-main);
  border-left: 1px solid var(--border-color);
  transition: 
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
    opacity 0.2s ease,
    transform 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 40;
}

.chat-panel[style*="width"] {
  transition: none;
}

.chat-panel-closed {
  width: 0 !important;
  opacity: 0;
  border-left: none;
  pointer-events: none; /* 닫혔을 때 클릭 방지 */
}
.chat-panel-open {
  opacity: 1;
}

/* 리사이저 핸들 가독성 */
.resizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 6px; /* 조금 더 넓게 설정해서 잡기 편하게 함 */
  height: 100%;
  cursor: col-resize;
  z-index: 50;
  background-color: transparent;
}

.resizer:hover {
  background-color: rgba(59, 130, 246, 0.2); /* 호버 시 피드백 */
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