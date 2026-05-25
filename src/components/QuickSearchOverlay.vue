<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  files: string[]
  activeFile: string
}>()

const emit = defineEmits<{
  select: [path: string]
  close: []
}>()

const query = ref('')
const selectedIndex = ref(0)
const inputEl = ref<HTMLInputElement>()

const filtered = computed(() => {
  if (!query.value) return props.files
  const q = query.value.toLowerCase()
  return props.files.filter(f => f.toLowerCase().includes(q))
})

onMounted(() => { inputEl.value?.focus() })

watch(filtered, () => { selectedIndex.value = 0 })

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex.value = Math.max(selectedIndex.value - 1, 0); return }
  if (e.key === 'Enter' && filtered.value[selectedIndex.value]) {
    emit('select', filtered.value[selectedIndex.value])
  }
}

function onClickOutside(e: MouseEvent) {
  if ((e.target as HTMLElement)?.closest('.quick-search-panel')) return
  emit('close')
}
</script>

<template>
  <div class="quick-search-overlay" @mousedown="onClickOutside">
    <div class="quick-search-panel">
      <input
        ref="inputEl"
        v-model="query"
        class="qs-input"
        placeholder="Search files... (main.typ, lib.typ, ...)"
        @keydown="onKeyDown"
      />
      <ul class="qs-results">
        <li
          v-for="(f, i) in filtered"
          :key="f"
          class="qs-item"
          :class="{ active: i === selectedIndex }"
          @mousedown.prevent="emit('select', f)"
          @mouseenter="selectedIndex = i"
        >
          <span v-if="f.endsWith('/')" class="qs-icon">📁</span>
          <span v-else class="qs-icon">📄</span>
          <span class="qs-name">{{ f }}</span>
          <span v-if="f === activeFile" class="qs-current">current</span>
        </li>
        <li v-if="filtered.length === 0" class="qs-empty">No matches</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.quick-search-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  padding-top: 80px;
  background: rgba(0,0,0,0.5);
}
.quick-search-panel {
  width: 480px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  overflow: hidden;
}
.qs-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  background: #181825;
  border: none;
  border-bottom: 1px solid #313244;
  color: #cdd6f4;
  outline: none;
}
.qs-input::placeholder {
  color: #585b70;
}
.qs-results {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
}
.qs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  cursor: pointer;
  color: #a6adc8;
  font-size: 13px;
}
.qs-item.active {
  background: #313244;
  color: #cdd6f4;
}
.qs-item:hover {
  background: #313244;
}
.qs-icon {
  flex-shrink: 0;
  font-size: 13px;
}
.qs-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qs-current {
  font-size: 10px;
  color: #89b4fa;
  flex-shrink: 0;
}
.qs-empty {
  padding: 20px;
  text-align: center;
  color: #585b70;
  font-style: italic;
  font-size: 13px;
}
</style>
