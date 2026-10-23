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

  function start(addr: string, botCount = 2, seed = 7) {
    if (running.value) return
    if (!confirm(`Start ${botCount} chaos bots in this room?\nThey will concurrently create/edit/rename/delete files until stopped.`)) {
      return
    }
    const p = parseHash(addr)
    rngState = seed
    for (let i = 0; i < botCount; i++) {
      const name = `chaos${i}`
      const doc = new Y.Doc()
      const provider = new WebsocketProvider(
        p.server.includes('://') ? p.server : `wss://${p.server}`,
        `${p.docname}?t=${p.token}`,
        doc,
        { disableBc: true },
      )
      provider.awareness.setLocalStateField('user', { name, color: '#ff00ff' })
      const vfs = openVfs(doc, p.path, true)!
      bots.value.push({ name, doc, provider: provider as unknown as StressClient['provider'], vfs, ops: 0, fullProvider: provider })
      pushLog(`${name} joining ${p.docname}`)
    }
    running.value = true
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
    pushLog('waiting 3s for quiescence, then comparing...')
    await new Promise((r) => setTimeout(r, 3000))
    const main = getMainDoc()
    const hashes = bots.value.map((b) => `${b.name}=${stateHash(b.doc)}`)
    if (main) hashes.push(`main=${stateHash(main)}`)
    const uniq = new Set(hashes.map((h) => h.split('=')[1]))
    diverged.value = uniq.size !== 1
    pushLog(diverged.value ? `DIVERGED: ${hashes.join(' ')}` : `converged (${hashes[0].split('=')[1]})`)
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
