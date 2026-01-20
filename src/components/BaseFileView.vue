<script setup>
import { onMounted } from 'vue'
import { useFileStore } from '@/stores/useFileStore'
import FileTable from '@/components/FileTable.vue'

const props = defineProps({
  title: String,
  files: Array,      
  showEmpty: Boolean 
})

const fileStore = useFileStore()
const emit = defineEmits(['delete'])

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
    
    <slot name="header-bottom"></slot>

    <div v-if="files.length > 0">
      <FileTable :files="files" @delete-file="handleDelete" />
    </div>
    <div v-else-if="showEmpty" class="text-center py-20 text-gray-400">
      항목이 비어 있습니다.
    </div>
  </div>
</template>