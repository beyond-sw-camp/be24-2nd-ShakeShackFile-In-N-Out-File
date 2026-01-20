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
  <BaseFileView title="내 드라이브" :files="fileStore.driveFiles" @delete="fileStore.moveToTrash">

  </BaseFileView>
</template>