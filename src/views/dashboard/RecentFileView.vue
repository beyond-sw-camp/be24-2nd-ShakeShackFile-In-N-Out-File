<script setup>
import { computed } from 'vue'
import BaseFileView from '@/components/BaseFileView.vue'
import { useFileStore } from '@/stores/useFileStore'

const fileStore = useFileStore()

// 날짜 계산 로직
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const recentFilesMonth = computed(() => 
  fileStore.recentFiles.filter(f => new Date(f.lastModified) >= thirtyDaysAgo)
)
const olderFiles = computed(() => 
  fileStore.recentFiles.filter(f => new Date(f.lastModified) < thirtyDaysAgo)
)
</script>

<template>
  <div class="space-y-10">
    <BaseFileView 
      title="최근 문서함 (지난달)" 
      :files="recentFilesMonth" 
      @delete="fileStore.moveToTrash" 
    />

    <BaseFileView 
      title="예전" 
      :files="olderFiles" 
      @delete="fileStore.moveToTrash" 
    />
  </div>
</template>