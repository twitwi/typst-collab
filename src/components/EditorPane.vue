<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { yCollab } from 'y-codemirror.next'
import type * as Y from 'yjs'

const props = defineProps<{
  ytext: Y.Text
  awareness: any
}>()

const emit = defineEmits<{
  change: [value: string]
  pasteImage: [data: { bytes: Uint8Array; mime: string }]
}>()

const editorRef = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

function buildEditor(ytext: Y.Text) {
  if (view) {
    view.destroy()
    view = null
  }
  if (!editorRef.value) return

  const state = EditorState.create({
    doc: ytext.toString(),
    extensions: [
      basicSetup,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      syntaxHighlighting(defaultHighlightStyle),
      yCollab(ytext, props.awareness),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('change', update.state.doc.toString())
        }
      }),
    ],
  })

  view = new EditorView({ state, parent: editorRef.value })
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  let imageItem: DataTransferItem | null = null
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      imageItem = item
      break
    }
  }

  if (!imageItem) return

  e.preventDefault()
  const file = imageItem.getAsFile()
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const arr = new Uint8Array(reader.result as ArrayBuffer)
    emit('pasteImage', { bytes: arr, mime: imageItem!.type })
  }
  reader.readAsArrayBuffer(file)
}

onMounted(() => {
  if (props.ytext) buildEditor(props.ytext)
  editorRef.value?.addEventListener('paste', onPaste)
})

watch(
  () => props.ytext,
  (ytext) => {
    if (ytext) buildEditor(ytext)
  }
)

onUnmounted(() => {
  editorRef.value?.removeEventListener('paste', onPaste)
  if (view) view.destroy()
})
</script>

<template>
  <div ref="editorRef" class="editor-pane" />
</template>

<style scoped>
.editor-pane {
  height: 100%;
  overflow: auto;
}
.editor-pane :deep(.cm-editor) {
  height: 100%;
  background: #1e1e2e;
  color: #cdd6f4;
}
.editor-pane :deep(.cm-gutters) {
  background: #181825;
  border-right: 1px solid #313244;
  color: #6c7086;
}
.editor-pane :deep(.cm-activeLineGutter) {
  background: #313244;
}
.editor-pane :deep(.cm-cursor) {
  border-left-color: #f5e0dc;
}
.editor-pane :deep(.cm-selectionBackground) {
  background: #45475a !important;
}
.editor-pane :deep(.cm-focused .cm-selectionBackground) {
  background: #45475a !important;
}
</style>