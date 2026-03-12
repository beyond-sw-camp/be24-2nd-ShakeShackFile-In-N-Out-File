<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { initEditor } from '@/components/workspace/editor' 
import postApi from '@/api/postApi'

const editorHolder = ref(null)
const editorApi = ref(null)
const title = ref('')
const remoteCursors = ref({})
const isEditorLoading = ref(false) 

const route = useRoute();
const isValid = computed(() => title.value.trim().length > 0)

// {핵심 추가} 중복 렌더링을 방지하기 위한 셋업 고유 ID
let currentSetupId = 0;

async function handleSave() {
  if (!editorApi.value?.savePost) return
  await editorApi.value.savePost()
}

const isDarkMode = ref(false)
const applyTheme = (isDark) => {
  if (isDark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
}

watch(title, (newVal) => {
  if (editorApi.value?.updateTitleFromLocal) {
    editorApi.value.updateTitleFromLocal(newVal)
  }
})

async function prepareData() {
  const id = route.params.id;
  if (!id || route.path === '/workspace') {
    return { idx: null, title: '', contents: '' };
  }
  if (route.meta.initialData && String(route.meta.initialData.idx) === String(id)) {
    return route.meta.initialData;
  }
  try {
    const response = await postApi.getPost(id);
    return response.data || response; 
  } catch (err) {
    return { idx: id, title: '', contents: '' };
  }
}

async function setupEditor() {
  const setupId = ++currentSetupId; // {추가} 실행될 때마다 고유 ID 발급

  if (!editorHolder.value) return;

  isEditorLoading.value = true;
  const data = await prepareData();

  // {추가} 데이터를 받아오는 비동기 시간 동안 다른 셋업이 시작되었다면 즉시 중단
  if (setupId !== currentSetupId) return;

  title.value = data.title || '';

  // 1. 기존 에디터 자원 해제
  if (editorApi.value) {
    try {
      // {수정} 에디터가 비동기 렌더링 중일 때 파기하면 DOM에 찌꺼기가 남으므로 안전하게 대기
      if (editorApi.value.editor && editorApi.value.editor.isReady) {
        await editorApi.value.editor.isReady;
      }
      await editorApi.value.destroy();
    } catch (e) {}
    editorApi.value = null;
  }

  // 2. DOM 청소 및 상태 초기화
  await nextTick();
  if (editorHolder.value) {
    editorHolder.value.innerHTML = "";
  }

  try {
    // 3. 에디터 초기화
    const newEditorApi = await initEditor(
      editorHolder.value,
      `notion-room-${data.idx ? data.idx : 'new-' + Date.now()}`,
      data.contents,
      data.idx ?? null,
      data.title
    );

    // {추가} 초기화 도중에 라우터가 또 변경되었다면 새로 만든 에디터 즉시 파기
    if (setupId !== currentSetupId) {
      if (newEditorApi.editor && newEditorApi.editor.isReady) {
        await newEditorApi.editor.isReady;
      }
      newEditorApi.destroy();
      return;
    }

    editorApi.value = newEditorApi;

    if (editorApi.value?.bindTitleRef) editorApi.value.bindTitleRef(title);
    if (editorApi.value?.remoteCursorsRef) remoteCursors.value = editorApi.value.remoteCursorsRef.value;
  } catch (error) {
    console.error('에디터 초기화 실패:', error);
  } finally {
    // {수정} 현재 진행 중인 셋업일 때만 로딩 상태 해제
    if (setupId === currentSetupId) {
      isEditorLoading.value = false;
    }
  }
}

onMounted(async () => {
  const savedTheme = localStorage.getItem('theme')
  isDarkMode.value = savedTheme === 'dark' || 
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  applyTheme(isDarkMode.value)
  await setupEditor();
})

watch(() => route.params.id, async () => {
  await setupEditor();
})

watch(() => route.path, async (newPath) => {
  if (newPath === '/workspace') await setupEditor();
})

onBeforeUnmount(async () => {
  if (editorApi.value?.destroy) {
    if (editorApi.value.editor && editorApi.value.editor.isReady) {
      await editorApi.value.editor.isReady;
    }
    await editorApi.value.destroy();
  }
})
</script>

<template>
  <div class="editor-shell">
    <div class="editor-header">
      <input v-model="title" placeholder="제목 없음" class="title-input" />
      <button :disabled="!isValid" @click="handleSave" class="save-btn">저장</button>
    </div>

    <div class="editor-body">
      <div v-if="isEditorLoading" class="loading-overlay">로딩 중...</div>
      <div ref="editorHolder" id="editor-holder" class="editor-holder"></div>

      <div class="cursors-overlay" aria-hidden>
        <div v-for="(c, id) in remoteCursors" :key="id" class="remote-cursor" :style="c.style">
          <div class="cursor-dot" :style="{ background: c.color }"></div>
          <div class="cursor-label" :style="{ background: c.color }">{{ c.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root { --editor-bg: #ffffff; --editor-text: #1f2937; --editor-border: #f0f0f0; --editor-input-bg: #ffffff; }
:global(html.dark) { --editor-bg: #1e1e1e; --editor-text: #e5e7eb; --editor-border: #333333; --editor-input-bg: #2d2d2d; }

.editor-shell {
  max-width: 900px; margin: 24px auto; background: var(--editor-bg);
  color: var(--editor-text); border-radius: 10px; box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  overflow: hidden; transition: background 0.3s, color 0.3s;
}
.editor-header { display:flex; gap:12px; align-items:center; padding:20px; border-bottom:1px solid var(--editor-border); }
.title-input { flex:1; font-size:20px; padding:8px 12px; border-radius:6px; border:1px solid var(--editor-border); background: var(--editor-input-bg); color: var(--editor-text); }
.save-btn { padding:8px 12px; background:#2563eb; color:white; border-radius:6px; cursor:pointer; border: none; }
.save-btn:disabled { background: #94a3b8; cursor: not-allowed; }
.editor-body { position:relative; min-height:60vh; padding:20px; }
.loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; z-index: 10; }
.editor-holder { min-height:48vh; border-radius:8px; border:1px solid var(--editor-border); padding:18px; font-size:16px; background: var(--editor-bg); }

:deep(.ce-block) { color: var(--editor-text); }
:deep(.ce-popover), :deep(.ce-inline-toolbar) { background: var(--editor-input-bg) !important; color: var(--editor-text); border: 1px solid var(--editor-border); }
:deep(.ce-popover__item-icon), :deep(.ce-popover__item-label) { color: var(--editor-text) !important; }

.cursors-overlay { position:absolute; inset: 0; pointer-events:none; }
.remote-cursor { position:fixed; display:flex; align-items:center; gap:8px; z-index:9999; transform:translate(-50%, -120%); }
.cursor-dot { width:12px; height:12px; border-radius:50%; box-shadow:0 0 0 3px rgba(255,255,255,0.6); }
.cursor-label { color:white; font-size:12px; padding:4px 8px; border-radius:6px; }

:deep(.ce-block h1) { font-size: 40px !important; font-weight: 700; }
:deep(.ce-block{data-align="center"}) { text-align: center; }
:deep(.ce-block{data-align="right"})  { text-align: right; }
</style>