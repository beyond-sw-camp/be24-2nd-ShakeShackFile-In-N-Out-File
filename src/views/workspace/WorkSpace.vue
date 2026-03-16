<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { initEditor } from '@/components/workspace/editor' 
import postApi from '@/api/postApi'

const editorHolder = ref(null)
const editorApi = ref(null)
const title = ref('')
const isEditorLoading = ref(false) 
const showUserList = ref(false) // 사용자 목록 팝업 노출 여부

const route = useRoute();
const router = useRouter(); 
const isValid = computed(() => title.value.trim().length > 0)

// 에디터에서 관리하는 실시간 데이터 연결
const remoteCursors = computed(() => editorApi.value?.remoteCursorsRef || {})
const activeUsers = computed(() => editorApi.value?.activeUsersRef || [])

let currentSetupId = 0;

async function handleSave() {
  if (!editorApi.value?.savePost) return
  const response = await editorApi.value.savePost()
  router.push(`/workspace/read/${response.result.body.idx}`)
}

// ✨ 특정 사용자의 권한을 변경하고 저장하는 로직
function handlePermissionChange(clientId, event) {
  const newStatus = event.target.value;
  if (editorApi.value?.updateUserPermission) {
    // 권한을 'redirect'로 설정하여 즉시 내보내기 신호를 보냄
    editorApi.value.updateUserPermission(clientId, newStatus);
    alert('권한 설정이 저장되었습니다.');
  }
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
    return { idx: null, title: '', contents: '', type: false };
  }
  if (route.meta.initialData && String(route.meta.initialData.idx) === String(id)) {
    return route.meta.initialData;
  }
  try {
    const response = await postApi.getPost(id);
    // result.body 구조에 맞춰 데이터 추출
    return response.result?.body || response.data || response; 
  } catch (err) {
    return { idx: id, title: '', contents: '', type: false };
  }
}

async function setupEditor() {
  const setupId = ++currentSetupId;
  if (!editorHolder.value) return;
  isEditorLoading.value = true;
  const data = await prepareData();
  if (setupId !== currentSetupId) return;
  title.value = data.title || '';

  if (editorApi.value) {
    try {
      if (editorApi.value.editor && editorApi.value.editor.isReady) {
        await editorApi.value.editor.isReady;
      }
      await editorApi.value.destroy();
    } catch (e) {}
    editorApi.value = null;
  }

  await nextTick();
  if (editorHolder.value) {
    editorHolder.value.innerHTML = "";
  }

  try {
    const newEditorApi = await initEditor(
      editorHolder.value,
      `notion-room-${data.idx ? data.idx : 'new-' + Date.now()}`,
      data.contents,
      data.idx ?? null,
      data.title,
      data.type // 서버에서 받아온 type (true/false) 전달
    );

    if (setupId !== currentSetupId) {
      if (newEditorApi.editor && newEditorApi.editor.isReady) {
        await newEditorApi.editor.isReady;
      }
      newEditorApi.destroy();
      return;
    }
    editorApi.value = newEditorApi;
    if (editorApi.value?.bindTitleRef) editorApi.value.bindTitleRef(title);
  } catch (error) {
    console.error('에디터 초기화 실패:', error);
  } finally {
    if (setupId === currentSetupId) {
      isEditorLoading.value = false;
    }
  }
}

async function checkAndRedirectUuid() {
  const uuid = route.query.uuid;
  if (route.path.includes('/invite') && uuid) {
    try {
      const response = await postApi.getPostByUuid(uuid); 
      const data = response.result?.body || response.data || response;
      if (data && data.idx) {
        await router.replace({ name: 'workspace_read', params: { id: data.idx } });
        return true; 
      } else {
        throw new Error("게시글 정보가 없습니다.");
      }
    } catch (error) {
      console.error('UUID로 게시글을 찾을 수 없습니다.', error);
      await router.replace('/workspace');
      return true;
    }
  }
  return false; 
}

onMounted(async () => {
  const savedTheme = localStorage.getItem('theme')
  isDarkMode.value = savedTheme === 'dark' || 
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  applyTheme(isDarkMode.value)
  const isRedirected = await checkAndRedirectUuid();
  if (!isRedirected) {
    await setupEditor();
  }
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
      
      <div class="user-presence-wrapper">
        <button class="presence-toggle-btn" @click="showUserList = !showUserList">
          <span class="user-count-badge">{{ activeUsers.length }}</span>
          사용자 목록
        </button>

        <div v-if="showUserList" class="user-list-popover">
          <div class="popover-title">참여 중인 사용자</div>
          <div class="user-item-list">
            <div v-for="user in activeUsers" :key="user.clientId" class="user-item">
              <div class="user-avatar" :style="{ background: user.color }">
                {{ user.name.charAt(0) }}
              </div>
              <div class="user-info">
                <div class="user-name">
                  {{ user.name }} <span v-if="user.isMe" class="me-tag">(나)</span>
                </div>
                <select 
                  v-if="!user.isMe" 
                  class="permission-select" 
                  @change="handlePermissionChange(user.clientId, $event)"
                >
                  <option value="edit">편집 가능</option>
                  <option value="redirect">권한 회수 (내보내기)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button :disabled="!isValid" @click="handleSave" class="save-btn">저장</button>
    </div>

    <div class="editor-body">
      <div v-if="isEditorLoading" class="loading-overlay">로딩 중...</div>
      <div ref="editorHolder" id="editor-holder" class="editor-holder"></div>
    </div>

    <div class="cursors-overlay" aria-hidden>
      <div v-for="(c, id) in remoteCursors" :key="id" class="remote-cursor" :style="c.style">
        <svg class="cursor-pointer" width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2L16 11L9 13L13 20L10 22L6 15L2 19V2Z" :fill="c.color" stroke="white" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <div class="cursor-label" :style="{ background: c.color }">{{ c.name }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root { --editor-bg: #ffffff; --editor-text: #1f2937; --editor-border: #f0f0f0; --editor-input-bg: #ffffff; }
:global(html.dark) { --editor-bg: #1e1e1e; --editor-text: #e5e7eb; --editor-border: #333333; --editor-input-bg: #2d2d2d; }

.editor-shell {
  position: relative;
  overflow: visible; /* 팝업이 보일 수 있도록 수정 */
  max-width: 900px; margin: 24px auto; background: var(--editor-bg);
  color: var(--editor-text); border-radius: 10px; box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  transition: background 0.3s, color 0.3s;
}

.editor-header { display:flex; gap:12px; align-items:center; padding:20px; border-bottom:1px solid var(--editor-border); }
.title-input { flex:1; font-size:20px; padding:8px 12px; border-radius:6px; border:1px solid var(--editor-border); background: var(--editor-input-bg); color: var(--editor-text); }
.save-btn { padding:8px 12px; background:#2563eb; color:white; border-radius:6px; cursor:pointer; border: none; }
.save-btn:disabled { background: #94a3b8; cursor: not-allowed; }

/* 👥 사용자 목록 스타일 */
.user-presence-wrapper { position: relative; }
.presence-toggle-btn { 
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; 
  background: var(--editor-input-bg); border: 1px solid var(--editor-border); 
  border-radius: 6px; cursor: pointer; color: var(--editor-text); font-size: 14px;
}
.user-count-badge { background: #2ecc71; color: white; border-radius: 10px; padding: 1px 6px; font-size: 11px; font-weight: bold; }

.user-list-popover {
  position: absolute; top: 45px; right: 0; width: 240px; 
  background: var(--editor-bg); border: 1px solid var(--editor-border); 
  border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 1000; padding: 16px;
}
.popover-title { font-size: 12px; color: #888; margin-bottom: 12px; font-weight: 600; }
.user-item { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.user-avatar { 
  width: 32px; height: 32px; border-radius: 50%; display: flex; 
  align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;
}
.user-info { flex: 1; }
.user-name { font-size: 14px; font-weight: 500; }
.me-tag { font-size: 11px; color: #888; }
.permission-select { 
  display: block; width: 100%; margin-top: 4px; font-size: 11px; 
  background: transparent; border: none; color: #2563eb; cursor: pointer;
}

.editor-body { position:relative; min-height:60vh; padding:20px; }
.loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; z-index: 10; }
.editor-holder { min-height:48vh; border-radius:8px; border:1px solid var(--editor-border); padding:18px; font-size:16px; background: var(--editor-bg); }

.cursors-overlay { position:absolute; inset: 0; pointer-events:none; z-index: 100; }

/* 🚀 커서 최적화: Transition 제거 및 GPU 가속 사용 */
.remote-cursor { 
  position:absolute; 
  display:flex; 
  align-items:flex-start;
  /* 뺑뺑 돌릴 때 지연을 없애기 위해 transition: none 설정 */
  transition: none !important;
  will-change: transform;
}
.cursor-pointer {
  position: absolute;
  top: -2px; left: -2px;
  filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));
}
.cursor-label { 
  color:white; font-size:12px; font-weight: 500;
  padding:3px 8px; border-radius:12px;
  white-space: nowrap; margin-top: 18px; margin-left: 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

:deep(.ce-block h1) { font-size: 40px !important; font-weight: 700; }
</style>