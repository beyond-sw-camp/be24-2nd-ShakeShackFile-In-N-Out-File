<template>
  <div v-if="editor" class="notion-container">
    
    <div class="tippy-wrapper">
      <bubble-menu 
        :editor="editor" 
        :tippy-options="{ 
          duration: 100, 
          appendTo: 'parent',
          maxWidth: 'none'
        }"
      >
        <div class="bubble-menu-wrapper">
          <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'is-active': editor.isActive('bold') }">
            <strong>B</strong>
          </button>
          <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'is-active': editor.isActive('italic') }">
            <em>I</em>
          </button>
          <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'is-active': editor.isActive('strike') }">
            <s>S</s>
          </button>
          <button @click="editor.chain().focus().toggleCode().run()" :class="{ 'is-active': editor.isActive('code') }">
            Code
          </button>
        </div>
      </bubble-menu>
    </div>

    <div class="tippy-wrapper">
      <floating-menu 
        :editor="editor" 
        :tippy-options="{ 
          duration: 100,
          appendTo: 'parent'
        }"
      >
        <div class="floating-menu-wrapper">
          <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }">H1</button>
          <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }">H2</button>
          <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'is-active': editor.isActive('bulletList') }">Bullet</button>
          <button @click="editor.chain().focus().toggleTaskList().run()" :class="{ 'is-active': editor.isActive('taskList') }">Todo</button>
          <button @click="addImage">Image</button>
        </div>
      </floating-menu>
    </div>

    <editor-content :editor="editor" />

    <div class="editor-footer">
      {{ editor.storage.characterCount.characters() }} 자 작성됨
    </div>
  </div>
</template>

<script setup>
import { BubbleMenu, FloatingMenu, EditorContent } from '@tiptap/vue-3'
import { useTiptapEditor } from './tiptap.js'
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['update:modelValue'])

const editor = useTiptapEditor(props.modelValue)

watch(() => props.modelValue, (newValue) => {
  const isSame = editor.value.getHTML() === newValue
  if (!isSame) {
    editor.value.commands.setContent(newValue, false)
  }
})

editor.value?.on('update', () => {
  emit('update:modelValue', editor.value.getHTML())
})

onBeforeUnmount(() => {
  editor.value.destroy()
})

const addImage = () => {
  const url = window.prompt('이미지 URL을 입력하거나 S3 연동을 시작하세요')
  if (url) {
    editor.value.chain().focus().setImage({ src: url }).run()
  }
}
</script>

<style scoped>
.notion-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

:deep(.notion-editor-area) {
  min-height: 500px;
  outline: none;
  font-family: 'Inter', -apple-system, sans-serif;
  color: #37352f;
  line-height: 1.5;
}

:deep(.notion-editor-area p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #adb5bd;
  pointer-events: none;
  height: 0;
}

.bubble-menu-wrapper, .floating-menu-wrapper {
  display: flex;
  background-color: #ffffff;
  border: 1px solid #e2e2e2;
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
  gap: 2px;
}

button {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  color: #444;
  transition: background 0.2s;
}

button:hover {
  background-color: #f1f1f1;
}

button.is-active {
  background-color: #ebf5ff;
  color: #007bff;
}

.editor-footer {
  margin-top: 20px;
  font-size: 12px;
  color: #999;
  text-align: right;
  border-top: 1px solid #eee;
  padding-top: 10px;
}

.tippy-wrapper {
  display: inline-block;
}
</style>