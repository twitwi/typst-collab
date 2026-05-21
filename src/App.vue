<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import ConnectionBar from './components/ConnectionBar.vue'
import { useCollab } from './composables/useCollab'

const room = 'typst-collab-demo'
const serverUrl = `ws://${window.location.hostname}:4000`

const { ytext, awareness, connected, users, connect, disconnect } =
  useCollab(room, serverUrl)

const editorSource = ref('')

function handleEditorChange(value: string) {
  editorSource.value = value
}

onMounted(() => {
  connect()
  if (ytext.toString()) {
    editorSource.value = ytext.toString()
  } else {
    const initial = `= Hello, Typst!

This is a *collaborative* document.

#align(center)[
  #rect(fill: blue.transparentize(0.8))[
    #text(size: 24pt)[Welcome to typst-collab!]
  ]
]

== Features
- Real-time collaboration via Yjs
- Live preview with Typst WASM
- Split pane editor

#lorem(30)
`
    ytext.insert(0, initial)
    editorSource.value = initial
  }
})
</script>

<template>
  <div class="app">
    <ConnectionBar
      :connected="connected"
      :users="users"
      :room="room"
      @connect="connect()"
      @disconnect="disconnect()"
    />
    <div class="panes">
      <div class="pane editor-pane-wrapper">
        <div class="pane-header">Editor</div>
        <EditorPane
          :ytext="ytext"
          :awareness="awareness"
          @change="handleEditorChange"
        />
      </div>
      <div class="pane-divider" />
      <div class="pane preview-pane-wrapper">
        <PreviewPane :source="editorSource" />
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body {
  height: 100%;
  overflow: hidden;
  background: #11111b;
  color: #cdd6f4;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#app {
  height: 100%;
}
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.panes {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-header {
  padding: 4px 12px;
  font-size: 12px;
  color: #a6adc8;
  border-bottom: 1px solid #313244;
  background: #181825;
}
.pane-divider {
  width: 4px;
  background: #313244;
  cursor: col-resize;
}
.pane-divider:hover {
  background: #45475a;
}
.editor-pane-wrapper {
  min-width: 300px;
}
.preview-pane-wrapper {
  min-width: 300px;
}
</style>
