<script setup>
import FileTable from '@/components/FileTable.vue'

const trashFiles = [
  { name: '오래된 기획안.docx', owner: '나', date: '2025. 12. 01. 삭제됨', size: '150KB' },
  { name: '잘못 찍은 사진.png', owner: '나', date: '2026. 01. 05. 삭제됨', size: '2.4MB' },
]
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl text-gray-800 font-bold text-lg">휴지통</h2>
      <button
        class="text-sm text-blue-600 font-semibold hover:bg-blue-50 px-4 py-2 rounded-lg transition"
      >
        휴지통 비우기
      </button>
    </div>

    <div class="bg-gray-100 p-3 rounded-lg text-xs text-gray-500 mb-6 flex items-center gap-2">
      <i class="fa-solid fa-circle-info"></i>
      휴지통에 있는 항목은 30일 후에 영구적으로 삭제됩니다.
    </div>

    <FileTable :files="trashFiles" type="trash" />
  </div>
</template>
