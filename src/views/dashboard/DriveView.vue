<script setup>
import FileTable from '@/components/FileTable.vue'
const driveFiles = [
  { name: '프로젝트 제안서.pdf', owner: '나', date: '2026. 01. 12.', size: '1.2MB' },
]
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl text-gray-800">내 드라이브</h2>
      <div class="flex gap-2">
        <button
          v-for="f in ['유형', '사람', '수정 날짜']"
          :key="f"
          class="px-3 py-1 border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
        >
          {{ f }} ▼
        </button>
      </div>
    </div>
    <FileTable :files="driveFiles" />
  </div>
</template>
