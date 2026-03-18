<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import api from '@/plugins/axiosinterceptor.js'
import { useAuthStore } from '@/stores/useAuthStore'
import SockJS from 'sockjs-client'
import Stomp from 'stompjs'

const props = defineProps({ room: Object, currentUser: Object })
const emit = defineEmits(['back', 'open-invite'])
const authStore = useAuthStore()

const chatMessages = ref([])
const newMessage = ref('')
const scrollContainer = ref(null)
let stompClient = null

const currentPage = ref(0)
const isLastPage = ref(false)
const isLoading = ref(false)
const scrollObserver = ref(null)

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

const sortMessages = () => {
  chatMessages.value.sort((a, b) => {
    const timeA = new Date(a.time).getTime()
    const timeB = new Date(b.time).getTime()
    if (timeA !== timeB) return timeA - timeB
    return (a.id > b.id) ? 1 : -1
  })
}

const fetchHistory = async (isFirst = false) => {
  if (isLoading.value || (isLastPage.value && !isFirst)) return

  isLoading.value = true
  const size = 20

  if (isFirst) {
    currentPage.value = 0
    isLastPage.value = false
    chatMessages.value = [] // 첫 로딩 시 초기화
  }

  const container = scrollContainer.value
  const beforeHeight = container ? container.scrollHeight : 0

  try {
    const response = await api.get(`/chat/${props.room.id}/history`, {
      params: { page: currentPage.value, size: size }
    })

    if (response.data.success && response.data.result.messageList) {
      const newMsgs = response.data.result.messageList.map(msg => ({
        id: msg.idx,
        sender: msg.senderNickname,
        text: msg.contents,
        time: msg.createdAt,
        isMe: msg.senderIdx === authStore.user.idx,
        messageUnreadCount: msg.messageUnreadCount,
        profileImageUrl: msg.profileImageUrl
      }))

      if (newMsgs.length < size) isLastPage.value = true

      chatMessages.value = [...newMsgs.reverse(), ...chatMessages.value]
      currentPage.value++

      await nextTick()
      if (isFirst) {
        scrollToBottom()
      } else if (container) {
        container.scrollTop = container.scrollHeight - beforeHeight
      }
    }
  } catch (error) {
    console.error('이전 대화 로드 실패:', error)
  } finally {
    isLoading.value = false
  }
}

const initObserver = () => {
  if (scrollObserver.value) scrollObserver.value.disconnect()

  scrollObserver.value = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLastPage.value && !isLoading.value) {
      fetchHistory()
    }
  }, {
    threshold: 0.1,
    rootMargin: '100px 0px 0px 0px'
  })

  const target = document.querySelector('#chat-top-sensor')
  if (target) scrollObserver.value.observe(target)
}

const initChat = () => {
  if (stompClient) stompClient.disconnect()

  const socket = new SockJS('http://localhost:8080/ws-stomp')
  stompClient = Stomp.over(socket)
  stompClient.debug = null // 디버그 로그 제거

  stompClient.connect(
    { Authorization: `Bearer ${authStore.token}` },
    () => {
      console.log('STOMP 연결 성공')

      stompClient.subscribe(`/sub/chat/room/${props.room.id}`, (sdkEvent) => {
        const data = JSON.parse(sdkEvent.body)

        // 읽음 업데이트
        if (data.type === 'READ_UPDATE') {
          chatMessages.value.forEach(msg => {
            if (!msg.isPending && msg.messageUnreadCount > 0) {
              msg.messageUnreadCount -= 1
            }
          })
          return
        }

        // 내가 보낸 메시지 → 임시 메시지 교체
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
              profileImageUrl: data.profileImageUrl
            }
            sortMessages()
            nextTick(() => scrollToBottom())
            return
          }
        }

        // 상대방 메시지 (중복 방지)
        if (!chatMessages.value.some(m => m.id === data.idx && !m.isPending)) {
          chatMessages.value.push({
            id: data.idx,
            sender: data.senderNickname,
            text: data.contents,
            time: data.createdAt,
            isMe: false,
            messageUnreadCount: data.messageUnreadCount,
            profileImageUrl: data.profileImageUrl
          })
          sortMessages()
          nextTick(() => scrollToBottom())
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
  const text = newMessage.value.trim()
  if (!text || !stompClient) return

  newMessage.value = '' // 즉시 초기화

  const tempMsg = {
    id: 'temp-' + Date.now() + Math.random(),
    sender: myName.value,
    text: text,
    time: new Date().toISOString(),
    isMe: true,
    isPending: true,
    messageUnreadCount: 0,
    profileImageUrl: myProfileImageUrl.value
  }
  chatMessages.value.push(tempMsg)
  sortMessages()
  nextTick(() => scrollToBottom())

  stompClient.send(
    `/pub/chat/${props.room.id}`,
    { Authorization: `Bearer ${authStore.token}` },
    JSON.stringify({ contents: text })
  )
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
  await fetchHistory(true)
  initObserver()
  initChat()
  markAsRead()
})

onUnmounted(() => {
  api.post(`/chatRoom/${props.room.id}/leave`).catch(() => {})
  if (scrollObserver.value) scrollObserver.value.disconnect()
  if (stompClient) stompClient.disconnect()
})

watch(() => props.room.id, async () => {
  markAsRead()
  await fetchHistory(true)
  initObserver()
  initChat()
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden relative">
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-5 space-y-4">
      <div id="chat-top-sensor" style="height: 1px; margin-bottom: -1px;"></div>

      <div v-if="isLoading && !isLastPage" class="flex justify-center py-2">
        <span class="text-[10px] text-gray-400">
          <i class="fa-solid fa-circle-notch fa-spin mr-1"></i> 이전 메시지 로딩 중...
        </span>
      </div>

      <div
        v-for="msg in chatMessages"
        :key="msg.id"
        :class="['flex items-end gap-2', msg.isMe ? 'flex-row-reverse' : '']"
      >
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
          @keydown.enter.prevent="sendMessage"
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