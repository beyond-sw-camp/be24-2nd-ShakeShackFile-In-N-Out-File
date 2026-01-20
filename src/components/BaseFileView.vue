<script setup>
import { onMounted } from 'vue'
import { useFileStore } from '@/stores/useFileStore'
import FileTable from '@/components/FileTable.vue'

const props = defineProps({
  title: String,
  files: Array,      
  showEmpty: Boolean,
  /**
   * 필터 아이템 목록
   */
  filters: {
    type: Array,
    default: () => [
      { label: '유형', value: 'all' },
      { label: '사람', value: 'processing' },
      { label: '수정 날짜', value: 'completed' },
    ]
  },
  /**
   * 현재 활성화된 필터 값
   */
  activeFilter: {
    type: [String, Number],
    default: '' 
  }
})

const fileStore = useFileStore()
const emit = defineEmits(['delete', 'filter-change'])

onMounted(() => {
  if (fileStore.allFiles.length === 0) {
    fileStore.fetchFiles() // 데이터가 없을 때 로드
  }
})

const handleDelete = (index) => {
  const targetFile = props.files[index]
  if (targetFile) {
    emit('delete', targetFile.id) // 부모에게 id 전달하여 삭제 실행
  }
}

/**
 * 필터 클릭 이벤트 핸들러
 */
const handleFilterClick = (value) => {
  emit('filter-change', value)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-y-2">
      <div class="flex items-center gap-4">
        <h2 class="text-xl text-gray-800 font-bold leading-none shrink-0">{{ title }}</h2>
        <slot name="header-left"></slot>
      </div>
      <div class="flex items-center gap-2">
        <slot name="header-right"></slot> 
      </div>
    </div>
    
    <!-- 필터 아이템 섹션 -->
    <div v-if="filters.length > 0" class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        @click="handleFilterClick(filter.value)"
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border cursor-pointer select-none flex items-center gap-1"
        :class="[
          activeFilter === filter.value
            ? 'bg-gray-100 border-gray-600 text-gray-900 font-semibold' 
            : 'bg-white border-gray-400 text-gray-600 hover:bg-gray-50'
        ]"
      >
        <span>{{ filter.label }}</span>
        <!-- 역삼각형 아이콘 추가 -->
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="3" 
          stroke-linecap="round" 
          stroke-linejoin="round"
          class="mt-0.5"
          :class="activeFilter === filter.value ? 'text-gray-900' : 'text-gray-400'"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
    </div>
    
    <slot name="header-bottom"></slot>

    <div v-if="files.length > 0">
      <FileTable :files="files" @delete-file="handleDelete" />
    </div>
    <div v-else-if="showEmpty" class="text-center py-20 text-gray-400">
      항목이 비어 있습니다.
    </div>
  </div>
</template>

<style scoped>
/* 가로 스크롤 방지 및 인터랙션 최적화 */
.flex-wrap {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.flex-wrap::-webkit-scrollbar {
  display: none;
}
button {
  -webkit-tap-highlight-color: transparent;
  outline: none;
}
</style>