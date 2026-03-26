<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import api from '@/plugins/axiosinterceptor.js'
import { useAuthStore } from '@/stores/useAuthStore'
import SockJS from 'sockjs-client'
import Stomp from 'stompjs'

const props = defineProps({ room: Object, currentUser: Object })
const emit = defineEmits(['back', 'open-invite', 'room-preview-update'])
const authStore = useAuthStore()

const chatMessages = ref([])
const newMessage = ref('')
const scrollContainer = ref(null)
let stompClient = null
let presenceHeartbeatTimer = null
let activePresenceRoomId = null

const HEARTBEAT_INTERVAL_MS = 60 * 1000

const currentPage = ref(0)
const isLastPage = ref(false)
const isLoading = ref(false)
const scrollObserver = ref(null)
const messageMenuVisible = ref(false)
const messageMenuPos = ref({ x: 0, y: 0 })
const selectedMessage = ref(null)
const imagePreviewUrl = ref('')
const imagePreviewName = ref('')

const myProfileImageUrl = computed(() => authStore.user?.profileImageUrl || null)
const myName = computed(() => authStore.user?.userName || authStore.user?.name || 'Guest')
const DELETED_MESSAGE_TEXT = '삭제된 메시지입니다.'

const isDeletedMessagePayload = (payload = {}) => (
  Boolean(payload.deleted) ||
  (
    String(payload.contents ?? payload.text ?? '').trim() === DELETED_MESSAGE_TEXT &&
    !payload.fileUrl &&
    !payload.fileName
  )
)

const toChatMessage = (payload = {}, options = {}) => {
  const deleted = isDeletedMessagePayload(payload)
  const isMe = Boolean(options.isMe)
  const isPending = Boolean(options.isPending)

  return {
    id: payload.idx ?? payload.id,
    sender: payload.senderNickname ?? payload.sender ?? myName.value,
    text: deleted ? DELETED_MESSAGE_TEXT : (payload.contents ?? payload.text ?? ''),
    time: payload.createdAt ?? payload.time ?? new Date().toISOString(),
    isMe,
    isPending,
    deleted,
    messageUnreadCount: payload.messageUnreadCount ?? 0,
    profileImageUrl: deleted ? null : (payload.profileImageUrl ?? null),
    fileUrl: deleted ? null : (payload.fileUrl ?? null),
    fileName: deleted ? null : (payload.fileName ?? null),
    fileType: deleted ? null : (payload.fileType ?? null),
    fileSize: deleted ? null : (payload.fileSize ?? null),
    messageType: deleted ? 'TEXT' : (payload.messageType || 'TEXT'),
  }
}

const getPreviewText = (message = {}) => {
  const text = String(message.text ?? message.contents ?? '').trim()
  if (text) return text

  const normalizedMessageType = String(message.messageType ?? '').toUpperCase()
  if (normalizedMessageType === 'IMAGE') return '사진'
  if (normalizedMessageType === 'FILE') return '문서'

  const normalizedFileType = String(message.fileType ?? '').toLowerCase()
  if (normalizedFileType.startsWith('image/')) return '사진'
  if (normalizedFileType) return '문서'

  const fileHint = String(message.fileName ?? message.fileUrl ?? '').toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileHint)) return '사진'
  if (fileHint) return '문서'

  return ''
}

const emitRoomPreviewUpdate = (message = {}) => {
  const lastMsg = getPreviewText(message)
  if (!props.room?.id || !lastMsg) return

  emit('room-preview-update', {
    roomId: props.room.id,
    lastMsg,
    time: message.time ?? message.createdAt ?? new Date().toISOString(),
  })
}

const applyDeletedMessage = (messageId, deletedText = DELETED_MESSAGE_TEXT) => {
  const target = chatMessages.value.find((msg) => msg.id === messageId)
  if (!target) return

  target.text = deletedText || DELETED_MESSAGE_TEXT
  target.deleted = true
  target.isPending = false
  target.fileUrl = null
  target.fileName = null
  target.fileType = null
  target.fileSize = null
  target.messageType = 'TEXT'
  emitRoomPreviewUpdate(target)
}

const openMessageMenu = (event, msg) => {
  if (!msg?.isMe || msg?.isSystem || msg?.isPending || msg?.deleted) return

  event.preventDefault()
  selectedMessage.value = msg
  messageMenuPos.value = { x: event.clientX, y: event.clientY }
  messageMenuVisible.value = true
}

const closeMessageMenu = () => {
  messageMenuVisible.value = false
  selectedMessage.value = null
}

const openImagePreview = (message) => {
  if (!message?.fileUrl) return
  imagePreviewUrl.value = message.fileUrl
  imagePreviewName.value = message.fileName ?? '이미지 미리보기'
}

const closeImagePreview = () => {
  imagePreviewUrl.value = ''
  imagePreviewName.value = ''
}

const downloadImagePreview = async () => {
  if (!imagePreviewUrl.value) return

  const fallbackName = imagePreviewName.value?.trim() || 'image'

  try {
    const response = await fetch(imagePreviewUrl.value)
    if (!response.ok) {
      throw new Error(`download failed: ${response.status}`)
    }

    const blob = await response.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fallbackName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(objectUrl)
  } catch (error) {
    console.error('이미지 다운로드 실패:', error)
    window.open(imagePreviewUrl.value, '_blank', 'noopener,noreferrer')
  }
}

const handleWindowKeydown = (event) => {
  if (event.key !== 'Escape') return
  closeMessageMenu()
  closeImagePreview()
}

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
      const newMsgs = response.data.result.messageList.map((msg) =>
        toChatMessage(msg, { isMe: msg.senderIdx === authStore.user.idx })
      )

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

  const socket = new SockJS('https://api.fileinnout.kro.kr/ws-stomp')
  stompClient = Stomp.over(socket)
  stompClient.debug = null // 디버그 로그 제거

  stompClient.connect(
    { Authorization: `Bearer ${authStore.token}` },
    () => {
      console.log('STOMP 연결 성공')

      stompClient.subscribe(`/sub/chat/room/${props.room.id}`, (sdkEvent) => {
        const data = JSON.parse(sdkEvent.body)

        // ✅ 시스템 메시지 (입장/퇴장)
        if (data.messageType === 'ENTER' || data.messageType === 'EXIT') {
          chatMessages.value.push({
            id: 'system-' + Date.now(),
            isSystem: true,       // 시스템 메시지 구분 플래그
            text: data.contents,  // "홍길동님이 입장했습니다." 등
            time: data.createdAt
          })
          nextTick(() => scrollToBottom())
          return  // 👈 이후 로직 실행 안 되게 차단
        }

        // 읽음 업데이트
        if (data.type === 'READ_UPDATE') {
          chatMessages.value.forEach(msg => {
            if (!msg.isPending && msg.messageUnreadCount > 0) {
              msg.messageUnreadCount -= 1
            }
          })
          return
        }

        if (data.type === 'MESSAGE_DELETED') {
          applyDeletedMessage(data.messageIdx ?? data.idx, data.contents)
          return
        }

        // 내가 보낸 메시지 → 임시 메시지 교체
        if (data.senderIdx === authStore.user.idx) {
          const tempIdx = chatMessages.value.findLastIndex(m => m.isPending && m.isMe)
          if (tempIdx !== -1) {
            chatMessages.value[tempIdx] = toChatMessage(data, { isMe: true })
            emitRoomPreviewUpdate(chatMessages.value[tempIdx])
            sortMessages()
            nextTick(() => scrollToBottom())
            return
          }
        }

        // 상대방 메시지 (중복 방지)
        if (!chatMessages.value.some(m => m.id === data.idx && !m.isPending)) {
          const nextMessage = toChatMessage(data, { isMe: false })
          chatMessages.value.push(nextMessage)
          emitRoomPreviewUpdate(nextMessage)
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
  emitRoomPreviewUpdate(tempMsg)
  sortMessages()
  nextTick(() => scrollToBottom())

  stompClient.send(
    `/pub/chat/${props.room.id}`,
    { Authorization: `Bearer ${authStore.token}` },
    JSON.stringify({ contents: text })
  )
}

const fileInput = ref(null)

const handleFileSelect = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  const isImage = file.type.startsWith('image/')
  const maxSize = isImage ? 5 * 1024 * 1024 : 30 * 1024 * 1024

  if (file.size > maxSize) {
    alert(isImage ? '이미지는 5MB 이하만 업로드 가능합니다.' : '파일은 30MB 이하만 업로드 가능합니다.')
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await api.post(`/chat/${props.room.id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    const fileUrl = response.data.result.fileUrl
    const messageType = isImage ? 'IMAGE' : 'FILE'

    // 임시 메시지 추가
    const tempMsg = {
      id: 'temp-' + Date.now() + Math.random(),
      sender: myName.value,
      time: new Date().toISOString(),
      isMe: true,
      isPending: true,
      messageUnreadCount: 0,
      profileImageUrl: myProfileImageUrl.value,
      fileUrl: fileUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      messageType: messageType,
      contents: ''
    }
    chatMessages.value.push(tempMsg)
    emitRoomPreviewUpdate(tempMsg)
    sortMessages()
    nextTick(() => scrollToBottom())

    // 웹소켓으로 파일 메시지 전송
    stompClient.send(
      `/pub/chat/${props.room.id}`,
      { Authorization: `Bearer ${authStore.token}` },
      JSON.stringify({
        contents: '',
        fileUrl: fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        messageType: messageType
      })
    )
  } catch (e) {
    alert('파일 업로드에 실패했습니다.')
  }

  e.target.value = '' // 같은 파일 재업로드 가능하도록
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const stopPresenceHeartbeat = () => {
  if (presenceHeartbeatTimer) {
    window.clearInterval(presenceHeartbeatTimer)
    presenceHeartbeatTimer = null
  }
}

const sendPresenceHeartbeat = async (roomId = activePresenceRoomId) => {
  if (!roomId) return

  try {
    await api.post(`/chatRoom/${roomId}/heartbeat`)
  } catch (error) {
    console.error('채팅방 heartbeat 실패:', error)
  }
}

const startPresenceHeartbeat = (roomId) => {
  stopPresenceHeartbeat()
  if (!roomId) return

  activePresenceRoomId = roomId
  presenceHeartbeatTimer = window.setInterval(() => {
    sendPresenceHeartbeat(roomId)
  }, HEARTBEAT_INTERVAL_MS)
}

const enterRoomPresence = async (roomId) => {
  if (!roomId) return

  await api.post(`/chatRoom/${roomId}/enter`)
  activePresenceRoomId = roomId
  startPresenceHeartbeat(roomId)
}

const leaveRoomPresence = async (roomId = activePresenceRoomId) => {
  stopPresenceHeartbeat()

  if (!roomId) {
    activePresenceRoomId = null
    return
  }

  activePresenceRoomId = null

  try {
    await api.post(`/chatRoom/${roomId}/leave`)
  } catch (error) {
    console.error('채팅방 leave 실패:', error)
  }
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
const openFile = (url) => {
  window.open(url, '_blank')
}

const deleteMessage = async () => {
  const messageId = selectedMessage.value?.id
  if (!messageId) return

  try {
    await api.delete(`/chat/${props.room.id}/${messageId}`)
    applyDeletedMessage(messageId)
    closeMessageMenu()
  } catch (error) {
    console.error('메시지 삭제 실패:', error.response?.status, error.response?.data, error)
    alert('메시지 삭제에 실패했습니다.')
  }
}

onMounted(async () => {
  window.addEventListener('click', closeMessageMenu)
  window.addEventListener('keydown', handleWindowKeydown)
  await enterRoomPresence(props.room.id)
  requestNotificationPermission()
  await fetchHistory(true)
  initObserver()
  initChat()
  markAsRead()
})

onUnmounted(() => {
  window.removeEventListener('click', closeMessageMenu)
  window.removeEventListener('keydown', handleWindowKeydown)
  leaveRoomPresence().catch(() => {})
  if (scrollObserver.value) scrollObserver.value.disconnect()
  if (stompClient) stompClient.disconnect()
})

watch(() => props.room.id, async (newRoomId, oldRoomId) => {
  closeMessageMenu()
  if (oldRoomId && oldRoomId !== newRoomId) {
    await leaveRoomPresence(oldRoomId)
  }
  await enterRoomPresence(newRoomId)
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

      <!-- v-for 바깥 div는 단순 래퍼 -->
      <div v-for="msg in chatMessages" :key="msg.id">

        <!-- 시스템 메시지 -->
        <div v-if="msg.isSystem" class="flex justify-center my-1 w-full">
          <span class="text-[10px] text-gray-400 bg-gray-100 rounded-full px-3 py-0.5">
            {{ msg.text }}
          </span>
        </div>

        <!-- 일반 메시지 -->
        <div v-else class="flex items-end gap-2" :class="msg.isMe ? 'flex-row-reverse' : ''">
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
                @contextmenu="openMessageMenu($event, msg)"
              >
                <span v-if="msg.deleted" :class="['italic opacity-70', msg.isMe ? 'text-white' : 'text-[var(--text-muted)]']">
                  {{ msg.text }}
                </span>
                <!-- 이미지 -->
                <img
                  v-else-if="msg.messageType === 'IMAGE'"
                  :src="msg.fileUrl"
                  class="max-w-[200px] max-h-[200px] rounded-xl object-cover cursor-pointer"
                  @click="openImagePreview(msg)"
                />
                <!-- 파일 -->
                <a
                  v-else-if="msg.messageType === 'FILE'"
                  :href="msg.fileUrl"
                  target="_blank"
                  :class="['flex items-center gap-2', msg.isMe ? 'text-white' : 'text-[var(--text-main)]']"
                >
                  <i class="fa-solid fa-file text-lg"></i>
                  <div class="flex flex-col">
                    <span class="font-bold truncate max-w-[150px]">{{ msg.fileName }}</span>
                    <span class="text-[9px] opacity-70">{{ formatFileSize(msg.fileSize) }}</span>
                  </div>
                  <i class="fa-solid fa-download ml-1"></i>
                </a>
                <!-- 텍스트 -->
                <span v-else>{{ msg.text }}</span>
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
    </div>

    <div
      v-if="messageMenuVisible"
      :style="{ top: `${messageMenuPos.y}px`, left: `${messageMenuPos.x}px` }"
      class="fixed z-[999] min-w-[120px] rounded-lg border border-gray-200 bg-white py-2 text-xs shadow-xl"
      @click.stop
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-2 text-left text-red-500 hover:bg-gray-100"
        @click.stop="deleteMessage"
      >
        <i class="fa-solid fa-trash text-[10px]"></i> 삭제
      </button>
    </div>

    <div
      v-if="imagePreviewUrl"
      class="fixed inset-0 z-[998] flex items-center justify-center bg-black/85 px-4 py-8"
      @click.self="closeImagePreview"
    >
      <div class="absolute right-5 top-5 flex items-center gap-2">
        <button
          type="button"
          class="rounded-full bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
          @click="downloadImagePreview"
        >
          <i class="fa-solid fa-download"></i>
        </button>
        <button
          type="button"
          class="rounded-full bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
          @click="closeImagePreview"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="flex max-h-full max-w-full flex-col items-center gap-4">
        <img
          :src="imagePreviewUrl"
          :alt="imagePreviewName"
          class="max-h-[82vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
        />
        <a
          :href="imagePreviewUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#123d88] shadow"
        >
          새 창에서 열기
        </a>
      </div>
    </div>

    <div class="p-4 border-t border-gray-100">
      <div class="relative flex items-center">
        <input
          ref="fileInput"
          type="file"
          accept="image/*,.pdf,.zip,.docx,.xlsx"
          class="hidden"
          @change="handleFileSelect"
        />
        <button
          @click="fileInput.click()"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#4169E1] transition z-10"
        >
          <i class="fa-solid fa-paperclip"></i>
        </button>
        <input
          v-model="newMessage"
          @keydown.enter.prevent="sendMessage"
          type="text"
          placeholder="메시지 입력..."
          class="w-full border border-gray-200 rounded-lg pl-9 pr-9 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
