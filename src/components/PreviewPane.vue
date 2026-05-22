<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTypst } from '../composables/useTypst'
import type { VFSAdapter } from '../composables/useTypst'

const props = defineProps<{
  vfs: VFSAdapter
  changeKey: number
  mainFile: string
}>()

const { init, compileFromVFS, compiling, svgContent, error } = useTypst()

const autoRefresh = ref(true)
const debounceMs = ref(500)

const debounceOptions = [200, 500, 1000, 2000]

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function doCompile() {
  const entry = props.vfs.listFiles().includes(props.mainFile)
    ? props.mainFile
    : 'main.typ'
  await compileFromVFS(props.vfs, entry)
}

async function debouncedCompile() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doCompile, debounceMs.value)
}

onMounted(async () => {
  await init()
  if (props.vfs.listFiles().length > 0) doCompile()
})

watch(() => props.changeKey, () => {
  if (autoRefresh.value) debouncedCompile()
})

watch(() => props.mainFile, () => {
  if (autoRefresh.value) doCompile()
})

watch(autoRefresh, (on) => {
  if (on) doCompile()
})
</script>

<template>
  <div class="preview-pane">
    <div class="preview-header">
      <span>Preview</span>
      <span v-if="compiling" class="compiling-badge">compiling...</span>
      <div class="header-actions">
        <button class="icon-btn" @click="doCompile" title="Refresh preview">↻</button>
        <select v-if="autoRefresh" v-model="debounceMs" class="delay-select" title="Debounce delay">
          <option v-for="d in debounceOptions" :key="d" :value="d">{{ d }}ms</option>
        </select>
        <button
          class="auto-toggle"
          :class="{ active: autoRefresh }"
          @click="autoRefresh = !autoRefresh"
        >
          {{ autoRefresh ? 'Auto' : 'Manual' }}
        </button>
      </div>
    </div>
    <div class="preview-content">
      <div v-if="error" class="preview-error">{{ error }}</div>
      <div v-else-if="compiling && !svgContent" class="preview-placeholder">Compiling...</div>
      <div v-else-if="!svgContent && !compiling" class="preview-placeholder">Start typing to preview</div>
      <div v-else class="svg-container" v-html="svgContent" />
    </div>
  </div>
</template>

<style scoped>
.preview-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  color: #a6adc8;
  border-bottom: 1px solid #313244;
  background: #181825;
}
.compiling-badge {
  font-size: 10px;
  color: #f9e2af;
  animation: pulse 1s infinite;
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.icon-btn {
  background: none;
  border: none;
  color: #a6adc8;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
}
.icon-btn:hover {
  color: #cdd6f4;
}
.auto-toggle {
  background: none;
  border: 1px solid #45475a;
  color: #6c7086;
  cursor: pointer;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  line-height: 1.4;
}
.auto-toggle.active {
  border-color: #a6adc8;
  color: #a6adc8;
}
.auto-toggle:hover {
  border-color: #cdd6f4;
  color: #cdd6f4;
}
.delay-select {
  background: #181825;
  border: 1px solid #45475a;
  color: #a6adc8;
  font-size: 10px;
  padding: 1px 2px;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.4;
}
.delay-select:hover {
  border-color: #cdd6f4;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: #fff;
}
.preview-placeholder {
  color: #585b70;
  text-align: center;
  margin-top: 40px;
  font-style: italic;
}
.preview-error {
  color: #f38ba8;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 13px;
}
.svg-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
