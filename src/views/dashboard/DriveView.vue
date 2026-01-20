<script setup>
import BaseFileView from '@/components/BaseFileView.vue'
import { useFileStore } from '@/stores/useFileStore'

const fileStore = useFileStore()

const addNewFolder = () => {
  const name = prompt("새 폴더의 이름을 입력하세요", "제목 없는 폴더")
  if (name) {
    fileStore.createFolder(name)
  }
}
</script>

<template>
  <BaseFileView 
    title="내 드라이브" 
    :files="fileStore.driveFiles" 
    @delete="fileStore.moveToTrash"
  >
  <template #header-left>
      <button 
        v-if="fileStore.currentFolderId" 
        @click="fileStore.goBack"
        class="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
      >
        <i class="fa-solid fa-arrow-left"></i>
        이전으로
      </button>
    </template>
    <template #header-right>
      <button 
        @click="addNewFolder"
        class="flex items-center gap-2 bg-white border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition"
      >
        <i class="fa-solid fa-folder-plus text-blue-500"></i>
        새 폴더
      </button>
    </template>
  </BaseFileView>
</template>