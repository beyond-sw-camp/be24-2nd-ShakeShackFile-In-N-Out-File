<script setup>
import { computed, ref } from 'vue'
import { useFileStore } from '@/stores/useFileStore'
import BaseFileView from '@/components/BaseFileView.vue'

const fileStore = useFileStore()
const isRecommendedOpen = ref(true)

// 추천 파일 데이터 계산
const recommendedFiles = computed(() => {
  return fileStore.recentFiles.slice(0, 4)
})

const downloadFile = (filename) => {
  window.location.href = `/download/${filename}`
}
</script>

<template>
  <BaseFileView 
    title="Drive에 오신 것을 환영합니다" 
    :files="fileStore.allFiles.filter(f => f.type !== 'folder')" 
    @delete="fileStore.moveToTrash"
  >
    <template #header-bottom>
      <div class="mb-10">
        <h3 
          @click="isRecommendedOpen = !isRecommendedOpen" 
          class="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2 cursor-pointer w-fit p-1 hover:bg-gray-50 rounded transition-colors"
        >
          <span 
            class="transition-transform duration-200 inline-block text-[10px]"
            :class="{ '-rotate-90': !isRecommendedOpen }"
          >▼</span>
          추천 파일
        </h3>
        
        <div v-show="isRecommendedOpen">
          <div v-if="recommendedFiles.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div
              v-for="file in recommendedFiles"
              :key="file.id"
              @click="downloadFile(file.name)"
              class="bg-white p-4 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-100 group"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors text-blue-500">
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  </svg>
                </div>
                <div class="overflow-hidden">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ file.name }}</p>
                  <p class="text-[11px] text-gray-400 mt-0.5">{{ file.reason }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-400 mb-10">추천할 파일이 없습니다.</div>
        </div>
      </div>
    </template>
  </BaseFileView>
</template>

<style scoped>
.-rotate-90 {
  transform: rotate(-90deg);
}
</style>