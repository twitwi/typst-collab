<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children: TreeNode[]
  expanded: boolean
}

const props = defineProps<{
  fileList: string[]
  activeFile: string
}>()

const emit = defineEmits<{
  select: [path: string]
  add: [path: string]
  delete: [path: string]
}>()

const adding = ref(false)
const newPath = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

const tree = computed(() => buildTree(props.fileList))

function buildTree(paths: string[]): TreeNode[] {
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

  return root
}

function toggleDir(node: TreeNode) {
  if (node.type === 'directory') {
    node.expanded = !node.expanded
  }
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

function confirmDelete(path: string) {
  if (confirm(`Delete "${path}"?`)) {
    emit('delete', path)
  }
}

function getIcon(node: TreeNode): string {
  if (node.type === 'directory') return node.expanded ? '📂' : '📁'
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (ext === 'typ') return '📄'
  if (ext === 'bib') return '📚'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return '🖼️'
  return '📄'
}
</script>

<template>
  <div class="file-tree">
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

    <div class="tree-list">
      <template v-for="node in tree" :key="node.path">
        <div
          v-if="node.type === 'directory'"
          class="tree-node"
        >
          <div
            class="node-label dir-label"
            :class="{ expanded: node.expanded }"
            @click="toggleDir(node)"
          >
            <span class="node-icon">{{ getIcon(node) }}</span>
            <span class="node-name">{{ node.name }}/</span>
          </div>
          <div v-if="node.expanded" class="dir-children">
            <div
              v-for="child in node.children"
              :key="child.path"
              class="tree-node file-node"
              :class="{ active: child.path === activeFile }"
            >
              <div
                class="node-label"
                @click="emit('select', child.path)"
              >
                <span class="node-icon">{{ getIcon(child) }}</span>
                <span class="node-name">{{ child.name }}</span>
              </div>
              <button
                class="del-btn"
                title="Delete"
                @click.stop="confirmDelete(child.path)"
              >✕</button>
            </div>
          </div>
        </div>
        <div
          v-else
          class="tree-node file-node"
          :class="{ active: node.path === activeFile }"
        >
          <div
            class="node-label"
            @click="emit('select', node.path)"
          >
            <span class="node-icon">{{ getIcon(node) }}</span>
            <span class="node-name">{{ node.name }}</span>
          </div>
          <button
            class="del-btn"
            title="Delete"
            @click.stop="confirmDelete(node.path)"
          >✕</button>
        </div>
      </template>
    </div>
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
.add-input {
  width: 100%;
  background: #1e1e2e;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 3px 6px;
  font-size: 12px;
  border-radius: 3px;
  outline: none;
}
.add-input:focus {
  border-color: #89b4fa;
}
.tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.tree-node {
  user-select: none;
}
.dir-label {
  font-weight: 600;
  cursor: pointer;
}
.dir-label .node-icon {
  display: inline-block;
  transition: transform 0.15s;
}
.dir-label.expanded .node-icon {
  transform: none;
}
.dir-children {
  padding-left: 16px;
}
.file-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.file-node.active {
  background: #313244;
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
.del-btn {
  background: none;
  border: none;
  color: #585b70;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 6px;
  opacity: 0;
  flex-shrink: 0;
}
.file-node:hover .del-btn {
  opacity: 1;
}
.del-btn:hover {
  color: #f38ba8;
}
</style>
