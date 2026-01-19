<script setup>
const props = defineProps({ rooms: Array })
const emit = defineEmits(['select-room'])
</script>

<template>
  <div class="flex-1 overflow-y-auto p-2">
    <div
      v-for="room in rooms"
      :key="room.id"
      @click="emit('select-room', room)"
      class="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--bg-input)] cursor-pointer transition-colors group"
    >
      <div
        class="w-10 h-10 rounded-lg bg-[#1cacff]/10 flex items-center justify-center text-[#1cacff] group-hover:bg-[#1cacff] group-hover:text-white transition-all"
      >
        <i :class="['fa-solid', room.icon]"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-center">
          <p class="text-sm font-bold text-[var(--text-main)] truncate">{{ room.name }}</p>
          <span class="text-[10px] text-[var(--text-muted)]">{{ room.count }}명</span>
        </div>
        <p class="text-xs text-[var(--text-muted)] truncate mt-0.5">{{ room.lastMsg }}</p>
      </div>
    </div>
  </div>
</template>
