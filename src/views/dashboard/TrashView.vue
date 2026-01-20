<script setup>
import BaseFileView from '@/components/BaseFileView.vue'
import { useFileStore } from '@/stores/useFileStore'

const fileStore = useFileStore()

// 휴지통 전용 영구 삭제 로직
const handlePermanentDelete = (id) => {
  if (confirm('이 항목을 영구적으로 삭제하시겠습니까?')) {
    const index = fileStore.allFiles.findIndex(f => f.id === id)
    if (index !== -1) fileStore.allFiles.splice(index, 1)
  }
}

// 휴지통 비우기
const handleClearTrash = () => {
  if (confirm('휴지통의 모든 항목을 영구 삭제하시겠습니까?')) {
    fileStore.allFiles = fileStore.allFiles.filter(f => !f.isTrash)
  }
}
</script>

<template>
  <BaseFileView 
    title="휴지통" 
    :files="fileStore.trashFiles" 
    :showEmpty="true"
    @delete="handlePermanentDelete"
  >
    <template #header-right>
      <button @click="handleClearTrash" class="text-sm text-blue-600 font-semibold hover:bg-blue-50 px-4 py-2 rounded-lg">
        휴지통 비우기
      </button>
    </template>

    <template #header-bottom>
      <div class="bg-gray-100 p-3 rounded-lg text-xs text-gray-500 mb-6 flex items-center gap-2">
        <i class="fa-solid fa-circle-info"></i>
        휴지통에 있는 항목은 30일 후에 영구적으로 삭제됩니다.
      </div>
    </template>
  </BaseFileView>
</template>