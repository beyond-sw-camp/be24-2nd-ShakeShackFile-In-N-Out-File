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

//채팅창 페이지처리
const currentPage = ref(0)
const isLastPage = ref(false)
const isLoading = ref(false)
const prevScrollHeight = ref(0)
const scrollObserver = ref(null)

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

const fetchHistory = async (isFirst = false) => {
  // 로딩 중이거나 이미 마지막 페이지라면 중단
  if (isLoading.value || (isLastPage.value && !isFirst)) return
  
  isLoading.value = true
  const size = 20

  if (isFirst) {
    currentPage.value = 0
    isLastPage.value = false
    // 첫 로딩 시에만 배열 초기화 (필요시)
  }

  const container = scrollContainer.value
  // 데이터 로드 전의 전체 높이를 기억합니다.
  const beforeHeight = container ? container.scrollHeight : 0

  try {
    // 백엔드 ChatMessageController의 파라미터(page, size)를 활용합니다.
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

      // 백엔드에서 준 데이터가 요청한 size보다 적으면 마지막 페이지로 판단합니다.
      if (newMsgs.length < size) {
        isLastPage.value = true
      }

      // [핵심] 과거 데이터를 현재 리스트의 '앞'에 추가합니다.
      // 백엔드가 Desc로 주므로, 화면 표시를 위해 reverse() 후 붙입니다.
      chatMessages.value = [...newMsgs.reverse(), ...chatMessages.value]
      
      // 다음 페이지 준비
      currentPage.value++

      await nextTick()
      if (isFirst) {
        scrollToBottom()
      } else if (container) {
        // [카톡 로직] 새 데이터가 추가된 만큼만 scrollTop을 조정해 보던 위치를 유지합니다.
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
  // 기존 옵저버가 있으면 해제
  if (scrollObserver.value) scrollObserver.value.disconnect()
  
  scrollObserver.value = new IntersectionObserver((entries) => {
    // 센서가 화면에 보이고(isIntersecting), 마지막 페이지가 아닐 때만 호출
    if (entries[0].isIntersecting && !isLastPage.value && !isLoading.value) {
      console.log("과거 대화 추가 로딩 시작...")
      fetchHistory() // isFirst를 안 보냈으므로 false로 작동하여 다음 페이지 로드
    }
  }, { 
    threshold: 0.1, // 센서가 10%만 보여도 작동
    rootMargin: '100px 0px 0px 0px' // [팁] 맨 위 닿기 100px 전부터 미리 로딩 시작 (더 부드러움)
  })

  const target = document.querySelector('#chat-top-sensor')
  if (target) scrollObserver.value.observe(target)
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
  await fetchHistory(true)
  initObserver()  
  initChat()
  markAsRead()
})

onUnmounted(() => {
  api.post(`/chatRoom/${props.room.id}/leave`).catch(() => {})
  if (stompClient) stompClient.disconnect()
})

watch(() => props.room.id, async() => {
  markAsRead()
  await fetchHistory(true)
  initObserver()
  initChat()
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
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