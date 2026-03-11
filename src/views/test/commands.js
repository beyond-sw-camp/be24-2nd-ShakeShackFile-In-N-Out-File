export default {
  items: ({ query }) => {
    return [
      { title: '제목 1', command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
        }
      },
      { title: '제목 2', command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
        }
      },
      { title: '할 일 목록', command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run()
        }
      },
      { title: '불렛 목록', command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run()
        }
      },
      { title: '코드 블록', command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
        }
      },
      { title: '이미지', command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run()
          const url = window.prompt('이미지 URL을 입력하세요')
          if (url) editor.chain().focus().setImage({ src: url }).run()
        }
      },
    ].filter(item => item.title.toLowerCase().startsWith(query.toLowerCase())).slice(0, 10)
  }
}