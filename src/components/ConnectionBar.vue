<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = defineProps<{
  connected: boolean
  users: { name: string; color: string }[]
  boxAddress: string
  myName: string
  myColor: string
}>()

const emit = defineEmits<{
  connect: []
  disconnect: []
  changeBox: []
  rename: [name: string]
}>()

const editing = ref(false)
const editValue = ref('')
let inputEl: HTMLInputElement | undefined

function startEdit() {
  editValue.value = props.myName
  editing.value = true
  nextTick(() => {
    inputEl?.focus()
    inputEl?.select()
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
    <input
      v-else
      ref="inputEl"
      v-model="editValue"
      class="name-input"
      @blur="commitEdit"
      @keydown.enter="commitEdit"
      @keydown.escape="cancelEdit"
    />
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
.name-input {
  background: #333;
  border: 1px solid #89b4fa;
  color: #fff;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  outline: none;
  width: 100px;
  flex-shrink: 0;
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
