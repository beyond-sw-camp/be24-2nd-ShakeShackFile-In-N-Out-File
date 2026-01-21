<script setup>
import { onMounted } from 'vue'
import { useEditorSocket, save } from '@/components/editor' 

// editor.js에서 반환된 값들 사용
const { initEditor, title, remoteMice, editor, status } = useEditorSocket()
const { isFormValid, savePost } = save()

onMounted(() => {
  // id="editor"인 div에 에디터를 마운트합니다.
  initEditor('editor')
})
</script>

<template>
  <div class="page-container">
    <header class="top-bar">
      <input
        v-model="title"
        type="text"
        placeholder="제목을 입력하세요"
        class="title-input"
      />
      
      <div class="actions">
        <div class="status-indicator">
          <span class="dot" :class="status"></span>
          {{ status === 'connected' ? '연결됨' : '연결 중...' }}
        </div>
        
        <button
          :disabled="!isFormValid"
          @click="savePost()"
          class="btn-save"
        >
          저장하기
        </button>
      </div>
    </header>

    <div v-if="editor" class="toolbar">
      <div class="toolbar-group">
        <button 
          @click="editor.chain().focus().toggleBold().run()"
          :class="{ 'is-active': editor.isActive('bold') }"
        >Bold</button>
        <button 
          @click="editor.chain().focus().toggleItalic().run()"
          :class="{ 'is-active': editor.isActive('italic') }"
        >Italic</button>
        <button 
          @click="editor.chain().focus().toggleStrike().run()"
          :class="{ 'is-active': editor.isActive('strike') }"
        >Strike</button>
      </div>
      
      <div class="divider"></div>
      
      <div class="toolbar-group">
        <button 
          @click="editor.chain().focus().toggleBulletList().run()"
          :class="{ 'is-active': editor.isActive('bulletList') }"
        >Bullet List</button>
        <button 
          @click="editor.chain().focus().toggleHighlight().run()"
          :class="{ 'is-active': editor.isActive('highlight') }"
        >Highlight</button>
      </div>
    </div>

    <div class="editor-wrapper">
      <div id="editor" class="tiptap-editor"></div>
    </div>

    <div
      v-for="(mouse, id) in remoteMice"
      :key="id"
      class="remote-mouse"
      :style="{
        left: mouse.left + 'px',
        top: mouse.top + 'px',
        '--user-color': mouse.color
      }"
    >
      <svg class="cursor-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19011L11.7116 12.3673H5.65376Z" fill="var(--user-color)" stroke="white"/>
      </svg>
      <span class="user-label" :style="{ backgroundColor: mouse.color }">
        {{ mouse.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* 기본 폰트 설정 (한글 깨짐 방지) */
.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
}

/* 헤더 스타일 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f1f3f5;
}

.title-input {
  font-size: 32px;
  font-weight: 700;
  border: none;
  outline: none;
  background: transparent;
  width: 60%;
  color: #333;
}
.title-input::placeholder { color: #adb5bd; }

.actions { display: flex; align-items: center; gap: 16px; }

.status-indicator {
  font-size: 14px;
  color: #868e96;
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
.dot.connected { background: #40c057; }
.dot.connecting { background: #fab005; }

.btn-save {
  background-color: #228be6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-save:disabled { background-color: #dee2e6; cursor: not-allowed; }
.btn-save:enabled:hover { background-color: #1c7ed6; }

/* 툴바 스타일 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
  border: 1px solid #e9ecef;
  border-bottom: none;
}

.toolbar button {
  padding: 6px 12px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  font-weight: 600;
  color: #495057;
  cursor: pointer;
}
.toolbar button:hover { background: #e9ecef; }
.toolbar button.is-active { background: #e7f5ff; color: #1971c2; }
.divider { width: 1px; height: 20px; background: #dee2e6; margin: 0 8px; }

/* 에디터 스타일 */
.editor-wrapper {
  border: 1px solid #e9ecef;
  border-radius: 0 0 8px 8px;
  min-height: 500px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* Tiptap 내부 스타일 (Deep Selector 사용) */
:deep(.tiptap) {
  min-height: 500px;
  padding: 40px;
  outline: none;
  font-size: 16px;
  line-height: 1.6;
  
  /* ProseMirror 경고 해결을 위한 핵심 스타일 */
  white-space: pre-wrap; 
  word-wrap: break-word;
}

:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #ced4da;
  pointer-events: none;
  height: 0;
}

/* 마우스 커서 스타일 */
.remote-mouse {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 9999;
  transition: top 0.1s, left 0.1s;
}
.cursor-icon { width: 24px; height: 24px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); }
.user-label {
  position: absolute;
  top: 20px;
  left: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  font-size: 11px;
  font-weight: bold;
  white-space: nowrap;
}
</style>