<script setup>
import { useViewStore } from '@/stores/viewStore'

const props = defineProps({
  files: {
    type: Array,
    required: true
  }
})

const { viewMode, toggleViewMode } = useViewStore()

const downloadFile = (filename) => {
  window.location.href = `/download/${filename}`
}
</script>

<template>
  <div>
    <!-- 뷰 전환 버튼 -->
    <div class="view-controls mb-4 flex justify-end gap-2">
      <button
        @click="toggleViewMode"
        class="p-2 rounded hover:bg-gray-100 transition-colors"
        :class="{ 'bg-gray-100': viewMode === 'table' }"
        title="테이블 뷰"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <button
        @click="toggleViewMode"
        class="p-2 rounded hover:bg-gray-100 transition-colors"
        :class="{ 'bg-gray-100': viewMode === 'grid' }"
        title="그리드 뷰"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </button>
    </div>

    <!-- 테이블 뷰 -->
    <div v-if="viewMode === 'table'" class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              이름
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              표시 이유
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              소유자
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              위치
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              수정한 날짜
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="(file, index) in files"
            :key="index"
            @click="downloadFile(file.name)"
            class="hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                </svg>
                <span class="text-sm font-medium text-gray-900">{{ file.name }}</span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="text-sm text-gray-500">{{ file.reason }}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="text-sm text-gray-500">{{ file.owner }}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="text-sm text-gray-500">{{ file.location }}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="text-sm text-gray-500">{{ file.date }}</span>
            </td>
          </tr>
        </tbody>
      </table> 
    </div>

    <!-- 그리드 뷰 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6  gap-4">
      <div
        v-for="(file, index) in files"
        :key="index"
        @click="downloadFile(file.name)"
        class="bg-white p-5 rounded-xl shadow hover:shadow-md cursor-pointer transition-all border border-gray-100"
      >
        <div class="flex items-start mb-3">
          <svg class="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        </div>
        <h4 class="text-sm font-medium text-gray-900 mb-2 truncate">{{ file.name }}</h4>
        <div class="space-y-1">
          <p class="text-xs text-gray-500">{{ file.reason }}</p>
          <p class="text-xs text-gray-500">소유자: {{ file.owner }}</p>
          <p class="text-xs text-gray-500">{{ file.location }}</p>
          <p class="text-xs text-gray-400">{{ file.date }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-controls button {
  border: 1px solid #e5e7eb;
}
</style>