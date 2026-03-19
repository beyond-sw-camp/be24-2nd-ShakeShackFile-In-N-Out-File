<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import ChatRoom from './ChatRoom.vue'
import ChatList from './Chatlist.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import api from '@/plugins/axiosinterceptor.js'
import GroupChatInviteModal from '@/components/group/GroupChatInviteModal.vue'

const props = defineProps({ isOpen: Boolean })
const emit = defineEmits(['close'])

// 너비 조절 상태
const DEFAULT_WIDTH = 320;
const MIN_THRESHOLD = 60;
const MAX_WIDTH = 600
const chatWidth = ref(320)
const lastWidth = ref(DEFAULT_WIDTH)
const isForcedClosed = ref(false)
const isResizing = ref(false)

// 페이지네이션 및 스크롤 상태
const currentPage = ref(0)
const isLastPage = ref(false)
const isLoading = ref(false)
const scrollObserver = ref(null)

// 메뉴 상태 관리
const isMenuOpen = ref(false)
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}
const closeMenuOutside = (e) => {
  if (isMenuOpen.value && !e.target.closest('.menu-container')) {
    isMenuOpen.value = false
  }
}
// 메뉴에서 나가기 클릭 시
const handleLeaveRoomFromMenu = async () => {
  if (!selectedRoom.value || !confirm(`'${selectedRoom.value.name}' 방에서 나가시겠습니까?`)) return
  try {
    await api.delete(`/chatRoom/${selectedRoom.value.id}/exit`)
    isMenuOpen.value = false
    handleBack() // 목록으로 돌아가기
  } catch (error) {
    console.error('방 나가기 실패:', error)
    alert('방 나가기에 실패했습니다.')
  }
}

// 열릴 때마다 크기 초기화
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (isForcedClosed.value) {
      chatWidth.value = DEFAULT_WIDTH
      lastWidth.value = DEFAULT_WIDTH
      isForcedClosed.value = false
    } else {
      chatWidth.value = lastWidth.value
    }
  }
})

// 드래그 리사이징 로직
const startResizing = (event) => {
  isResizing.value = true
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', stopResizing)
  document.body.style.userSelect = 'none'
}

const handleMouseMove = (event) => {
  if (!isResizing.value) return
  const newWidth = window.innerWidth - event.clientX
  if (newWidth < MIN_THRESHOLD) {
    isForcedClosed.value = true
    stopResizing()
    emit('close')
    return
  }
  if (newWidth < MAX_WIDTH) {
    chatWidth.value = newWidth
    lastWidth.value = newWidth
    isForcedClosed.value = false
  }
}

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
const fetchError = ref(false)
const isChatInviteModalOpen = ref(false)
const chatInviteMode = ref('invite')

const currentUser = computed(() => ({ 
  name: authStore.user?.userName || 'Guest',
}))

const openChatInviteModal = (mode) => {
  chatInviteMode.value = mode
  isChatInviteModalOpen.value = true
}

const closeChatInviteModal = () => {
  isChatInviteModalOpen.value = false
}

const handleChatInviteCompleted = async ({ mode, roomId } = {}) => {
  await fetchRooms(true)

  if (mode === 'create' && roomId) {
    const createdRoom = chatRooms.value.find((room) => room.id === roomId)
    if (createdRoom) {
      handleSelectRoom(createdRoom)
    }
  }

  if (mode === 'invite') {
    isMenuOpen.value = false
  }
}

// 방 목록 가져오기 (무한 스크롤 대응)
const fetchRooms = async (isFirst = false) => {
  // 이미 로딩 중이거나 마지막 페이지면 중단 (단, 첫 로딩일 때는 제외)
  if (isLoading.value || (isLastPage.value && !isFirst)) return
  
  isLoading.value = true
  fetchError.value = false

  if (isFirst) {
    currentPage.value = 0
    isLastPage.value = false
  }

  try {
    const response = await api.get('/chatRoom/list', {
      params: {
        page: currentPage.value,
        size: 10 // 한 페이지당 10개씩
      }
    })
    
    const dataWrapper = response.data.result 

    if (dataWrapper && dataWrapper.boardList) {
      const newRooms = dataWrapper.boardList.map(room => ({
        id: room.idx,
        name: room.title || '이름 없는 채팅방',
        lastMsg: room.lastMessage || '메시지가 없습니다.',
        time: room.lastMessageTime || '',
        userCount: room.participantCount || 0, 
        unreadCount: room.unreadCount || 0,
        icon: 'fa-comments'
      }))

      if (isFirst) {
        chatRooms.value = newRooms
      } else {
        chatRooms.value.push(...newRooms)
      }

      // 데이터가 요청한 size보다 적으면 마지막 페이지로 판단
      if (newRooms.length < 10) {
        isLastPage.value = true
      } else {
        currentPage.value++
      }
    }
  } catch (error) {
    console.error('방 목록 로드 실패:', error)
    fetchError.value = true
  } finally {
    isLoading.value = false
  }
}

// 무한 스크롤 센서 관찰 로직
const initObserver = () => {
  if (scrollObserver.value) scrollObserver.value.disconnect()

  scrollObserver.value = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLastPage.value && !isLoading.value) {
      fetchRooms();
    }
  }, { threshold: 0.1 })

  setTimeout(() => {
    const target = document.querySelector('#bottom-sensor')
    if (target) scrollObserver.value.observe(target)
  }, 300)
}

watch(viewMode, async (newMode) => {
  if (newMode === 'list') {
    await fetchRooms(true);
    initObserver();
  } else {
    if (scrollObserver.value) scrollObserver.value.disconnect();
  }
})

// 방 만들기
const handleCreateRoom = () => {
  openChatInviteModal('create')
}

const onRenameRoom = async (room) => {
  const newTitle = prompt('변경할 방 이름을 입력하세요.', room.name);
  if (newTitle && newTitle.trim() !== room.name) {
    try {
      await api.patch(`/chatRoom/${room.id}/title`, { title: newTitle.trim() });
      const target = chatRooms.value.find(r => r.id === room.id);
      if (target) target.name = newTitle.trim();
      if (selectedRoom.value?.id === room.id) selectedRoom.value.name = newTitle.trim();
    } catch (error) {
      console.error('이름 변경 실패:', error);
    }
  }
}

const onLeaveRoom = async (room) => {
  if (!confirm(`'${room.name}' 방에서 나가시겠습니까?`)) return;
  try {
    await api.delete(`/chatRoom/${room.id}/exit`);
    alert('방에서 나갔습니다.');
    await fetchRooms(true);
  } catch (error) {
    alert('방 나가기에 실패했습니다.');
  }
}

const handleInviteFromHeader = () => {
  if (!selectedRoom.value?.id) return
  openChatInviteModal('invite')
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
  isMenuOpen.value = false // 뒤로갈 때 메뉴 닫기
  viewMode.value = 'list'
}

onMounted(() => {
  window.addEventListener('click', closeMenuOutside)
  fetchRooms(true)
  initObserver()

  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data.type === 'OPEN_CHAT_ROOM') {
      const room = chatRooms.value.find(r => r.id === e.data.roomIdx);
      if (room) handleSelectRoom(room);
    }
    if (e.data.type === 'NEW_MESSAGE') {
      const target = chatRooms.value.find(r => r.id === e.data.roomIdx);
      if (target) {
        target.lastMsg = e.data.lastMsg;
        target.unreadCount = e.data.unreadCount;
      } else {
        fetchRooms(true);
      }
    }
  });
});

onUnmounted(() => {
  // 컴포넌트 해제 시 이벤트 제거
  window.removeEventListener('click', closeMenuOutside)
})
</script>

<template>
  <GroupChatInviteModal
    :is-open="isChatInviteModalOpen"
    :mode="chatInviteMode"
    :room-id="selectedRoom?.id"
    :room-name="selectedRoom?.name || ''"
    @close="closeChatInviteModal"
    @completed="handleChatInviteCompleted"
  />

  <aside 
    class="chat-panel" 
    :class="isOpen ? 'chat-panel-open' : 'chat-panel-closed'"
    :style="isOpen ? { width: chatWidth + 'px' } : {}"
  >
    <div v-if="isOpen" class="resizer" @mousedown="startResizing" :class="{ 'is-resizing': isResizing }"></div>
    
    <div class="chat-header">
      <div class="flex items-center gap-2 overflow-hidden">
        <button v-if="viewMode === 'room'" @click="handleBack" class="back-button">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="chat-title truncate">{{ viewMode === 'list' ? '채팅 목록' : selectedRoom.name }}</span>
      </div>
      
      <div class="flex items-center gap-1">
        <button v-if="viewMode === 'list'" @click="handleCreateRoom" class="create-room-btn">
          방 만들기
        </button>

        <div v-if="viewMode === 'room'" class="relative menu-container">
          <button @click.stop="toggleMenu" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <i class="fa-solid fa-ellipsis-vertical text-gray-500 text-sm"></i>
          </button>

          <div v-if="isMenuOpen" 
               class="absolute right-0 mt-2 w-32 bg-white border border-gray-200 shadow-xl rounded-lg z-[100] py-1">
            <button @click="handleInviteFromHeader" 
                    class="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-gray-700 hover:bg-blue-50 text-left">
              <i class="fa-solid fa-user-plus w-3"></i> 초대하기
            </button>
            <div class="border-t border-gray-50 my-1"></div>
            <button @click="handleLeaveRoomFromMenu" 
                    class="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 font-bold text-left">
              <i class="fa-solid fa-right-from-bracket w-3"></i> 방 나가기
            </button>
          </div>
        </div>

        <button @click="emit('close')" class="close-button p-2 hover:bg-gray-100 rounded-full">
          <i class="fa-solid fa-xmark text-gray-500"></i>
        </button>
      </div>
    </div>

    <div class="chat-main-container">
      <template v-if="viewMode === 'list'">
        <ChatList :rooms="chatRooms" @select-room="handleSelectRoom" @rename-room="onRenameRoom" @leave-room="onLeaveRoom" />
        <div id="bottom-sensor" class="h-4 flex justify-center items-center p-4">
          <div v-if="isLoading" class="text-xs text-gray-400">불러오는 중...</div>
        </div>
      </template>
      
      <ChatRoom 
        v-else 
        :room="selectedRoom" 
        :currentUser="currentUser" 
        @back="handleBack" 
      />
    </div>
  </aside>
</template>


<style scoped>
.chat-main-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.create-room-btn {
  font-size: 0.75rem;
  background-color: #1cacff;
  color: white;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}
.chat-panel {
  position: relative;
  background-color: var(--bg-main);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 40;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}
.chat-panel-closed { width: 0 !important; opacity: 0; pointer-events: none; }
.resizer {
  position: absolute;
  left: 0; top: 0; width: 6px; height: 100%;
  cursor: col-resize; z-index: 50;
}
.resizer:hover { background-color: rgba(59, 130, 246, 0.2); }
.chat-header {
  height: 4rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  flex-shrink: 0;
}
.chat-title { font-weight: 900; font-size: 0.875rem; color: var(--text-main); }
.fetch-error {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;
}
</style>
