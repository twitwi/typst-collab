<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import * as Y from 'yjs'
import { useCollab } from './composables/useCollab'
import type { VFSAdapter } from './composables/useTypst'
import type { CompatibleVFS } from './composables/useCompatibleVFS'
import FileTree from './components/FileTree.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import ConnectionBar from './components/ConnectionBar.vue'
import BoxInput from './components/BoxInput.vue'

const LS_KEY = 'typst-collab:box-address'

const { connected, users, vfsReady, awareness, initFromHash, connect, disconnect, getVFS } = useCollab()

const showBoxInput = ref(false)
const boxAddress = ref('')
const activeFile = ref('main.typ')

let rawVFS: CompatibleVFS | null = null
let vfsAdapter: VFSAdapter | null = null

const vfsVersion = computed(() => rawVFS?.version.value ?? 0)

const fileList = computed(() => {
  vfsVersion.value
  return vfsAdapter?.listFiles() ?? []
})

const currentYText = computed((): Y.Text | undefined => {
  vfsReady.value
  vfsVersion.value
  activeFile.value
  try {
    const f = rawVFS?.getFile(activeFile.value)
    return f || undefined
  } catch {
    return undefined
  }
})

function getBoxAddress(): string {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash) return hash
  return localStorage.getItem(LS_KEY) || ''
}

function saveBoxAddress(addr: string) {
  localStorage.setItem(LS_KEY, addr)
}

function handleBoxConfirm(addr: string) {
  showBoxInput.value = false
  if (!addr) return
  boxAddress.value = addr
  saveBoxAddress(addr)
  initialize(addr)
}

function handleBoxCancel() {
  showBoxInput.value = false
}

function handleChangeBox() {
  disconnect()
  showBoxInput.value = true
}

function initialize(addr: string) {
  initFromHash(addr)
  connect()
}

watch(vfsReady, (ready) => {
  if (!ready) return
  const vfs = getVFS()
  rawVFS = vfs
  vfsAdapter = {
    listFiles: () => vfs.listFiles(),
    readFileAsString: (p: string) => vfs.readFileAsString(p),
    readFileAsBytes: (p: string) => vfs.readFileAsBytes(p),
    isBinary: (p: string) => vfs.isBinary(p),
  }

  const list = vfs.listFiles()
  if (list.length === 0) {
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
- Compatible with codyjs boxes

#lorem(30)
`
    vfs.setFile('main.typ', initial)
    activeFile.value = 'main.typ'
  } else if (!list.includes(activeFile.value)) {
    activeFile.value = list[0]
  }
})

function handleSelect(path: string) {
  activeFile.value = path
}

function handleAdd(path: string) {
  rawVFS?.setFile(path, '')
  activeFile.value = path
}

function handleDelete(path: string) {
  rawVFS?.deleteFile(path)
  if (activeFile.value === path) {
    const list = vfsAdapter?.listFiles() ?? []
    activeFile.value = list.includes('main.typ') ? 'main.typ' : list[0] || 'main.typ'
  }
}

onMounted(() => {
  const addr = getBoxAddress()
  if (addr) {
    boxAddress.value = addr
    initialize(addr)
  } else {
    showBoxInput.value = true
  }
})
</script>

<template>
  <div class="app">
    <ConnectionBar
      :connected="connected"
      :users="users"
      :box-address="boxAddress"
      @connect="connect()"
      @disconnect="disconnect()"
      @change-box="handleChangeBox"
    />

    <div v-if="vfsReady" class="panes">
      <FileTree
        :file-list="fileList"
        :active-file="activeFile"
        @select="handleSelect"
        @add="handleAdd"
        @delete="handleDelete"
      />

      <div class="pane editor-pane-wrapper">
        <div class="pane-header">{{ activeFile }}</div>
        <EditorPane
          v-if="currentYText && awareness"
          :key="activeFile"
          :ytext="currentYText"
          :awareness="awareness"
        />
        <div v-else class="empty-editor">Select or create a file</div>
      </div>

      <div class="pane-divider" />

      <div class="pane preview-pane-wrapper">
        <PreviewPane
          v-if="vfsAdapter"
          :vfs="vfsAdapter"
          :change-key="vfsVersion"
          :active-file="activeFile"
        />
      </div>
    </div>

    <div v-else-if="connected" class="panes">
      <div class="loading">Syncing files...</div>
    </div>

    <BoxInput
      v-if="showBoxInput"
      :model-value="boxAddress"
      @confirm="handleBoxConfirm"
      @cancel="handleBoxCancel"
    />
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
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: #585b70;
  font-style: italic;
  font-size: 16px;
}
</style>
