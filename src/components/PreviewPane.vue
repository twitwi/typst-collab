<script setup lang="ts">
import { watch, onMounted } from 'vue'
import * as Y from 'yjs'
import { useTypst } from '../composables/useTypst'

const props = defineProps<{
  files: Y.Map<Y.Text>
  changeKey: number
}>()

const { init, compileFromFS, compiling, svgContent, error } = useTypst()

let debounceTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await init()
  if (props.files.size > 0) {
    await compileFromFS(props.files)
  }
})

watch(
  () => props.changeKey,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      await compileFromFS(props.files)
    }, 500)
  }
)
</script>

<template>
  <div class="preview-pane">
    <div class="preview-header">
      <span>Preview</span>
      <span v-if="compiling" class="compiling-badge">compiling...</span>
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
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
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
