<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useCollab } from './composables/useCollab'
import FileTree from './components/FileTree.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import ConnectionBar from './components/ConnectionBar.vue'

const room = 'typst-collab-demo'
const serverUrl = `ws://${window.location.hostname}:4000`

const {
  vfs,
  activeFile,
  setActiveFile,
  awareness,
  connected,
  users,
  connect,
  disconnect,
} = useCollab(room, serverUrl)

const currentYText = computed(() => {
  vfs.version.value
  return vfs.getFile(activeFile.value)
})

const fileList = computed(() => {
  vfs.version.value
  return vfs.listFiles()
})

watch(vfs.version, () => {
  if (activeFile.value && !vfs.getFile(activeFile.value)) {
    const list = vfs.listFiles()
    setActiveFile(list.includes('main.typ') ? 'main.typ' : list[0] || 'main.typ')
  }
})

function handleSelect(path: string) {
  setActiveFile(path)
}

function handleAdd(path: string) {
  vfs.setFile(path, '')
  setActiveFile(path)
}

function handleDelete(path: string) {
  vfs.deleteFile(path)
  if (activeFile.value === path) {
    const list = vfs.listFiles()
    setActiveFile(list.includes('main.typ') ? 'main.typ' : list[0] || 'main.typ')
  }
}

onMounted(() => {
  connect()
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
      <FileTree
        :file-list="fileList"
        :active-file="activeFile"
        @select="handleSelect"
        @add="handleAdd"
        @delete="handleDelete"
      />
      <div class="pane editor-pane-wrapper">
        <div class="pane-header">
          {{ activeFile }}
        </div>
        <EditorPane
          v-if="currentYText"
          :key="activeFile"
          :ytext="currentYText"
          :awareness="awareness"
        />
        <div v-else class="empty-editor">Select or create a file</div>
      </div>
      <div class="pane-divider" />
      <div class="pane preview-pane-wrapper">
        <PreviewPane :files="vfs.files" :change-key="vfs.version.value" />
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
  flex-shrink: 0;
}
.pane-divider:hover {
  background: #45475a;
}
.editor-pane-wrapper {
  flex: 1;
  min-width: 250px;
}
.preview-pane-wrapper {
  flex: 1;
  min-width: 250px;
}
.empty-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #585b70;
  font-style: italic;
  font-size: 14px;
}
</style>
