<script setup>
import FileTable from '@/components/FileTable.vue'

const homeFiles = [
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },

  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },
  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },

  {
    name: '자주 하는 질문',
    reason: '자주 열어봄',
    owner: '나',
    location: '공유 문서함',
    date: '2025. 12. 12.',
  },  
]

const downloadFile = (filename) => {
  window.location.href = `/download/${filename}`
}
</script>

<template>
  <div>
    <h2 class="text-xl mb-6 text-gray-800">Drive에 오신 것을 환영합니다</h2>

    <div class="mb-10">
      <h3 class="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
        <span>▼</span> 추천 파일
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="i in 4"
          :key="i"
          @click="downloadFile(`recommend${i}.pdf`)"
          class="bg-white p-4 rounded-xl cursor-pointer shadow hover:shadow-md transition-all border border-gray-100"
        >
          <div class="flex items-center gap-3">
            <svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            </svg>
            <p class="text-sm font-medium text-gray-900">추천 문서 {{ i }}.pdf</p>
          </div>
        </div>
      </div>
    </div>

    <FileTable :files="homeFiles" />
  </div>
</template>