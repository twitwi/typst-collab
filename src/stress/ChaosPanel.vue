<script setup lang="ts">
import type * as Y from 'yjs'
import { useChaosBots } from './useChaosBots'

const props = defineProps<{
  boxAddress: string
  getMainDoc: () => Y.Doc | null
}>()

const { bots, running, log, diverged, start, stop, checkConvergence } = useChaosBots(props.getMainDoc)
</script>

<template>
  <div class="chaos-panel">
    <div class="chaos-header">
      <strong>chaos bots (?chaos=1)</strong>
      <span v-if="diverged === true" class="badge bad">DIVERGED</span>
      <span v-else-if="diverged === false" class="badge ok">converged</span>
    </div>
    <div class="chaos-controls">
      <button v-if="!running" @click="start(props.boxAddress)">start 2 bots</button>
      <button v-else @click="stop()">stop</button>
      <button @click="checkConvergence()" :disabled="bots.length === 0">check convergence</button>
    </div>
    <ul class="chaos-bots">
      <li v-for="b in bots" :key="b.name">{{ b.name }} — {{ b.ops }} ops, synced={{ b.provider.synced }}</li>
    </ul>
    <ul class="chaos-log">
      <li v-for="(l, i) in log.slice(-8)" :key="i"><code>{{ l.t }}</code> {{ l.msg }}</li>
    </ul>
  </div>
</template>

<style scoped>
.chaos-panel {
  position: fixed;
  right: 12px;
  bottom: 12px;
  width: 320px;
  max-height: 40vh;
  overflow: auto;
  background: #1e1e2e;
  border: 1px solid #f38ba8;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 12px;
  z-index: 1000;
}
.chaos-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.badge {
  padding: 1px 8px;
  border-radius: 10px;
  font-weight: bold;
}
.badge.ok { background: #a6e3a1; color: #111; }
.badge.bad { background: #f38ba8; color: #111; }
.chaos-controls { display: flex; gap: 6px; margin-bottom: 6px; }
.chaos-controls button {
  background: #313244;
  color: #cdd6f4;
  border: 1px solid #585b70;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
}
.chaos-controls button:disabled { opacity: 0.4; cursor: default; }
.chaos-bots, .chaos-log { list-style: none; margin: 4px 0; padding: 0; color: #a6adc8; }
.chaos-log code { color: #585b70; }
</style>
