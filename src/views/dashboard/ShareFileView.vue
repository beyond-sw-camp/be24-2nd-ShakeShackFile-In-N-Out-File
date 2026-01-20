<script setup>
import BaseFileView from '@/components/BaseFileView.vue'
import { useFileStore } from '@/stores/useFileStore'

const fileStore = useFileStore()
</script>

<template>
  <BaseFileView 
    title="공유 문서함" 
    :files="fileStore.sharedFiles" 
    @delete="fileStore.moveToTrash" 
  />
</template>