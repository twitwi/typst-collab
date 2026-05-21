<script setup lang="ts">
import { useCollab } from '../composables/useCollab'

const props = defineProps<{
  connected: boolean
  users: { name: string; color: string }[]
  room: string
}>()

const emit = defineEmits<{
  connect: []
  disconnect: []
}>()
</script>

<template>
  <div class="connection-bar" :class="{ connected: connected, disconnected: !connected }">
    <span class="status-dot" />
    <span class="status-text">
      {{ connected ? 'Connected' : 'Disconnected' }}
    </span>
    <span class="room-label">{{ room }}</span>
    <span v-for="(u, i) in users" :key="i" class="user-badge" :style="{ background: u.color }">
      {{ u.name }}
    </span>
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
}
.connected .status-dot {
  background: #4caf50;
}
.disconnected .status-dot {
  background: #f44336;
}
.status-text {
  font-weight: 600;
}
.room-label {
  color: #888;
  margin-left: 4px;
}
.user-badge {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: #fff;
}
.action-btn {
  margin-left: auto;
  background: #333;
  border: 1px solid #555;
  color: #ccc;
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 11px;
}
.action-btn:hover {
  background: #444;
}
</style>
