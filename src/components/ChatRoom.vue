<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
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

const formatTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date)
}

// 1. 과거 내역 가져오기 (DB 연동)
const fetchHistory = async () => {
  try {
    // 백엔드: GET /chat/{roomIdx}
    const response = await api.get(`/chat/${props.room.id}/history`)
    
    // 백엔드 응답 구조: BaseResponse.result.boardList
    if (response.data.success && response.data.result.messageList) {
      chatMessages.value = response.data.result.messageList.map(msg => ({
        id: msg.idx,
        sender: msg.senderNickname,
        text: msg.contents,
        time: msg.createdAt,
        // 현재 로그인한 유저의 idx와 메시지 작성자의 senderIdx 비교
        isMe: msg.senderIdx === authStore.user.idx 
      }))
      
      // 메시지를 시간순(과거 -> 현재)으로 보여주기 위해 정렬이 필요할 수 있습니다.
      // 만약 백엔드에서 역순으로 준다면 .reverse()를 붙여주세요.
      chatMessages.value.reverse(); 
    }
    await nextTick()
    scrollToBottom()
  } catch (error) {
    console.error('채팅 내역 로드 실패:', error)
  }
}

// 2. STOMP 웹소켓 연결
const initChat = () => {
  if (stompClient) stompClient.disconnect()

  // 설정된 엔드포인트 "/ws" 사용 (withSockJS가 없으므로 순수 WebSocket 사용)
  const socket = new SockJS('http://localhost:8080/ws-stomp')
  stompClient = Stomp.over(socket)

  // 디버그 로그가 너무 많으면 아래 주석 해제
  // stompClient.debug = null 

  stompClient.connect(
    { Authorization: `Bearer ${authStore.token}` }, 
    () => {
      console.log('STOMP 연결 성공')
      
      // 구독 경로: SimpleBroker "/topic" + roomIdx
      stompClient.subscribe(`/sub/chat/room/${props.room.id}`, (sdkEvent) => {
        const data = JSON.parse(sdkEvent.body)
        
        chatMessages.value.push({
          id: data.idx,
          sender: data.senderNickname,
          text: data.contents,
          time: data.createdAt,
          isMe: data.senderIdx === authStore.user.idx
        })
        nextTick(() => scrollToBottom())
        // 내가 보낸 메시지가 아닐 때만 알림 ← 추가
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

// 3. 메시지 전송
const sendMessage = () => {
  if (!newMessage.value.trim() || !stompClient) return

  const sendPayload = {
    contents: newMessage.value.trim()
  }

  // 전송 경로: ApplicationDestinationPrefix "/app" + MessageMapping "/chat/{roomIdx}"
  stompClient.send(
    `/pub/chat/${props.room.id}`, 
    { Authorization: `Bearer ${authStore.token}` }, 
    JSON.stringify(sendPayload)
  )

  newMessage.value = ''
  markAsRead()
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

// 브라우저 알림 권한 요청
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

// 브라우저 알림 표시
const showNotification = (sender, message) => {
    // 방에 들어와 있으면 알림 안 띄움 (포커스 여부 상관없이)
    if (Notification.permission !== 'granted') return

    new Notification(`${props.room.name}`, {
        body: `${sender}: ${message}`,
        icon: '/favicon.ico'
    })
}

onMounted(async() => {
  await api.post(`/chatRoom/${props.room.id}/enter`)
  requestNotificationPermission()
  fetchHistory()
  initChat()
  markAsRead()
})

onUnmounted(async() => {
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
        :class="['flex gap-3', msg.isMe ? 'flex-row-reverse' : '']"
      >
        <div :class="['flex flex-col max-w-[85%]', msg.isMe ? 'items-end' : 'items-start']">
          <p class="text-[10px] font-bold text-[var(--text-muted)] mb-1">{{ msg.sender }}</p>
          
          <div :class="['flex items-end gap-2', msg.isMe ? 'flex-row-reverse' : '']">
            <div
              :class="[
                'p-3 rounded-2xl text-xs break-words',
                msg.isMe ? 'bg-[#4169E1] text-white' : 'bg-[var(--bg-input)] text-[var(--text-main)]',
              ]"
            >
              {{ msg.text }}
            </div>
            
            <span class="text-[9px] text-gray-400 whitespace-nowrap mb-1">
              {{ formatTime(msg.time) }}
            </span>
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
