<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { yCollab } from 'y-codemirror.next'
import type * as Y from 'yjs'
import type { TypstProject, TypstFormatter, TypstHighlightingController } from '@vedivad/codemirror-typst'
import { createTypstSetup, typstFilePath } from '@vedivad/codemirror-typst'

const props = defineProps<{
  ytext: Y.Text
  awareness: any
  activeFile?: string
  project?: TypstProject
  formatter?: TypstFormatter
  highlighting?: TypstHighlightingController
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

  const extensions = [
    basicSetup,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    syntaxHighlighting(defaultHighlightStyle),
    yCollab(ytext, props.awareness),
    typstFilePath.of('/' + (props.activeFile || 'main.typ')),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emit('change', update.state.doc.toString())
      }
    }),
  ]

  if (props.project) {
    const setup = createTypstSetup({
      project: props.project,
      sync: 'external',
      highlighting: props.highlighting,
      formatter: props.formatter ? { instance: props.formatter } : undefined,
    })
    extensions.push(...setup)
  }

  const state = EditorState.create({
    doc: ytext.toString(),
    extensions,
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

watch(
  () => props.project,
  (project, prev) => {
    if (project !== prev && props.ytext) buildEditor(props.ytext)
  },
  { once: true }
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
.editor-pane :deep(.cm-tooltip) {
  background: #1e1e2e;
  border: 1px solid #45475a;
  color: #cdd6f4;
}
.editor-pane :deep(.cm-tooltip-autocomplete) {
  background: #1e1e2e;
  border: 1px solid #45475a;
}
.editor-pane :deep(.cm-tooltip-autocomplete ul li[aria-selected]) {
  background: #313244;
  color: #cdd6f4;
}
.editor-pane :deep(.cm-completionLabel) {
  color: #cdd6f4;
}
.editor-pane :deep(.cm-completionDetail) {
  color: #a6adc8;
}
.editor-pane :deep(.cm-completionMatchedText) {
  color: #89b4fa;
}
.editor-pane :deep(.cm-diagnostic) {
  border-left: 3px solid #f38ba8;
}
.editor-pane :deep(.cm-diagnostic-error) {
  border-left-color: #f38ba8;
}
.editor-pane :deep(.cm-diagnostic-warning) {
  border-left-color: #f9e2af;
}
.editor-pane :deep(.cm-diagnostic-info) {
  border-left-color: #89b4fa;
}
.editor-pane :deep(.cm-lintRange-error) {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath fill='%23f38ba8' d='m0 0 L6 3 M0 3 L6 0' style='stroke:%23f38ba8;stroke-width:0.5'/%3E%3C/svg%3E");
}
</style>