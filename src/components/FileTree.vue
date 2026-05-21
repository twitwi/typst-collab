<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children: TreeNode[]
  expanded: boolean
}

interface FlatNode {
  name: string
  path: string
  type: 'file' | 'directory'
  depth: number
  expanded: boolean
}

const props = defineProps<{
  fileList: string[]
  activeFile: string
  mainFile: string
  triggerRename: string | null
}>()

const emit = defineEmits<{
  select: [path: string]
  add: [path: string]
  delete: [path: string]
  rename: [oldPath: string, newPath: string]
  setMain: [path: string]
  renameStarted: []
}>()

const adding = ref(false)
const newPath = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

const popoverPath = ref<string | null>(null)

const renamingPath = ref<string | null>(null)
const renameValue = ref('')

const deletePath = ref<string | null>(null)
const deleteConfirmRef = ref<HTMLDivElement | null>(null)

const tree = computed(() => buildTree(props.fileList, props.mainFile))

const flatTree = computed(() => flattenTree(tree.value))

function buildTree(paths: string[], mainFile: string): TreeNode[] {
  const root: TreeNode[] = []

  for (const fullPath of paths) {
    const parts = fullPath.split('/')
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const nodePath = parts.slice(0, i + 1).join('/')

      if (isFile) {
        currentLevel.push({
          name: part,
          path: nodePath,
          type: 'file',
          children: [],
          expanded: false,
        })
      } else {
        let dir = currentLevel.find(
          (n) => n.type === 'directory' && n.name === part
        )
        if (!dir) {
          dir = {
            name: part,
            path: nodePath,
            type: 'directory',
            children: [],
            expanded: true,
          }
          currentLevel.push(dir)
        }
        currentLevel = dir.children
      }
    }
  }

  for (const level of [root, ...collectDirChildren(root)]) {
    level.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      if (a.path === mainFile) return -1
      if (b.path === mainFile) return 1
      return a.name.localeCompare(b.name)
    })
  }

  return root
}

function collectDirChildren(nodes: TreeNode[]): TreeNode[][] {
  const result: TreeNode[][] = []
  for (const n of nodes) {
    if (n.type === 'directory') {
      result.push(n.children)
      result.push(...collectDirChildren(n.children))
    }
  }
  return result
}

function flattenTree(nodes: TreeNode[], depth = 0): FlatNode[] {
  const result: FlatNode[] = []
  for (const node of nodes) {
    result.push({
      name: node.name,
      path: node.path,
      type: node.type,
      depth,
      expanded: node.expanded,
    })
    if (node.type === 'directory' && node.expanded) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

function getParentDir(path: string): TreeNode | null {
  function search(nodes: TreeNode[], parent: TreeNode | null): TreeNode | null {
    for (const n of nodes) {
      if (n.path === path) return parent
      if (n.type === 'directory') {
        const found = search(n.children, n)
        if (found) return found
      }
    }
    return null
  }
  return search(tree.value, null)
}

function toggleDir(node: FlatNode) {
  const target = findNode(tree.value, node.path)
  if (target && target.type === 'directory') {
    target.expanded = !target.expanded
  }
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.type === 'directory') {
      const found = findNode(n.children, path)
      if (found) return found
    }
  }
  return null
}

function startAdd() {
  adding.value = true
  newPath.value = ''
  nextTick(() => addInputRef.value?.focus())
}

function cancelAdd() {
  adding.value = false
  newPath.value = ''
}

function submitAdd() {
  const path = newPath.value.trim()
  if (path) {
    emit('add', path)
  }
  adding.value = false
  newPath.value = ''
}

function togglePopover(path: string) {
  popoverPath.value = popoverPath.value === path ? null : path
}

function closePopover() {
  popoverPath.value = null
}

function startRename(path: string) {
  renamingPath.value = path
  const name = path.split('/').pop() || path
  renameValue.value = name
  popoverPath.value = null
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>('[data-rename-input]')
    if (!el) return
    el.focus()
    const dot = name.lastIndexOf('.')
    const selLen = dot > 0 ? dot : name.length
    el.setSelectionRange(0, selLen)
  })
}

function submitRename(path: string) {
  const oldName = path.split('/').pop() || path
  const newName = renameValue.value.trim()
  if (newName && newName !== oldName) {
    const parent = getParentDir(path)
    const newPath = parent ? `${parent.path}/${newName}` : newName
    emit('rename', path, newPath)
  }
  renamingPath.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingPath.value = null
  renameValue.value = ''
}

watch(() => props.triggerRename, (path) => {
  if (path) {
    startRename(path)
    emit('renameStarted')
  }
})

function openDeleteConfirm(path: string) {
  deletePath.value = path
  popoverPath.value = null
}

function doDelete() {
  if (deletePath.value) {
    emit('delete', deletePath.value)
  }
  deletePath.value = null
}

function handleSetMain(path: string) {
  emit('setMain', path)
  emit('select', path)
  popoverPath.value = null
}

function getIcon(node: FlatNode): string {
  if (node.type === 'directory') return node.expanded ? '📂' : '📁'
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (ext === 'typ') return '📄'
  if (ext === 'bib') return '📚'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return '🖼️'
  return '📄'
}

let clickHandler: ((e: MouseEvent) => void) | null = null

onMounted(() => {
  clickHandler = (e: MouseEvent) => {
    if (!popoverPath.value) return
    const target = e.target as HTMLElement
    const ftRoot = document.querySelector('[data-ft-root]')
    if (!ftRoot || !ftRoot.contains(target)) {
      popoverPath.value = null
    }
  }
  document.addEventListener('mousedown', clickHandler)
})

onUnmounted(() => {
  if (clickHandler) {
    document.removeEventListener('mousedown', clickHandler)
  }
})
</script>

<template>
  <div data-ft-root class="file-tree">
    <div class="tree-header">
      <span class="tree-title">Files</span>
      <button class="tree-btn" title="Add file" @click="startAdd()">＋</button>
    </div>

    <div v-if="adding" class="add-row">
      <input
        ref="addInputRef"
        v-model="newPath"
        class="add-input"
        placeholder="path/to/file.typ"
        @keydown.enter="submitAdd()"
        @keydown.escape="cancelAdd()"
        @blur="cancelAdd()"
      />
    </div>

    <div class="tree-list" @click.self="closePopover()">
      <div
        v-for="node in flatTree"
        :key="node.path"
        class="tree-node"
        :class="{
          'dir-node': node.type === 'directory',
          'file-node': node.type === 'file',
          active: node.type === 'file' && node.path === activeFile,
        }"
        :style="{ paddingLeft: node.depth * 16 + 4 + 'px' }"
      >
        <div
          v-if="node.type === 'directory'"
          class="node-label dir-label"
          @click="toggleDir(node)"
        >
          <span class="node-icon">{{ getIcon(node) }}</span>
          <span class="node-name">{{ node.name }}/</span>
        </div>

        <template v-else-if="renamingPath === node.path">
          <input
            data-rename-input
            v-model="renameValue"
            class="rename-input"
            @click.stop
            @keydown.enter="submitRename(node.path)"
            @keydown.escape="cancelRename()"
            @blur="submitRename(node.path)"
          />
        </template>

        <template v-else>
          <div
            class="node-label"
            :class="{ 'is-main': node.path === mainFile }"
            @click="emit('select', node.path)"
          >
            <span class="node-icon">{{ getIcon(node) }}</span>
            <span class="node-name">{{ node.name }}</span>
          </div>
          <div class="node-actions" @click.stop>
            <button
              class="more-btn"
              title="More"
              @click="togglePopover(node.path)"
            >⋯</button>
            <div
              v-if="popoverPath === node.path"
              class="popover"
            >
              <button class="popover-item" @click.stop="startRename(node.path)">Rename</button>
              <button
                v-if="node.path !== mainFile"
                class="popover-item"
                @click.stop="handleSetMain(node.path)"
              >Set as main</button>
              <button class="popover-item danger" @click.stop="openDeleteConfirm(node.path)">Delete</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="deletePath"
        ref="deleteConfirmRef"
        class="confirm-overlay"
        @mousedown.self="deletePath = null"
      >
        <div class="confirm-dialog">
          <div class="confirm-text">Delete "{{ deletePath }}"?</div>
          <div class="confirm-actions">
            <button @click="deletePath = null">Cancel</button>
            <button class="danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.file-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #181825;
  border-right: 1px solid #313244;
  min-width: 180px;
  max-width: 260px;
  overflow: hidden;
}
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid #313244;
}
.tree-title {
  font-size: 12px;
  font-weight: 600;
  color: #a6adc8;
}
.tree-btn {
  background: none;
  border: none;
  color: #a6adc8;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
}
.tree-btn:hover {
  background: #313244;
}
.add-row {
  padding: 4px 8px;
  border-bottom: 1px solid #313244;
}
.add-input,
.rename-input {
  width: 100%;
  background: #1e1e2e;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 3px;
  outline: none;
}
.add-input:focus,
.rename-input:focus {
  border-color: #89b4fa;
}
.tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  position: relative;
}
.file-node.active {
  background: #313244;
}
.dir-label {
  font-weight: 600;
  cursor: pointer;
  flex: 1;
}
.node-label {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 13px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
.node-label.is-main {
  font-weight: 700;
  color: #a6e3a1;
  border-left: 2px solid #a6e3a1;
  padding-left: 6px;
}
.node-label.is-main .node-icon {
  filter: drop-shadow(0 0 4px #a6e3a180);
}
.node-label:hover {
  background: #313244;
}
.node-icon {
  font-size: 12px;
  flex-shrink: 0;
}
.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cdd6f4;
}
.node-actions {
  position: relative;
  flex-shrink: 0;
}
.more-btn {
  background: none;
  border: none;
  color: #585b70;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  opacity: 0;
  flex-shrink: 0;
  line-height: 1;
}
.file-node:hover .more-btn {
  opacity: 1;
}
.more-btn:hover {
  color: #cdd6f4;
}
.popover {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 4px;
  min-width: 110px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.popover-item {
  background: none;
  border: none;
  color: #cdd6f4;
  padding: 6px 12px;
  text-align: left;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.popover-item:hover {
  background: #313244;
}
.popover-item.danger {
  color: #f38ba8;
}
.popover-item.danger:hover {
  background: #f38ba822;
}
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.confirm-dialog {
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 6px;
  padding: 16px 20px;
  min-width: 240px;
}
.confirm-text {
  font-size: 14px;
  color: #cdd6f4;
  margin-bottom: 12px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.confirm-actions button {
  background: #313244;
  border: none;
  color: #cdd6f4;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.confirm-actions button:hover {
  background: #45475a;
}
.confirm-actions .danger {
  background: #f38ba822;
  color: #f38ba8;
}
.confirm-actions .danger:hover {
  background: #f38ba844;
}
</style>