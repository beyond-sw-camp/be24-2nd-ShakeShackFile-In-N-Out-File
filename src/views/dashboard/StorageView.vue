<script setup>
import FileTable from '@/components/FileTable.vue'

const largeFiles = [
  { name: '최종 프로젝트 영상.mp4', owner: '나', date: '2026. 01. 10.', size: '1.2GB' },
  { name: '고화질 백업 데이터.zip', owner: '나', date: '2025. 12. 25.', size: '850MB' },
]
</script>
<template>
  <div class="max-w-4xl">
    <h2 class="text-xl text-gray-800 font-bold mb-8 text-lg">저장용량</h2>

    <div class="bg-white border border-gray-200 rounded-2xl p-8 mb-10 shadow-sm">
      <div class="flex items-end gap-3 mb-6">
        <span class="text-4xl font-black text-gray-900">6.75GB</span>
        <span class="text-gray-400 pb-1">/ 15GB 사용 중 (45%)</span>
      </div>

      <div class="w-full bg-gray-100 rounded-full h-4 mb-8 overflow-hidden flex">
        <div class="bg-blue-600 h-full" style="width: 30%"></div>
        <div class="bg-indigo-400 h-full" style="width: 10%"></div>
        <div class="bg-gray-300 h-full" style="width: 5%"></div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
          문서 (4.5GB)
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <div class="w-2 h-2 bg-indigo-400 rounded-full"></div>
          이미지 (1.5GB)
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-600">
          <div class="w-2 h-2 bg-gray-300 rounded-full"></div>
          기타 (0.75GB)
        </div>
      </div>
    </div>

    <h3 class="text-sm font-bold text-gray-500 mb-4">용량을 많이 차지하는 항목</h3>
    <FileTable :files="largeFiles" />
  </div>
</template>
