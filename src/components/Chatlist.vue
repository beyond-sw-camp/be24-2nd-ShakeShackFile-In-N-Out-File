<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({ rooms: Array })
const emit = defineEmits(['select-room', 'rename-room', 'leave-room'])

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);
}

// 메뉴 상태 관리
const menuVisible = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const selectedRoomForMenu = ref(null)

// 우클릭 핸들러
const handleContextMenu = (event, room) => {
  event.preventDefault() // 기본 메뉴 방지
  selectedRoomForMenu.value = room
  menuPos.value = { x: event.clientX, y: event.clientY }
  menuVisible.value = true
}

// 메뉴 닫기 핸들러
const closeMenu = () => {
  menuVisible.value = false
}

// 전역 클릭 이벤트로 메뉴 닫기 등록
onMounted(() => {
  window.addEventListener('click', closeMenu)
})
onUnmounted(() => {
  window.removeEventListener('click', closeMenu)
})
</script>

<template>
  <div class="flex-1 overflow-y-auto p-2 relative">
    <div
      v-for="room in rooms"
      :key="room.id"
      @click="emit('select-room', room)"
      @contextmenu="handleContextMenu($event, room)" 
      class="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--bg-input)] cursor-pointer transition-colors group"
    >
      <div class="w-10 h-10 rounded-lg bg-[#1cacff]/10 flex items-center justify-center text-[#1cacff] group-hover:bg-[#1cacff] group-hover:text-white transition-all">
        <i :class="['fa-solid', room.icon]"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-center">
          <p class="text-sm font-bold text-[var(--text-main)] truncate">{{ room.name }}</p>
          <!-- 안 읽은 메시지 뱃지 -->
    <span
      v-if="room.unreadCount > 0"
      class="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
    >
      {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
    </span>
          <span class="text-[10px] text-[var(--text-muted)] whitespace-nowrap ml-2">
        {{ formatTime(room.time) }}
      </span>
          <span v-if="room.userCount > 0" class="participant-badge">
            <i class="fa-solid fa-user"></i> {{ room.userCount }}
          </span>
        </div>
        <p class="text-xs text-[var(--text-muted)] truncate mt-0.5">{{ room.lastMsg }}</p>
      </div>
    </div>

    <div 
      v-if="menuVisible" 
      :style="{ top: menuPos.y + 'px', left: menuPos.x + 'px' }"
      class="fixed bg-white border border-gray-200 shadow-xl rounded-lg py-2 z-[999] text-xs min-w-[120px]"
    >
      <div 
        @click="emit('rename-room', selectedRoomForMenu)" 
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-gray-700"
      >
        <i class="fa-solid fa-pen text-[10px]"></i> 이름 변경
      </div>
      <div 
        @click="emit('leave-room', selectedRoomForMenu)" 
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 text-red-500 font-bold"
      >
        <i class="fa-solid fa-right-from-bracket text-[10px]"></i> 방 나가기
      </div>
    </div>
  </div>
</template>
