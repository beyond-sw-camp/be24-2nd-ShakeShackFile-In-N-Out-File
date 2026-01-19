<script setup>
import FileTable from '@/components/FileTable.vue'

const recentFiles = [
  { name: '한화 24기_이선엽.jpg', location: '내 드라이브', date: '2025. 11. 19. 업로드됨' },
]

const olderFiles = [{ name: '연습장.txt', location: '공유 문서함', date: '2024. 12. 03.' }]
</script>
<template>
  <div>
    <h2 class="text-xl mb-6 text-gray-800">최근 문서함</h2>

    <div class="space-y-8">
      <section>
        <h3 class="text-xs font-semibold text-gray-500 mb-4">지난달</h3>
        <FileTable :files="recentFiles" type="recent" />
      </section>

      <section>
        <h3 class="text-xs font-semibold text-gray-500 mb-4">예전</h3>
        <FileTable :files="olderFiles" type="recent" />
      </section>
    </div>
  </div>
</template>
