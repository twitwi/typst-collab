<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = defineProps<{
  connected: boolean
  users: { name: string; color: string }[]
  boxAddress: string
  myName: string
  myColor: string
  forcedColor: string | null
}>()

const emit = defineEmits<{
  connect: []
  disconnect: []
  changeBox: []
  rename: [name: string]
  setColor: [color: string]
  clearColor: []
}>()

const editing = ref(false)
const editValue = ref('')
const inputEl = ref<HTMLInputElement>()

function startEdit() {
  editValue.value = props.myName
  editing.value = true
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

function commitEdit() {
  const v = editValue.value.trim()
  if (v && v !== props.myName) emit('rename', v)
  editing.value = false
}

function cancelEdit() {
  editing.value = false
}

function onFocusOut(e: FocusEvent) {
  const related = e.relatedTarget as HTMLElement | null
  if (related?.closest('.edit-group')) return
  commitEdit()
}
</script>

<template>
  <div class="connection-bar" :class="{ connected, disconnected: !connected }">
    <span class="status-dot" />
    <span class="status-text">
      {{ connected ? 'Connected' : 'Disconnected' }}
    </span>
    <span class="box-address" :title="boxAddress">{{ boxAddress }}</span>
    <span
      v-if="!editing"
      class="user-badge me"
      :style="{ background: myColor }"
      @click="startEdit"
    >
      {{ myName }} (you)
    </span>
    <div v-else class="edit-group" @focusout="onFocusOut">
      <input
        ref="inputEl"
        v-model="editValue"
        class="name-input"
        @keydown.enter="commitEdit"
        @keydown.escape="cancelEdit"
      />
      <input
        type="color"
        class="color-picker"
        :value="myColor"
        :title="forcedColor ? 'Change color' : 'Set custom color'"
        @input="emit('setColor', ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="forcedColor"
        class="color-reset"
        title="Reset to name-based color"
        @click="emit('clearColor')"
      >↺</button>
    </div>
    <span v-for="(u, i) in users" :key="i" class="user-badge" :style="{ background: u.color }">
      {{ u.name }}
    </span>
    <button class="action-btn" @click="emit('changeBox')">Change</button>
    <button v-if="!connected" class="action-btn" @click="emit('connect')">Connect</button>
    <button v-else class="action-btn" @click="emit('disconnect')">Disconnect</button>
  </div>
</template>

<style scoped>
.connection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  border-bottom: 1px solid #333;
  background: #1a1a2e;
  color: #ccc;
}
.connection-bar.connected {
  background: #0a2a1a;
}
.connection-bar.disconnected {
  background: #2a0a0a;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}
.connected .status-dot {
  background: #4caf50;
}
.disconnected .status-dot {
  background: #f44336;
}
.status-text {
  font-weight: 600;
  flex-shrink: 0;
}
.box-address {
  color: #89b4fa;
  font-family: monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
.user-badge {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #fff;
  flex-shrink: 0;
}
.user-badge.me {
  cursor: pointer;
  outline: 1px dashed rgba(255,255,255,0.35);
  outline-offset: 1px;
}
.user-badge.me:hover {
  filter: brightness(1.2);
}
.edit-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.name-input {
  background: #333;
  border: 1px solid #89b4fa;
  color: #fff;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  outline: none;
  width: 100px;
}
.color-picker {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid #555;
  border-radius: 3px;
  cursor: pointer;
  background: none;
  flex-shrink: 0;
}
.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}
.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}
.color-reset {
  background: none;
  border: 1px solid #555;
  color: #a6adc8;
  font-size: 12px;
  padding: 0 3px;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.4;
  flex-shrink: 0;
}
.color-reset:hover {
  border-color: #cdd6f4;
  color: #cdd6f4;
}
.action-btn {
  background: #333;
  border: 1px solid #555;
  color: #ccc;
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
}
.action-btn:hover {
  background: #444;
}
</style>
