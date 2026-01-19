// src/stores/viewStore.js
import { ref } from 'vue'

const viewMode = ref('table') // 'table' 또는 'grid'

export function useViewStore() {
  const setViewMode = (mode) => {
    viewMode.value = mode
  }

  const toggleViewMode = () => {
    viewMode.value = viewMode.value === 'table' ? 'grid' : 'table'
  }

  return {
    viewMode,
    setViewMode,
    toggleViewMode
  }
}