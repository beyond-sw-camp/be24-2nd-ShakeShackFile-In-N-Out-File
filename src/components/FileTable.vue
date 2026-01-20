<script setup>
import { useViewStore } from '@/stores/viewStore'
import { useFileStore } from '@/stores/useFileStore' // Store 임포트

const props = defineProps({
  files: {
    type: Array,
    required: true
  }
})

const fileStore = useFileStore() // Store 인스턴스 생성
const emit = defineEmits(['delete-file'])

const onClickDelete = (index, event) => {
  event.stopPropagation()
  if (confirm('이 항목을 삭제하시겠습니까?')) {
    emit('delete-file', index)
  }
}

const { viewMode, toggleViewMode } = useViewStore()

const downloadFile = (filename) => {
  window.location.href = `/download/${filename}`
}

// --- 드래그 앤 드롭 핸들러 ---

const onDragStart = (event, fileId) => {
  // 드래그하는 파일의 ID를 저장 (문자열로 저장됨)
  event.dataTransfer.setData('fileId', fileId.toString());
  // 드래그 시각 효과
  event.currentTarget.classList.add('opacity-50');
}

const onDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
}

const onDrop = (event, folderId) => {
  const fileId = parseInt(event.dataTransfer.getData('fileId'));
  
  // 자기 자신(폴더)을 자기 자신에게 드롭하는 것 방지
  if (fileId === folderId) return;

  // Store에 미리 만들어둔 이동 함수 호출
  if (fileStore.moveFileToFolder) {
    fileStore.moveFileToFolder(fileId, folderId);
  }
}
</script>

<template>
  <div>
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

    <div v-if="viewMode === 'table'" class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">표시 이유</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">소유자</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">위치</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수정한 날짜</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="(file, index) in files"
            :key="file.id"
            @click="file.type !== 'folder' ? downloadFile(file.name) : null"
            @dblclick="file.type === 'folder' ? fileStore.enterFolder(file.id) : null"
            :draggable="file.type !== 'folder'"
            @dragstart="onDragStart($event, file.id)"
            @dragend="onDragEnd"
            @dragover.prevent
            @drop="file.type === 'folder' ? onDrop($event, file.id) : null"
            
            class="hover:bg-gray-50 cursor-pointer transition-colors group"
            :class="{ 'bg-blue-50/30': file.type === 'folder' }"
          >
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <svg v-if="file.type === 'folder'" class="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <svg v-else class="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                </svg>
                <span class="text-sm font-medium text-gray-900">{{ file.name }}</span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ file.reason }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ file.owner }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ file.location }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ file.date }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
              <button @click="onClickDelete(index, $event)" class="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table> 
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <div
        v-for="(file, index) in files"
        :key="file.id"
        @click="file.type !== 'folder' ? downloadFile(file.name) : null"
        :draggable="file.type !== 'folder'"
        @dragstart="onDragStart($event, file.id)"
        @dragend="onDragEnd"
        @dragover.prevent
        @drop="file.type === 'folder' ? onDrop($event, file.id) : null"
        @dblclick="file.type === 'folder' ? fileStore.enterFolder(file.id) : null"

        class="relative bg-white p-5 rounded-xl shadow hover:shadow-md cursor-pointer transition-all border border-gray-100 group"
        :class="{ 'border-blue-200 bg-blue-50/10': file.type === 'folder' }"
      >
        <button 
          @click="onClickDelete(index, $event)"
          class="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div class="flex items-start mb-3">
          <svg v-if="file.type === 'folder'" class="w-10 h-10 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <svg v-else class="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
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
/* 드래그 중인 폴더 위에 올라왔을 때 강조 효과 */
.bg-blue-50\/30 {
  border-left: 4px solid #3b82f6;
}
</style>