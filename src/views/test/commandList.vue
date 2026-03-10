<template>
  <div class="slash-command-list">
    <button
      v-for="(item, index) in items"
      :key="index"
      class="command-item"
      :class="{ 'is-active': index === selectedIndex }"
      @click="selectItem(index)"
    >
      {{ item.title }}
    </button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  items: Array,
  command: Function,
})

const selectedIndex = ref(0)

watch(() => props.items, () => {
  selectedIndex.value = 0
})

const selectItem = (index) => {
  const item = props.items[index]
  if (item) props.command(item)
}

const onKeyDown = ({ event }) => {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = ((selectedIndex.value + props.items.length - 1) % props.items.length)
    return true
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = ((selectedIndex.value + 1) % props.items.length)
    return true
  }
  if (event.key === 'Enter') {
    selectItem(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<style scoped>
.slash-command-list {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 4px;
  min-width: 180px;
}

.command-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.command-item.is-active, .command-item:hover {
  background-color: #ebf5ff;
  color: #007bff;
}
</style>