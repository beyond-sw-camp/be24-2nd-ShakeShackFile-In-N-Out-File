<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import api from '@/plugins/axiosinterceptor.js'
const props = defineProps({ room: Object, currentUser: Object })
const emit = defineEmits(['back'])

const chatMessages = ref([])
const newMessage = ref('')
const isConnected = ref(false)
const scrollContainer = ref(null)
let websocket = null

// [추가] JSON 데이터를 불러오는 함수
const fetchHistory = async () => {
  try {
    // 톰캣ROOT/api/chatHistory.json 에 파일이 있다면:
    const response = await api.api.get('/json/chat/chathistory.json')

    // axios는 데이터를 response.data에 담아줍니다.
    const allData = response.data
    const roomData = allData[props.room.id]
    if (roomData && roomData.messages) {
      chatMessages.value = roomData.messages
    } else {
      chatMessages.value = [] // 데이터가 없으면 빈 배열
    }

    await nextTick()
    scrollToBottom()
  } catch (error) {
    // 인터셉터에서 정의한 에러 콘솔 외에 추가 처리가 가능합니다.
    console.error('데이터를 가져오는 데 실패했습니다:', error)
  }
}

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
}

const initChat = () => {
  if (websocket) websocket.close()
  websocket = new WebSocket(`ws://127.0.0.1:8080/ws/chat`)

  websocket.onopen = () => {
    isConnected.value = true
    websocket.send(JSON.stringify({ nickname: props.currentUser.name, roomId: props.room.id }))
  }

  websocket.onmessage = (e) => {
    try {
      const rawData = JSON.parse(e.data)
      const data =
        typeof rawData.payload === 'string' ? JSON.parse(rawData.payload) : rawData.payload
      if (data.roomId !== props.room.id) {
        console.log('다른 방 메시지라 무시합니다.')
        return
      }
      if (data.message) {
        chatMessages.value.push({
          id: Date.now(),
          sender: data.nickname,
          text: data.message,
          isMe: data.nickname === props.currentUser.name,
        })
        nextTick(() => scrollToBottom())
      }
    } catch (err) {
      console.error('메시지 수신 에러:', err)
    }
  }
}

const sendMessage = () => {
  try{
  if (!newMessage.value.trim() || !isConnected.value) return
  websocket.send(
    JSON.stringify({
      roomId: props.room.id,
      nickname: props.currentUser.name,
      message: newMessage.value,
    }),
  )

  chatMessages.value.push({
    id: Date.now(),
    sender: props.currentUser.name,
    text: newMessage.value,
    isMe: true, // 내가 쓴 것이므로 true
  })

  newMessage.value = ''
  nextTick(() => scrollToBottom())
  }catch(error){
    console.error('메시지 송신 에러:', err)
  }
}

// [수정] 컴포넌트가 켜질 때 내역 로드와 소켓 연결을 동시에 수행
onMounted(() => {
  fetchHistory() // <-- 여기서 실행해줘야 데이터가 나옵니다!
  initChat()
})

onUnmounted(() => {
  if (websocket) websocket.close()
  console.log('꺼짐')
})

// [추가] 목록에서 다른 방을 클릭했을 때 데이터를 새로 고침
watch(
  () => props.room.id,
  () => {
    fetchHistory()
    initChat()
  },
)
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-5 space-y-4">
      <div
        v-for="msg in chatMessages"
        :key="msg.id"
        :class="['flex gap-3', msg.isMe ? 'flex-row-reverse' : '']"
      >
        <div :class="['flex flex-col max-w-[75%]', msg.isMe ? 'items-end' : 'items-start']">
          <p class="text-[10px] font-bold text-[var(--text-muted)] mb-1">{{ msg.sender }}</p>
          <div
            :class="[
              'p-3 rounded-2xl text-xs break-words',
              msg.isMe ? 'bg-[#4169E1] text-white' : 'bg-[var(--bg-input)] text-[var(--text-main)]',
            ]"
          >
            {{ msg.text }}
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
