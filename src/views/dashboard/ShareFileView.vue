<script setup>
import FileTable from '@/components/FileTable.vue'

// 공유한 사람의 정보가 포함된 데이터
const sharedFiles = [
  {
    name: 'BEYOND SW캠프_24기_학습콘텐츠',
    owner: 'ebizgosu@gmail.com',
    date: '2025. 12. 12.',
    size: '5KB',
  },
  { name: '프로젝트 가이드.pdf', owner: 'mentor@gmail.com', date: '2026. 01. 10.', size: '1.1MB' },
]
</script>
<template>
  <div>
    <h2 class="text-xl mb-6 text-gray-800">공유 문서함</h2>
    <FileTable :files="sharedFiles" type="shared" />
  </div>
</template>
