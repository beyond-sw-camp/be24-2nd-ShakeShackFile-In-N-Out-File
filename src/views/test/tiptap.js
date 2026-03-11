import { useEditor, VueRenderer, Extension } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import CharacterCount from '@tiptap/extension-character-count'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'

// --- Lowlight 설정 (common 언어팩 자동 등록) ---
import { common, createLowlight } from 'lowlight'
const resolvedLowlight = createLowlight(common)

import commands from './commands.js'
import CommandList from './commandList.vue'

// 1. 슬래시 커맨드 전용 익스텐션을 별도로 만듭니다. (에러 방지 핵심)
const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        items: commands.items,
        render: () => {
          let component
          let popup

          return {
            onStart: props => {
              component = new VueRenderer(CommandList, { props, editor: props.editor })
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              })
            },
            onUpdate: props => {
              component.updateProps(props)
              popup[0].setProps({ getReferenceClientRect: props.clientRect })
            },
            onKeyDown: props => {
              if (props.event.key === 'Escape') {
                popup[0].hide()
                return true
              }
              return component.ref?.onKeyDown(props)
            },
            onExit: () => {
              popup[0].destroy()
              component.destroy()
            },
          }
        },
      }),
    ]
  },
})

// 2. 에디터 설정
export const useTiptapEditor = (initialContent = '') => {
  return useEditor({
    content: initialContent,
    extensions: [
      // StarterKit은 기본 옵션만 설정
      StarterKit.configure({
        codeBlock: false, // lowlight 사용을 위해 꺼둠
      }),
      Placeholder.configure({
        placeholder: "명령어를 사용하려면 '/'를 입력하세요...",
      }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ 
        lowlight: resolvedLowlight 
      }),
      CharacterCount,
      // 아까 만든 슬래시 커맨드 익스텐션을 여기에 추가
      SlashCommand,
    ],
    editorProps: {
      attributes: {
        class: 'prose focus:outline-none notion-editor-area',
      },
    },
  })
}