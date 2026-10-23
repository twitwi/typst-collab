// Shared stress core: seeded RNG, op model, convergence + assertions.
// Runs both in Node (headless harness) and in the browser (chaos bots).
// Only depends on yjs + boxtools (both universal). No node/browser APIs.

import * as Y from 'yjs'

// Narrow capability surface the stress ops need. Deliberately NOT the full
// Vfs: method-only signatures stay structurally compatible across module
// boundaries, while Vfs.description carries nominal Yjs class types that can
// spuriously mismatch when core is compiled from outside src/.
export interface OpTarget {
  setFile(path: string, content: string | Uint8Array): void
  deleteNode(path: string): void
  renameNode(oldPath: string, newPath: string): void
  mkdir(path: string): void
  listFiles(): string[]
  readFileAsBytes(path: string): Uint8Array | null
}

export interface StressClient {
  name: string
  doc: Y.Doc
  /** Minimal provider surface both harnesses provide (real WebsocketProvider). */
  provider: { synced: boolean; disconnect(): void; connect(): void }
  vfs: OpTarget
}

/** Deterministic RNG (mulberry32). Same seed -> same op stream everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Op =
  | { kind: 'setFile'; path: string; content: string }
  | { kind: 'setBytes'; path: string; bytes: number[] }
  | { kind: 'delete'; path: string }
  | { kind: 'rename'; from: string; to: string }
  | { kind: 'mkdir'; path: string }

const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'typst', 'hello', 'sync', 'merge', 'box']

export function randomContent(rng: () => number, lines = 3): string {
  const out: string[] = []
  for (let i = 0; i < lines; i++) {
    const n = 2 + Math.floor(rng() * 5)
    const words: string[] = []
    for (let j = 0; j < n; j++) words.push(WORDS[Math.floor(rng() * WORDS.length)])
    out.push(words.join(' '))
  }
  return out.join('\n')
}

/** Random op over a small shared file set (paths chosen to collide often). */
export function randomOp(rng: () => number, tag: string, known: string[]): Op {
  const roll = rng()
  const pick = known.length > 0 && rng() < 0.7
    ? known[Math.floor(rng() * known.length)].replace(/\/$/, '')
    : `f${Math.floor(rng() * 5)}.typ`
  const mine = (p: string) => `stress/${tag}/${p}`
  if (roll < 0.45) return { kind: 'setFile', path: mine(pick), content: `// ${tag}\n${randomContent(rng)}` }
  if (roll < 0.55) {
    return { kind: 'setBytes', path: mine(`img${Math.floor(rng() * 3)}.bin`), bytes: [137, 80, 78, Math.floor(rng() * 256)] }
  }
  if (roll < 0.65) return { kind: 'delete', path: mine(pick) }
  if (roll < 0.8) return { kind: 'rename', from: mine(pick), to: mine(`f${Math.floor(rng() * 5)}.typ`) }
  return { kind: 'mkdir', path: mine(`dir${Math.floor(rng() * 3)}`) }
}

export function applyOp(vfs: OpTarget, op: Op): void {
  try {
    switch (op.kind) {
      case 'setFile':
        vfs.setFile(op.path, op.content)
        break
      case 'setBytes':
        vfs.setFile(op.path, new Uint8Array(op.bytes))
        break
      case 'delete':
        vfs.deleteNode(op.path)
        break
      case 'rename':
        if (op.from !== op.to) vfs.renameNode(op.from, op.to)
        break
      case 'mkdir':
        vfs.mkdir(op.path)
        break
    }
  } catch {
    // Races (rename onto existing, file-in-the-way) are legal outcomes:
    // both harnesses assert convergence, not op success.
  }
}

/** Short hex digest of the full doc state. Equal <=> converged (same schema). */
export function stateHash(doc: Y.Doc): string {
  const update = Y.encodeStateAsUpdate(doc)
  let h = 5381
  for (let i = 0; i < update.length; i++) h = ((h << 5) + h + update[i]) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function fileSnapshot(vfs: OpTarget): { files: string[]; contents: Record<string, string> } {
  const files = vfs.listFiles()
  const contents: Record<string, string> = {}
  for (const f of files) {
    if (f.endsWith('/')) continue
    const bytes = vfs.readFileAsBytes(f)
    contents[f] = bytes ? Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('') : '<null>'
  }
  return { files, contents }
}

export interface QuiescentOptions {
  timeoutMs?: number
  stableRounds?: number
  pollMs?: number
}

/** Wait until all providers report synced AND all state hashes agree (twice). */
export async function waitQuiescent(clients: StressClient[], opts: QuiescentOptions = {}): Promise<void> {
  const { timeoutMs = 30000, stableRounds = 2, pollMs = 500 } = opts
  const deadline = Date.now() + timeoutMs
  let stable = 0
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs))
    const hashes = clients.map((c) => stateHash(c.doc))
    const allSynced = clients.every((c) => c.provider.synced)
    if (allSynced && hashes.every((h) => h === hashes[0])) {
      stable++
      if (stable >= stableRounds) return
    } else {
      stable = 0
    }
    if (Date.now() > deadline) {
      const updates = clients.map((c) => Y.encodeStateAsUpdate(c.doc))
      const detail = clients
        .map((c, i) => {
          const snap = fileSnapshot(c.vfs)
          // Update bytes client i has that client 0 lacks, and vice versa.
          // (Pure Yjs, universal. headless.ts dumps the raw bins on failure.)
          const missingOn0 = i === 0 ? 0 : Y.diffUpdate(updates[i], Y.encodeStateVector(clients[0].doc)).length
          const missingOnI = i === 0 ? 0 : Y.diffUpdate(updates[0], Y.encodeStateVector(c.doc)).length
          return `${c.name} updlen=${updates[i].length} not-on-0=${missingOn0}B not-on-i=${missingOnI}B files=${snap.files.length} [${snap.files.join(',')}]`
        })
        .join('\n  ')
      throw new Error(
        `quiescence timeout: synced=[${clients.map((c) => c.provider.synced)}] hashes=[${hashes}]\n  ${detail}\n  full updates dumped to /tmp/stress-<name>.bin`,
      )
    }
  }
}

/** Throw with a divergence dump unless all clients agree on state + files. */
export function assertConverged(clients: StressClient[], label: string): void {
  const hashes = clients.map((c) => `${c.name}=${stateHash(c.doc)}`)
  if (!hashes.every((h) => h.split('=')[1] === hashes[0].split('=')[1])) {
    throw new Error(`DIVERGED [${label}]: ${hashes.join(' ')}`)
  }
  const snaps = clients.map((c) => JSON.stringify(fileSnapshot(c.vfs)))
  if (!snaps.every((s) => s === snaps[0])) {
    const dump = clients.map((c, i) => `${c.name}: ${snaps[i]}`).join('\n')
    throw new Error(`FILE-SET DIVERGED [${label}]:\n${dump}`)
  }
}
