<script setup lang="ts">
import { ref, computed, watch, nextTick, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Y from 'yjs'
import { useCollab } from './composables/useCollab'
import type { VFSAdapter } from './composables/useTypst'
import type { CompatibleVFS } from './composables/useCompatibleVFS'
import type { TypstProject, TypstHighlightingController } from '@vedivad/codemirror-typst'
import { TypstAnalyzer, TypstFormatter } from '@vedivad/codemirror-typst'
import tinymistWasmUrl from 'tinymist-web/pkg/tinymist_bg.wasm?url'
import FileTree from './components/FileTree.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import ConnectionBar from './components/ConnectionBar.vue'
import BoxInput from './components/BoxInput.vue'
import QuickSearchOverlay from './components/QuickSearchOverlay.vue'

const LS_KEY = 'typst-collab:box-address'

const { connected, users, vfsReady, mainFile, myName, myColor, forcedColor, awareness, initFromHash, connect, disconnect, getVFS, setMainFile, setMyName, setForcedColor } = useCollab()

const showBoxInput = ref(false)
const showQuickSearch = ref(false)
const prevActiveFile = ref('')
const boxAddress = ref('')
const activeFile = ref('main.typ')
const fontSize = ref(Number(localStorage.getItem('typst-collab:font-size')) || 14)
watch(fontSize, (v) => localStorage.setItem('typst-collab:font-size', String(v)))
const triggerRename = ref<string | null>(null)

let rawVFS: CompatibleVFS | null = null
let vfsAdapter: VFSAdapter | null = null
const editorPaneRef = ref<InstanceType<typeof EditorPane>>()
const lspProject = shallowRef<TypstProject>()
const lspFormatter = shallowRef<TypstFormatter>()
const lspHighlighting = shallowRef<TypstHighlightingController>()
const lspTrackedPaths = new Set<string>()
let syncingLsp = false

const vfsVersion = computed(() => {
  vfsReady.value
  return rawVFS?.version.value ?? 0
})

const fileList = computed(() => {
  vfsVersion.value
  return vfsAdapter?.listFiles() ?? []
})

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
const imageZoom = ref(1)

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTS.includes(ext) : false
}

function onImageWheel(e: WheelEvent) {
  if (!isImagePath(activeFile.value)) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  imageZoom.value = Math.max(0.1, Math.min(10, imageZoom.value + delta))
}

const currentYText = computed((): Y.Text | undefined => {
  vfsReady.value
  vfsVersion.value
  activeFile.value
  if (isImagePath(activeFile.value)) return undefined
  try {
    const f = rawVFS?.getFile(activeFile.value)
    return f || undefined
  } catch {
    return undefined
  }
})

let prevUrl: string | null = null
const imageUrl = computed((): string | null => {
  vfsReady.value
  vfsVersion.value
  activeFile.value
  if (!rawVFS || !isImagePath(activeFile.value)) return null
  const bytes = rawVFS.readFileAsBytes(activeFile.value)
  if (!bytes) return null
  const ext = activeFile.value.split('.').pop()?.toLowerCase()
  const mime =
    ext === 'svg' ? 'image/svg+xml' :
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'gif' ? 'image/gif' :
    ext === 'webp' ? 'image/webp' : null
  if (!mime) return null
  if (prevUrl) URL.revokeObjectURL(prevUrl)
  const blob = new Blob([bytes], { type: mime })
  prevUrl = URL.createObjectURL(blob)
  return prevUrl
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

watch(vfsReady, async (ready) => {
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

  try {
    const { createTypstHighlighting, TypstProject, TypstCompiler } = await import('@vedivad/codemirror-typst')
    const [analyzer, compiler, highlighting] = await Promise.all([
      TypstAnalyzer.create({ wasmUrl: tinymistWasmUrl }),
      TypstCompiler.create(),
      createTypstHighlighting({
        theme: 'catppuccin-mocha',
        themes: { 'catppuccin-mocha': 'catppuccin-mocha' },
      }),
    ])
    lspFormatter.value = await TypstFormatter.create({ tab_spaces: 2, max_width: 80 })
    const project = new TypstProject({ compiler, analyzer, autoCompile: { debounceMs: 300 } })
    for (const file of vfs.listFiles()) {
      const path = '/' + file
      if (vfs.isBinary(file)) {
        const bytes = vfs.readFileAsBytes(file)
        if (bytes !== null) await project.setBinary(path, bytes)
      } else {
        const content = vfs.readFileAsString(file)
        if (content !== null) await project.setText(path, content)
      }
      lspTrackedPaths.add(file)
    }
    lastFileListHash = vfs.listFiles().join('\n')
    lspProject.value = project
    lspHighlighting.value = highlighting
  } catch (e) {
    console.warn('Typst LSP init failed:', e)
  }
})

let lastFileListHash = ''

watch(vfsVersion, async () => {
  if (syncingLsp) return
  const project = lspProject.value
  const vfs = rawVFS
  if (!project || !vfs) return
  const list = vfs.listFiles()
  const hash = list.join('\n')
  if (hash === lastFileListHash) return
  lastFileListHash = hash
  syncingLsp = true
  try {
    const current = new Set(list)
    for (const file of lspTrackedPaths) {
      if (!current.has(file)) {
        lspTrackedPaths.delete(file)
        await project.remove('/' + file)
      }
    }
    for (const file of current) {
      if (lspTrackedPaths.has(file)) continue
      const path = '/' + file
      if (vfs.isBinary(file)) {
        const bytes = vfs.readFileAsBytes(file)
        if (bytes !== null) await project.setBinary(path, bytes)
      } else {
        const content = vfs.readFileAsString(file)
        if (content !== null) await project.setText(path, content)
      }
      lspTrackedPaths.add(file)
    }
  } finally {
    syncingLsp = false
  }
})

function handleSelect(path: string) {
  if (activeFile.value !== path) prevActiveFile.value = activeFile.value
  activeFile.value = path
  imageZoom.value = 1
}

function handleAdd(path: string) {
  rawVFS?.setFile(path, '')
  activeFile.value = path
}

function handleDelete(path: string) {
  rawVFS?.deleteNode(path)
  if (activeFile.value === path || activeFile.value.startsWith(path + '/')) {
    const list = vfsAdapter?.listFiles() ?? []
    activeFile.value = list.includes('main.typ') ? 'main.typ' : list[0] || 'main.typ'
  }
  if (mainFile.value === path || mainFile.value.startsWith(path + '/')) {
    const list = vfsAdapter?.listFiles() ?? []
    setMainFile(list.includes('main.typ') ? 'main.typ' : list[0] || 'main.typ')
  }
}

function handleRename(oldPath: string, newPath: string) {
  if (oldPath === newPath) return
  rawVFS?.renameNode(oldPath, newPath)
  if (activeFile.value === oldPath) {
    activeFile.value = newPath
  } else if (activeFile.value.startsWith(oldPath + '/')) {
    activeFile.value = newPath + activeFile.value.slice(oldPath.length)
  }
  if (mainFile.value === oldPath) {
    setMainFile(newPath)
  } else if (mainFile.value.startsWith(oldPath + '/')) {
    setMainFile(newPath + mainFile.value.slice(oldPath.length))
  }
}

function handleMove(oldPath: string, newPath: string) {
  if (oldPath === newPath) return
  rawVFS?.renameNode(oldPath, newPath)
  if (activeFile.value === oldPath) {
    activeFile.value = newPath
  } else if (activeFile.value.startsWith(oldPath + '/')) {
    activeFile.value = newPath + activeFile.value.slice(oldPath.length)
  }
  if (mainFile.value === oldPath) {
    setMainFile(newPath)
  } else if (mainFile.value.startsWith(oldPath + '/')) {
    setMainFile(newPath + mainFile.value.slice(oldPath.length))
  }
}

function handleAddDir(path: string) {
  rawVFS?.mkdir(path)
}

function handleSetMain(path: string) {
  setMainFile(path)
}

function createImageFile(bytes: Uint8Array, mime: string) {
  if (!rawVFS || !vfsAdapter) return
  const ext = mime.split('/').pop() || 'png'
  let n = 1
  const existing = new Set(vfsAdapter.listFiles())
  while (existing.has(`image-${n}.${ext}`)) n++
  const path = `image-${n}.${ext}`
  rawVFS.setFile(path, bytes)
  activeFile.value = path
  nextTick(() => {
    triggerRename.value = path
  })
}

function handlePasteImage(data: { bytes: Uint8Array; mime: string }) {
  createImageFile(data.bytes, data.mime)
}

function handlePanePaste(e: ClipboardEvent) {
  if (e.defaultPrevented) return
  const items = e.clipboardData?.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const reader = new FileReader()
      reader.onload = () => {
        const arr = new Uint8Array(reader.result as ArrayBuffer)
        createImageFile(arr, item.type)
      }
      reader.readAsArrayBuffer(file)
      break
    }
  }
}

function handleRenameStarted() {
  triggerRename.value = null
}

onMounted(() => {
  const addr = getBoxAddress()
  if (addr) {
    boxAddress.value = addr
    initialize(addr)
  } else {
    showBoxInput.value = true
  }
  window.addEventListener('keydown', onGlobalKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeyDown)
})

function onGlobalKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    if (showBoxInput.value) return
    e.preventDefault()
    showQuickSearch.value = true
  }
}

</script>

<template>
  <div class="app">
    <ConnectionBar
      :connected="connected"
      :users="users"
      :box-address="boxAddress"
      :my-name="myName"
      :my-color="myColor"
      :forced-color="forcedColor"
      @connect="connect()"
      @disconnect="disconnect()"
      @change-box="handleChangeBox"
      @rename="setMyName"
      @set-color="setForcedColor"
      @clear-color="() => setForcedColor(null)"
    />

    <div v-if="vfsReady" class="panes" @paste="handlePanePaste">
      <FileTree
        :file-list="fileList"
        :active-file="activeFile"
        :main-file="mainFile"
        :trigger-rename="triggerRename"
        @select="handleSelect"
        @add="handleAdd"
        @add-dir="handleAddDir"
        @delete="handleDelete"
        @rename="handleRename"
        @move="handleMove"
        @set-main="handleSetMain"
        @rename-started="handleRenameStarted"
      />

      <div class="pane editor-pane-wrapper">
        <div class="pane-header">
          <span class="pane-title">{{ activeFile }}</span>
          <span class="font-size-control">
            <input type="range" min="10" max="24" step="1" v-model.number="fontSize" />
            <span class="font-size-value">{{ fontSize }}px</span>
          </span>
        </div>
        <div v-if="imageUrl" class="image-preview" @wheel.prevent="onImageWheel">
          <img
            :src="imageUrl"
            :alt="activeFile"
            :style="{ transform: `scale(${imageZoom})` }"
          />
          <div class="zoom-label">{{ Math.round(imageZoom * 100) }}%</div>
        </div>
        <EditorPane
          ref="editorPaneRef"
          v-else-if="currentYText && awareness"
          :key="activeFile"
          :ytext="currentYText"
          :awareness="awareness"
          :active-file="activeFile"
          :font-size="fontSize + 'px'"
          :project="lspProject"
          :formatter="lspFormatter"
          :highlighting="lspHighlighting"
          @paste-image="handlePasteImage"
        />
        <div v-else class="empty-editor">Select or create a file</div>
      </div>

      <div class="pane-divider" />

      <div class="pane preview-pane-wrapper">
        <PreviewPane
          v-if="vfsAdapter"
          :vfs="vfsAdapter"
          :change-key="vfsVersion"
          :main-file="mainFile"
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
    <QuickSearchOverlay
      v-if="showQuickSearch && vfsAdapter"
      :files="vfsAdapter.listFiles()"
      :active-file="activeFile"
      :prev-file="prevActiveFile"
      @select="(path) => { handleSelect(path); showQuickSearch = false; nextTick(() => (editorPaneRef as any)?.focus()) }"
      @close="showQuickSearch = false"
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: #a6adc8;
  border-bottom: 1px solid #313244;
  background: #181825;
}
.pane-title { flex: 1; }
.font-size-control {
  display: flex;
  align-items: center;
  gap: 4px;
}
.font-size-control input[type="range"] {
  width: 60px;
  height: 4px;
  accent-color: #89b4fa;
  cursor: pointer;
}
.font-size-value {
  width: 28px;
  text-align: right;
  font-variant-numeric: tabular-nums;
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
.image-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #11111b;
  position: relative;
}
.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.1s;
}
.zoom-label {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0,0,0,0.6);
  color: #cdd6f4;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
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
