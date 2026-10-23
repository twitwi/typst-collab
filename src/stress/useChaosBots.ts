// In-page chaos bots (?chaos=1): headless collaborators joining the SAME room
// as the real UI, so you watch the editor react to concurrent edits live.
// Bots use disableBc:true (like the headless harness) so all sync is
// server-mediated and async — faithful remote-peer behavior.
// Safety: only mounted when the URL has ?chaos, and start() asks confirm().

import { onUnmounted, ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { openVfs, parseHash } from '@/boxtools'
import { applyOp, mulberry32, randomOp, stateHash, type StressClient } from '../../stress/core'

export interface ChaosBot extends StressClient {
  ops: number
  fullProvider: WebsocketProvider
}

export interface ChaosLog {
  t: string
  msg: string
}

export function useChaosBots(getMainDoc: () => Y.Doc | null) {
  const bots = ref<ChaosBot[]>([])
  const running = ref(false)
  const log = ref<ChaosLog[]>([])
  const diverged = ref<boolean | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined
  let rngState = 1

  function pushLog(msg: string) {
    log.value.push({ t: new Date().toLocaleTimeString(), msg })
    if (log.value.length > 60) log.value.shift()
  }

  /** Resolve once the provider has received the room state (or after a cap). */
  function whenSynced(provider: WebsocketProvider): Promise<void> {
    if (provider.synced) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(cap)
        provider.off('sync', onSync)
        resolve()
      }
      const onSync = (synced: boolean) => { if (synced) done() }
      const cap = setTimeout(done, 10_000)
      provider.on('sync', onSync)
    })
  }

  async function start(addr: string, botCount = 2, seed = 7) {
    if (running.value) return
    if (!confirm(`Start ${botCount} chaos bots in this room?\nThey will concurrently create/edit/rename/delete files until stopped.`)) {
      return
    }
    running.value = true
    const p = parseHash(addr)
    // Unique tag per page: two peers both starting "chaos0" would race on
    // stress/chaos0 and orphan each other's subtree (children-key LWW).
    const tag = Math.random().toString(36).slice(2, 6)
    rngState = seed
    for (let i = 0; i < botCount; i++) {
      const name = `chaos${i}-${tag}`
      const doc = new Y.Doc()
      const provider = new WebsocketProvider(
        p.server.includes('://') ? p.server : `wss://${p.server}`,
        `${p.docname}?t=${p.token}`,
        doc,
        { disableBc: true },
      )
      provider.awareness.setLocalStateField('user', { name, color: '#ff00ff' })
      pushLog(`${name} joining ${p.docname}`)
      // MUST sync before opening the box: creating it concurrently on an
      // unsynced doc gives every peer its own root map, and root-key LWW
      // orphans all but one — all peers stay "synced" while files vanish.
      await whenSynced(provider)
      if (!running.value) { provider.destroy(); return } // stop() during join
      const vfs = openVfs(doc, p.path, true)!
      bots.value.push({ name, doc, provider: provider as unknown as StressClient['provider'], vfs, ops: 0, fullProvider: provider })
      pushLog(`${name} ready (${vfs.listFiles().length} files in box)`)
    }
    if (!running.value) return // stopped while joining
    timer = setInterval(burst, 1500)
    pushLog('chaos running (burst every 1.5s)')
  }

  function burst() {
    const known = ['a.typ', 'b.typ', 'dir/c.typ', 'old.typ', 'main.typ']
    for (const b of bots.value) {
      const rng = mulberry32((rngState++ * 7919) >>> 0)
      for (let k = 0; k < 5; k++) {
        applyOp(b.vfs, randomOp(rng, b.name, known))
        b.ops++
      }
    }
  }

  async function checkConvergence(): Promise<void> {
    diverged.value = null
    // A fixed sleep is a coin flip: bursts fire every 1.5s, so a snapshot can
    // land with updates still in flight. Pause production, then wait for a
    // genuinely stable all-synced state before judging.
    const wasRunning = running.value
    if (wasRunning) {
      running.value = false
      if (timer !== undefined) { clearInterval(timer); timer = undefined }
    }
    pushLog('paused; waiting for stable quiescence...')
    const deadline = Date.now() + 15_000
    let lastSig = ''
    let stable = 0
    let hashes: string[] = []
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150))
      const main = getMainDoc()
      hashes = bots.value.map((b) => `${b.name}=${stateHash(b.doc)}`)
      if (main) hashes.push(`main=${stateHash(main)}`)
      const sig = hashes.map((h) => h.split('=')[1]).join(',')
      const allSynced = bots.value.every((b) => b.fullProvider.synced)
      if (allSynced && new Set(sig.split(',')).size === 1 && sig === lastSig) {
        if (++stable >= 3) break
      } else {
        stable = 0
      }
      lastSig = sig
    }
    diverged.value = new Set(hashes.map((h) => h.split('=')[1])).size !== 1
    pushLog(diverged.value ? `DIVERGED: ${hashes.join(' ')}` : `converged (${hashes[0]?.split('=')[1] ?? 'n/a'})`)
    if (wasRunning) {
      running.value = true
      timer = setInterval(burst, 1500)
      pushLog('resumed')
    }
  }

  function stop() {
    running.value = false
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
    for (const b of bots.value) {
      try {
        b.fullProvider.disconnect()
      } catch { /* already gone */ }
    }
    pushLog(`stopped after ${bots.value.reduce((n, b) => n + b.ops, 0)} total bot ops`)
  }

  onUnmounted(stop)

  return { bots, running, log, diverged, start, stop, checkConvergence }
}
