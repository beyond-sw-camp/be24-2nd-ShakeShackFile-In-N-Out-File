<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { initEditor } from '@/components/editor' // logic file

// 로컬 상태
const editorHolder = ref(null)
const editorApi = ref(null)
const title = ref('')
const remoteCursors = ref({})

// 편의 computed
const isValid = computed(() => title.value.trim().length > 0)

// 저장 핸들러
async function handleSave() {
  if (!editorApi.value?.savePost) return
  await editorApi.value.savePost()
}

/** 다크모드 로직 **/
const isDarkMode = ref(false)

const applyTheme = (isDark) => {
  if (isDark) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}
// 1. 이 watch 로직을 추가하세요.
watch(title, (newVal) => {
  if (editorApi.value?.__updateOnLocal) {
    // bindTitleRef에서 주입한 헬퍼 함수를 사용하여 Yjs 데이터 업데이트
    editorApi.value.__updateOnLocal(newVal)
  } else if (editorApi.value?.updateTitleFromLocal) {
    // 또는 명시적인 헬퍼 함수 사용
    editorApi.value.updateTitleFromLocal(newVal)
  }
})

onMounted(async () => {
  // 초기 테마 설정 확인
  const savedTheme = localStorage.getItem('theme')
  isDarkMode.value = savedTheme === 'dark' || 
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  applyTheme(isDarkMode.value)

  // 에디터 초기화
  editorApi.value = await initEditor(editorHolder.value, 'notion-room')

  if (editorApi.value?.bindTitleRef) {
    editorApi.value.bindTitleRef(title)
  }

  if (editorApi.value?.remoteCursorsRef) {
    remoteCursors.value = editorApi.value.remoteCursorsRef.value
  }
})

onBeforeUnmount(() => {
  if (editorApi.value?.destroy) editorApi.value.destroy()
})
</script>

<template>
  <div class="editor-shell">
    <div class="editor-header">
      <input v-model="title" placeholder="제목 없음" class="title-input" />

      <button :disabled="!isValid" @click="handleSave" class="save-btn">저장</button>
    </div>

    <div class="editor-body">
      <div ref="editorHolder" id="editor-holder" class="editor-holder"></div>

      <div class="cursors-overlay" aria-hidden>
        <div
          v-for="(c, id) in remoteCursors"
          :key="id"
          class="remote-cursor"
          :style="c.style"
        >
          <div class="cursor-dot" :style="{ background: c.color }"></div>
          <div class="cursor-label" :style="{ background: c.color }">{{ c.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 테마 변수 설정 */
:root {
  --editor-bg: #ffffff;
  --editor-text: #1f2937;
  --editor-border: #f0f0f0;
  --editor-input-bg: #ffffff;
}

:global(html.dark) {
  --editor-bg: #1e1e1e;
  --editor-text: #e5e7eb;
  --editor-border: #333333;
  --editor-input-bg: #2d2d2d;
}

.editor-shell {
  max-width: 900px;
  margin: 24px auto;
  background: var(--editor-bg); /* 변수 적용 */
  color: var(--editor-text);   /* 변수 적용 */
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  overflow: hidden;
  transition: background 0.3s, color 0.3s;
}

.editor-header {
  display:flex;
  gap:12px;
  align-items:center;
  padding:20px;
  border-bottom:1px solid var(--editor-border);
}

.title-input {
  flex:1;
  font-size:20px;
  padding:8px 12px;
  border-radius:6px;
  border:1px solid var(--editor-border);
  background: var(--editor-input-bg);
  color: var(--editor-text);
}

.theme-toggle-btn {
  background: none;
  border: 1px solid var(--editor-border);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--editor-text);
}

.save-btn {
  padding:8px 12px;
  background:#2563eb;
  color:white;
  border-radius:6px;
  cursor:pointer;
  border: none;
}

.editor-body {
  position:relative;
  min-height:60vh;
  padding:20px;
}

.editor-holder {
  min-height:48vh;
  border-radius:8px;
  border:1px solid var(--editor-border);
  padding:18px;
  font-size:16px;
  background: var(--editor-bg);
}

/* Editor.js 다크모드 대응 UI 스타일링 */
:deep(.ce-block) { color: var(--editor-text); }
:deep(.ce-toolbar__content), :deep(.ce-toolbar__actions) { color: var(--editor-text); }
:deep(.ce-popover), :deep(.ce-inline-toolbar), :deep(.ce-settings) {
  background: var(--editor-input-bg) !important;
  border: 1px solid var(--editor-border);
  color: var(--editor-text);
}
:deep(.ce-popover__item-icon), :deep(.ce-popover__item-label), :deep(.ce-inline-tool) {
  color: var(--editor-text) !important;
}
:deep(.ce-popover__item:hover), :deep(.ce-inline-tool:hover) {
  background: rgba(128, 128, 128, 0.2) !important;
}
:deep(.codex-editor__redactor) { caret-color: var(--editor-text); }

/* Cursor overlay */
.cursors-overlay { position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none; }
.remote-cursor { position:fixed; display:flex; align-items:center; gap:8px; z-index:9999; transform:translate(-50%, -120%); }
.cursor-dot { width:12px; height:12px; border-radius:50%; box-shadow:0 0 0 3px rgba(255,255,255,0.6); }
.cursor-label { color:white; font-size:12px; padding:4px 8px; border-radius:6px; }

/* Font size styles */
:deep(.ce-block h1), :deep(.ce-block .ce-header[data-level="1"]) { font-size: 40px !important; font-weight: 700 !important; }
:deep(.ce-block h2), :deep(.ce-block .ce-header[data-level="2"]) { font-size: 32px !important; font-weight: 600 !important; }
:deep(.ce-block h3), :deep(.ce-block .ce-header[data-level="3"]) { font-size: 24px !important; font-weight: 600 !important; }

/* alignment support */
:deep(.ce-block[data-align="center"]) { text-align: center; }
:deep(.ce-block[data-align="right"])  { text-align: right; }
</style>