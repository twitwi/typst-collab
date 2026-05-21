<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
}>()

const input = ref(props.modelValue || '')
const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})
</script>

<template>
  <div class="box-overlay" @click.self="emit('cancel')">
    <div class="box-dialog">
      <h3 class="box-title">Connect to Box</h3>
      <p class="box-hint">
        Enter a box address in the format:
        <code>server::docname::token::path</code>
      </p>
      <input
        ref="inputRef"
        v-model="input"
        class="box-input"
        placeholder="ws://localhost:4000::my-doc::mytoken::BOX"
        @keydown.enter="emit('confirm', input)"
        @keydown.escape="emit('cancel')"
      />
      <div class="box-actions">
        <button class="btn btn-cancel" @click="emit('cancel')">Cancel</button>
        <button class="btn btn-confirm" @click="emit('confirm', input)">Connect</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.box-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.box-dialog {
  background: #1e1e2e;
  border: 1px solid #45475a;
  border-radius: 8px;
  padding: 24px;
  min-width: 480px;
  max-width: 90vw;
}
.box-title {
  font-size: 18px;
  margin-bottom: 8px;
  color: #cdd6f4;
}
.box-hint {
  font-size: 13px;
  color: #a6adc8;
  margin-bottom: 16px;
}
.box-hint code {
  background: #313244;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #89b4fa;
}
.box-input {
  width: 100%;
  background: #181825;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 6px;
  outline: none;
  font-family: monospace;
}
.box-input:focus {
  border-color: #89b4fa;
}
.box-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn-cancel {
  background: #313244;
  color: #cdd6f4;
}
.btn-cancel:hover {
  background: #45475a;
}
.btn-confirm {
  background: #89b4fa;
  color: #1e1e2e;
  font-weight: 600;
}
.btn-confirm:hover {
  background: #74c7ec;
}
</style>
