<script setup>
import { ref, onMounted } from 'vue'
import { computed } from 'vue'
import ChatRoom from './ChatRoom.vue'
import ChatList from './Chatlist.vue'
import {useAuthStore} from '@/stores/useAuthStore'
import api from '@/plugins/axiosinterceptor.js' // axios 인스턴스 임포트

const props = defineProps({ isOpen: Boolean })
const emit = defineEmits(['close'])

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
  <aside class="chat-panel" :class="isOpen ? 'chat-panel-open' : 'chat-panel-closed'">
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
  background-color: var(--bg-main);
  border-left: 1px solid var(--border-color);
  transition: all 0.3s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 40;
}

.chat-panel-open {
  width: 20rem;
}

.chat-panel-closed {
  width: 0;
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