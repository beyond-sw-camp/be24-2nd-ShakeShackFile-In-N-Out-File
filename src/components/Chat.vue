<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import ChatRoom from './ChatRoom.vue'
import ChatList from './Chatlist.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import api from '@/plugins/axiosinterceptor.js'


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
const chatRooms = ref([])

const currentUser = computed(() => ({ 
  name: authStore.user?.userName || 'Guest',
}))

watch(viewMode, async (newMode) => {
  if (newMode === 'list') {
    console.log('목록으로 돌아옴: 데이터를 새로고침합니다.');
    await fetchRooms();
  }
})
const fetchError = ref(false)
// 1. 방 목록 가져오기 (실제 DB 연동)
const fetchRooms = async () => {
  try {
    console.log("인터셉터 객체 확인:", api);
    // 1. 백엔드 컨트롤러의 @RequestParam 설정에 맞춰 파라미터 전달
    const response = await api.get('/chatRoom/list', {
      params: {
        page: 0, // 기본값 0
        size: 5  // 컨트롤러 기본값 5
      }
    }) 
    
    // 2. 응답 구조 매칭
    // 컨트롤러 응답: BaseResponse { success: true, data: { boardList: [...] } }
    const dataWrapper = response.data.result 

if (dataWrapper && dataWrapper.boardList) {
  chatRooms.value = dataWrapper.boardList.map(room => ({
    id: room.idx,
    name: room.title || '이름 없는 채팅방',
    lastMsg: room.lastMessage || '메시지가 없습니다.',
    time: room.lastMessageTime || '',
    userCount: room.participantCount || 0, 
    unreadCount: room.unreadCount || 0,
    icon: 'fa-comments'
  }))

    } else {
      console.warn('List가 비어있거나 구조가 다릅니다:', result)
      chatRooms.value = []
    }
  } catch (error) {
    console.error('방 목록 로드 실패:', error)
    fetchError.value = true // ← 실패 시 true
  }
}

// 2. 방 만들기 로직
const handleCreateRoom = async () => {
  const roomName = prompt('새로운 채팅방 이름을 입력해주세요.')
  if (!roomName || !roomName.trim()) return

  const inviteInput = prompt('초대할 유저의 IDX 번호들을 입력해주세요. (예: 1, 2, 3)\n비워두면 본인만 참여합니다.')
  
  // 입력받은 문자열을 숫자 배열로 변환
  const participantsIdx = inviteInput 
    ? inviteInput.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : []

  try {
    // 백엔드 ChatRoomsDto.ChatRoomsReq 구조에 맞춰 데이터 전송
    await api.post('/chatRoom/create', {
      title: roomName.trim(),
      participantsIdx: participantsIdx // 수정된 부분: 입력받은 인원 ID 리스트 전달
    })
    
    alert('채팅방이 생성되었습니다.')
    await fetchRooms() // 목록 새로고침
  } catch (error) {
    console.error('방 생성 실패:', error)
    alert('방 생성에 실패했습니다. 유저 ID를 확인해주세요.')
  }
}
const onRenameRoom = async (room) => {
  const newTitle = prompt('변경할 방 이름을 입력하세요.', room.name);
  if (newTitle && newTitle.trim() !== room.name) {
    try {
      await api.patch(`/chatRoom/${room.id}/title`, { title: newTitle.trim() });
      // 목록에서 즉시 반영
      const target = chatRooms.value.find(r => r.id === room.id);
      if (target) target.name = newTitle.trim();
      if (selectedRoom.value?.id === room.id) selectedRoom.value.name = newTitle.trim();
    } catch (error) {
      console.error('이름 변경 실패:', error);
    }
  }
}

// 2. 방 나가기 로직 추가
const onLeaveRoom = async (room) => {
  if (!confirm(`'${room.name}' 방에서 나가시겠습니까?`)) return;

  try {
    // 백엔드 엔드포인트에 맞춰 호출 (예: DELETE /chatRoom/{idx}/leave)
    await api.delete(`/chatRoom/${room.id}/exit`);
    alert('방에서 나갔습니다.');
    await fetchRooms(); // 목록 새로고침
  } catch (error) {
    console.error('방 나가기 실패:', error);
    alert('방 나가기에 실패했습니다.');
  }
}
// 초대 로직
const handleInviteFromHeader = async () => {
  const input = prompt('초대할 유저의 IDX를 입력하세요. (여러 명: 1, 2, 3)')
  if (!input || !input.trim()) return

  const userIdxList = input
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id))

  if (userIdxList.length === 0) {
    alert('올바른 IDX를 입력해주세요.')
    return
  }

  try {
    await api.post(`/chatRoom/${selectedRoom.value.id}/invite`, userIdxList)
    alert(`${userIdxList.length}명을 초대했습니다.`)
  } catch (error) {
    console.error('초대 실패:', error)
    alert('초대에 실패했습니다.')
  }
}

const handleSelectRoom = (room) => {
  selectedRoom.value = room
  viewMode.value = 'room'
}
const handleBack = async () => {
  if (selectedRoom.value) {
    try {
      await api.post(`/chat/${selectedRoom.value.id}/read`)
      await api.post(`/chatRoom/${selectedRoom.value.id}/leave`)
      const target = chatRooms.value.find(r => r.id === selectedRoom.value.id)
      if (target) target.unreadCount = 0
    } catch (e) {
      console.error('읽음 처리 실패:', e)
    }
  }
  viewMode.value = 'list'
}
onMounted(() => {
  navigator.serviceWorker.addEventListener('message', (e) => {
    // 1. 알림 클릭 시 특정 채팅방 열기 (OPEN_CHAT_ROOM)
    if (e.data.type === 'OPEN_CHAT_ROOM') {
      const room = chatRooms.value.find(r => r.id === e.data.roomIdx);
      if (room) {
        handleSelectRoom(room); // 오타 수정: handleselectRoom -> handleSelectRoom
      }
    }

    // 2. 새 메시지 수신 시 목록 실시간 업데이트 (NEW_MESSAGE)
    // 이 if문은 반드시 리스너 중괄호 { } 안에 있어야 합니다.
    if (e.data.type === 'NEW_MESSAGE') {
      const target = chatRooms.value.find(r => r.id === e.data.roomIdx);
      if (target) {
        target.lastMsg = e.data.lastMsg;
        target.unreadCount = e.data.unreadCount;
        
        // [선택] 최신 메시지가 온 방을 목록 맨 위로 올리고 싶다면:
        // chatRooms.value.sort((a, b) => (a.id === e.data.roomIdx ? -1 : 1));
      } else {
        // 목록에 없는 새로운 방의 알림이라면 목록 전체 새로고침
        fetchRooms();
      }
    }
  });

  // 스토어에 토큰이 없는 경우 잠시 대기하거나 재로그인 유도
  if (!authStore.token) {
    // 10분 만료 후 새로고침 시, 첫 요청이 401을 트리거하여 
    // 인터셉터가 토큰을 받아올 때까지 기다리는 로직이 필요할 수 있습니다.
    setTimeout(async () => {
      await fetchRooms();
    }, 500); // 0.5초 정도 대기 후 목록 호출
  } else {
    fetchRooms();
  }
});
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
          @click="handleBack"
          class="back-button"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="chat-title">
          {{ viewMode === 'list' ? '채팅 목록' : selectedRoom.name }}
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <button 
          v-if="viewMode === 'list'"
          @click="handleCreateRoom" 
          class="create-room-btn"
        >
          <i class="fa-solid fa-plus"></i>
          방 만들기
        </button>
        <!-- 채팅방 안에서만 보이는 초대 버튼 -->
    <button
      v-if="viewMode === 'room'"
      @click="handleInviteFromHeader"
      class="create-room-btn"
    >
      <i class="fa-solid fa-user-plus"></i>
      초대
    </button>
        <button @click="emit('close')" class="close-button">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
<div v-if="fetchError && viewMode === 'list'" class="fetch-error">
  <i class="fa-solid fa-circle-exclamation"></i>
  <p>목록을 불러오지 못했습니다.</p>
  <button @click="fetchRooms">새로고침</button>
</div>
    <ChatList 
  v-if="viewMode === 'list'" 
  :rooms="chatRooms" 
  @select-room="handleSelectRoom" 
  @rename-room="onRenameRoom"   @leave-room="onLeaveRoom"     />
    <ChatRoom v-else :room="selectedRoom" :currentUser="currentUser" @back="viewMode = 'list'" />
  </aside>
</template>

<style scoped>
/* 기존 스타일 유지 및 버튼 스타일 추가 */
.create-room-btn {
  font-size: 0.75rem;
  background-color: #1cacff;
  color: white;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: background 0.2s;
}
.create-room-btn:hover {
  background-color: #1999e3;
}
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

.fetch-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.fetch-error i {
  font-size: 2rem;
  color: #f87171;
}

.fetch-error button {
  margin-top: 0.25rem;
  padding: 0.4rem 1rem;
  background-color: #1cacff;
  color: white;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  transition: background 0.2s;
}

.fetch-error button:hover {
  background-color: #1999e3;
}
</style>