profileImageUrl 매핑 추가하고 템플릿에 프사 표시하겠습니다:
vue<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import api from '@/plugins/axiosinterceptor.js'
import { useAuthStore } from '@/stores/useAuthStore'
import SockJS from 'sockjs-client'
import Stomp from 'stompjs'

const props = defineProps({ room: Object, currentUser: Object })
const emit = defineEmits(['back'])
const authStore = useAuthStore()

const chatMessages = ref([])
const newMessage = ref('')
const scrollContainer = ref(null)
let stompClient = null

// 내 프사
const myProfileImageUrl = computed(() => authStore.user?.profileImageUrl || null)
const myName = computed(() => authStore.user?.userName || authStore.user?.name || 'Guest')

const formatTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date)
}

const fetchHistory = async () => {
  try {
    const response = await api.get(`/chat/${props.room.id}/history`)
    if (response.data.success && response.data.result.messageList) {
      chatMessages.value = response.data.result.messageList.map(msg => ({
        id: msg.idx,
        sender: msg.senderNickname,
        text: msg.contents,
        time: msg.createdAt,
        isMe: msg.senderIdx === authStore.user.idx,
        messageUnreadCount: msg.messageUnreadCount,
        profileImageUrl: msg.profileImageUrl // ← 추가
      }))
      chatMessages.value.reverse()
    }
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('채팅 내역 로드 실패:', error)
  }
}

const initChat = () => {
  if (stompClient) stompClient.disconnect()

  const socket = new SockJS('http://localhost:8080/ws-stomp')
  stompClient = Stomp.over(socket)

  stompClient.connect(
    { Authorization: `Bearer ${authStore.token}` },
    () => {
      console.log('STOMP 연결 성공')

      stompClient.subscribe(`/sub/chat/room/${props.room.id}`, (sdkEvent) => {
        const data = JSON.parse(sdkEvent.body)

        if (data.type === 'READ_UPDATE') {
          chatMessages.value.forEach(msg => {
            if (!msg.isPending && msg.messageUnreadCount > 0) {
              msg.messageUnreadCount -= 1
            }
          })
          return
        }

        if (data.senderIdx === authStore.user.idx) {
          const tempIdx = chatMessages.value.findLastIndex(m => m.isPending && m.isMe)
          if (tempIdx !== -1) {
            chatMessages.value[tempIdx] = {
              id: data.idx,
              sender: data.senderNickname,
              text: data.contents,
              time: data.createdAt,
              isMe: true,
              isPending: false,
              messageUnreadCount: data.messageUnreadCount,
              profileImageUrl: data.profileImageUrl // ← 추가
            }
            return
          }
        }

        chatMessages.value.push({
          id: data.idx,
          sender: data.senderNickname,
          text: data.contents,
          time: data.createdAt,
          isMe: false,
          messageUnreadCount: data.messageUnreadCount,
          profileImageUrl: data.profileImageUrl // ← 추가
        })
        nextTick(() => scrollToBottom())

        if (data.senderIdx !== authStore.user.idx) {
          markAsRead()
        }
      })
    },
    (error) => {
      console.error('STOMP 연결 에러:', error)
    }
  )
}

const sendMessage = () => {
  if (!newMessage.value.trim() || !stompClient) return

  const text = newMessage.value.trim()

  const tempMsg = {
    id: 'temp-' + Date.now(),
    sender: myName.value,
    text: text,
    time: new Date().toISOString(),
    isMe: true,
    isPending: true,
    messageUnreadCount: 0,
    profileImageUrl: myProfileImageUrl.value // ← 추가
  }
  chatMessages.value.push(tempMsg)
  nextTick(() => scrollToBottom())

  stompClient.send(
    `/pub/chat/${props.room.id}`,
    { Authorization: `Bearer ${authStore.token}` },
    JSON.stringify({ contents: text })
  )

  newMessage.value = ''
}

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
}

const markAsRead = async () => {
  try {
    await api.post(`/chat/${props.room.id}/read`)
  } catch (e) {
    console.error('읽음 처리 실패:', e)
  }
}

const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

onMounted(async () => {
  await api.post(`/chatRoom/${props.room.id}/enter`)
  requestNotificationPermission()
  fetchHistory()
  initChat()
  markAsRead()
})

onUnmounted(() => {
  api.post(`/chatRoom/${props.room.id}/leave`).catch(() => {})
  if (stompClient) stompClient.disconnect()
})

watch(() => props.room.id, () => {
  markAsRead()
  fetchHistory()
  initChat()
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-5 space-y-4">
      <div
        v-for="msg in chatMessages"
        :key="msg.id"
        :class="['flex items-end gap-2', msg.isMe ? 'flex-row-reverse' : '']"
      >
        <!-- 프로필 사진 -->
        <div class="flex-shrink-0 w-8 h-8">
          <img
            v-if="msg.profileImageUrl"
            :src="msg.profileImageUrl"
            class="w-8 h-8 rounded-full object-cover"
          />
          <div
            v-else
            class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold"
          >
            {{ msg.sender?.charAt(0)?.toUpperCase() }}
          </div>
        </div>

        <div :class="['flex flex-col max-w-[75%]', msg.isMe ? 'items-end' : 'items-start']">
          <p class="text-[10px] font-bold text-[var(--text-muted)] mb-1">{{ msg.sender }}</p>

          <div :class="['flex items-end gap-2', msg.isMe ? 'flex-row-reverse' : '']">
            <div
              :class="[
                'p-3 rounded-2xl text-xs break-words',
                msg.isMe ? 'bg-[#4169E1] text-white' : 'bg-[var(--bg-input)] text-[var(--text-main)]',
                msg.isPending ? 'opacity-60' : ''
              ]"
            >
              {{ msg.text }}
            </div>

            <div :class="['flex flex-col gap-0.5', msg.isMe ? 'items-end' : 'items-start']">
              <span
                v-if="msg.messageUnreadCount > 0"
                class="text-[9px] text-blue-400 font-bold whitespace-nowrap"
              >
                {{ msg.messageUnreadCount }}
              </span>
              <span class="text-[9px] text-gray-400 whitespace-nowrap">
                {{ formatTime(msg.time) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 border-t border-gray-100">
      <div class="relative">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          type="text"
          placeholder="메시지 입력..."
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          @click="sendMessage"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-[#4169E1]"
        >
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  </div>
</template>