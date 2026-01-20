<script setup>
import { onMounted } from 'vue'
import { useEditorSocket, save } from '@/components/editor' // 경로 확인하세요!
import 'quill/dist/quill.snow.css'

// 로직 호출 (반드시 최상단에서)
const { initEditor, title, remoteMice } = useEditorSocket()
const { isFormValid, savePost } = save()

onMounted(() => {
  // 실제 DOM이 렌더링된 후 에디터 초기화
  initEditor('#editor', 'ws')
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-4">
    <div class="flex items-end justify-between border-b border-gray-200 pb-2">
      <input
        v-model="title"
        type="text"
        placeholder="제목을 입력하세요"
        class="w-full text-4xl font-bold outline-none placeholder:text-gray-300 bg-transparent"
      />

      <button
        :disabled="!isFormValid"
        @click="savePost()"
        class="ml-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap shadow-md disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed enabled:bg-blue-600 enabled:text-white enabled:hover:bg-blue-700"
      >
        저장하기
      </button>
    </div>
  </div>
  <div id="editor" class="flex-1 overflow-y-auto p-8 transition-all duration-300"></div>
  <div
    v-for="(mouse, id) in remoteMice"
    :key="id"
    class="mouse"
    :style="{
      left: mouse.left + 'px',
      top: mouse.top + 'px',
      '--mouse-color': mouse.color // CSS 변수로 색상 전달
    }"
  >
  <svg
      class="mouse-pointer"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19011L11.7116 12.3673H5.65376Z"
        fill="var(--mouse-color)"
        stroke="white"
        stroke-width="1"
      />
    </svg>
    
    <div class="mouse-name">
      {{ mouse.name }}
    </div>
  </div>
</template>

<style scoped>
/* 마우스 전체 컨테이너 */
.mouse {
  position: fixed;
  pointer-events: none;
  z-index: 10000;
  top: 0;
  left: 0;
  transition: all 0.1s ease-out; /* 부드러운 움직임 */
  will-change: left, top; /* 성능 최적화 */
}

/* 커서 (SVG) */
.mouse-pointer {
  /* SVG 자체에 색상과 테두리가 적용됨 */
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); /* 살짝 그림자 추가 */
}

/* 이름표 */
.mouse-name {
  position: absolute;
  top: 18px; /* 커서 아래쪽에 위치 */
  left: 10px; /* 커서 오른쪽에 살짝 걸치게 */
  background-color: var(--mouse-color);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.editor-paper {
  background: white;
  color: #1a1a1a;
}
.title-wrapper {
  background: white;
  /* color: white; */
  width: 50px;
}
</style>
