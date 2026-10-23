// Headless stress client: N simulated collaborators against a live server.
// Bundled with esbuild (see build.mjs) -> stress/dist/headless.mjs, run by node.
//
// Usage:
//   node stress/dist/headless.mjs --clients=3 --server=ws://localhost:1234 \
//     --room=TEST/stress1 --token=TEST_stress1 --boxpath=stressbox \
//     --seed=42 --ops=200 --phase=all

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import WebSocket from 'ws'
import * as fs from 'node:fs'
import { openVfs } from 'yjs-boxtools'
import type { OpTarget } from './core'
import {
  applyOp,
  assertConverged,
  mulberry32,
  randomContent,
  randomOp,
  stateHash,
  waitQuiescent,
  type StressClient,
} from './core'

// y-websocket uses the global WebSocket; node needs the `ws` package.
;(globalThis as Record<string, unknown>).WebSocket = WebSocket

interface Args {
  clients: number
  server: string
  room: string
  token: string
  boxpath: string
  seed: number
  ops: number
  phase: string
}

function parseArgs(): Args {
  const get = (k: string, d: string) => {
    const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
    return hit ? hit.slice(k.length + 3) : d
  }
  return {
    clients: Number(get('clients', '3')),
    server: get('server', 'ws://localhost:1234'),
    room: get('room', 'TEST/stress1'),
    token: get('token', 'TEST_stress1'),
    boxpath: get('boxpath', 'stressbox'),
    seed: Number(get('seed', '42')),
    ops: Number(get('ops', '200')),
    phase: get('phase', 'all'),
  }
}

async function makeClient(name: string, args: Args): Promise<StressClient> {
  const doc = new Y.Doc()
  // disableBc: y-websocket cross-tab BroadcastChannel delivers same-room
  // updates SYNCHRONOUSLY in-process (lib0 local channels). Bots must behave
  // like separate machines: all sync goes through the server (async).
  const provider = new WebsocketProvider(args.server, `${args.room}?t=${args.token}`, doc, {
    disableBc: true,
  })
  const client: StressClient = { name, doc, provider: provider as unknown as StressClient['provider'], vfs: null as unknown as OpTarget }
  await waitQuiescent([client], { timeoutMs: 15000, stableRounds: 1 })
  client.vfs = openVfs(doc, args.boxpath, true)!
  return client
}

async function barrier(clients: StressClient[], label: string): Promise<void> {
  await waitQuiescent(clients)
  assertConverged(clients, label)
  console.log(`  ok [${label}] hashes=${clients.map((c) => stateHash(c.doc)).join(',')}`)
}

function ytext(client: StressClient, path: string): Y.Text {
  const t = client.vfs.getFile(path)
  if (!t) throw new Error(`${client.name}: no such file ${path}`)
  return t
}

async function phaseScripted(clients: StressClient[]): Promise<void> {
  // DISCIPLINE (see stress/README.md): a directory must exist AND be synced
  // before anyone writes into it. Concurrent implicit parent creation orphans
  // whole subtrees (distinct node ids, children-key LWW) — phase 0 proves the
  // bootstrap, the chaos phase later shows orphan-freedom under discipline.
  // 0. single-writer bootstrap of shared dirs
  console.log('phase 0: bootstrap shared dirs')
  clients[0].vfs.mkdir('phase1')
  clients[0].vfs.mkdir('shared')
  clients[0].vfs.mkdir('stress')
  clients[0].vfs.mkdir('offline')
  await barrier(clients, 'bootstrap')
  // 1. concurrent distinct-file creation (distinct names => distinct keys => merge)
  console.log('phase 1: concurrent create')
  clients.forEach((c, i) => c.vfs.setFile(`phase1/${c.name}.typ`, `= ${c.name}\nhello ${i}`))
  await barrier(clients, 'concurrent-create')
  for (const c of clients) {
    for (const d of clients) {
      if (!c.vfs.getFile(`phase1/${d.name}.typ`)) throw new Error(`missing phase1/${d.name}.typ on ${c.name}`)
    }
  }

  // 2. disjoint-region char edits merge (true CRDT region merge via Y.Text)
  console.log('phase 2: disjoint region edits')
  clients[0].vfs.setFile('shared.typ', 'AAA\nBBB\nCCC\n')
  await barrier(clients, 'shared-seed')
  clients.forEach((c, i) => {
    c.doc.transact(() => {
      // each client appends its marker to a different line (offsets drift but regions stay disjoint)
      const t = ytext(c, 'shared.typ')
      t.insert(t.length, `${c.name}-L${i}\n`)
    })
  })
  await barrier(clients, 'disjoint-merge')
  for (const c of clients) {
    const s = c.vfs.readFileAsString('shared.typ')!
    for (const d of clients) {
      if (!s.includes(`${d.name}-L`)) throw new Error(`marker ${d.name} missing on ${c.name}: ${JSON.stringify(s)}`)
    }
  }

  // Genuine races need offline-concurrent updates: disconnect, apply locally
  // on each client, reconnect, converge. (Same-process BC is disabled, but
  // even server-mediated sync would serialize back-to-back local ops.)
  const isolate = (cs: StressClient[]) => cs.forEach((c) => c.provider.disconnect())
  const rejoin = (cs: StressClient[]) => cs.forEach((c) => c.provider.connect())

  // 3. same-offset concurrent inserts converge (content unspecified, equality required)
  console.log('phase 3: same-offset race')
  isolate(clients)
  clients.forEach((c) => {
    c.doc.transact(() => {
      ytext(c, 'shared.typ').insert(0, `[${c.name}]`)
    })
  })
  rejoin(clients)
  await barrier(clients, 'same-offset-race')

  // 4. rename-vs-edit: A renames, B edits the same file concurrently
  console.log('phase 4: rename vs edit')
  const [a, b] = clients
  a.vfs.setFile('race.typ', 'base\n')
  await barrier(clients, 'race-seed')
  isolate([a, b])
  a.vfs.renameNode('race.typ', 'renamed.typ')
  b.doc.transact(() => ytext(b, 'race.typ').insert(0, 'EDITED-BY-B\n'))
  rejoin([a, b])
  await barrier(clients, 'rename-vs-edit')
  for (const c of clients) {
    const s = c.vfs.readFileAsString('renamed.typ')
    if (s === null || !s.includes('EDITED-BY-B')) {
      throw new Error(`rename-vs-edit lost B's edit on ${c.name}: ${JSON.stringify(s)}`)
    }
  }

  // 5. delete-vs-edit: equality only (either outcome is a legal merge)
  console.log('phase 5: delete vs edit')
  isolate([a, b])
  a.vfs.deleteNode('renamed.typ')
  b.doc.transact(() => {
    const t = b.vfs.getFile('renamed.typ')
    if (t) t.insert(t.length, 'B-WAS-HERE\n')
  })
  rejoin([a, b])
  await barrier(clients, 'delete-vs-edit')

  // 6. binary race on one path
  console.log('phase 6: binary race')
  isolate(clients)
  clients.forEach((c, i) => c.vfs.setFile('pic.bin', new Uint8Array([137, 80, i, 255])))
  rejoin(clients)
  await barrier(clients, 'binary-race')

  // 7. offline client catches up
  console.log('phase 7: offline catch-up')
  const last = clients[clients.length - 1]
  last.provider.disconnect()
  await new Promise((r) => setTimeout(r, 1000)) // let the close settle (see chaos note)
  clients.slice(0, -1).forEach((c) => c.vfs.setFile(`offline/${c.name}.typ`, randomContent(mulberry32(7), 2)))
  await waitQuiescent(clients.slice(0, -1))
  last.provider.connect()
  await barrier(clients, 'offline-catchup')
}

async function phaseChaos(clients: StressClient[], args: Args): Promise<void> {
  console.log(`chaos: ${args.ops} ops/client, seed=${args.seed}`)
  let total = 0
  for (const [i, c] of clients.entries()) {
    const rng = mulberry32(args.seed + i * 1000)
    const known = ['a.typ', 'b.typ', 'dir/c.typ', 'old.typ']
    for (let k = 0; k < args.ops; k++) {
      if (k === Math.floor(args.ops / 2) && i === 0 && !process.env.STRESS_NODROP) {
        // Mid-run partition for client 0. The close handshake must settle
        // before reconnecting: connect() racing a closing socket leaves the
        // provider believing it is synced while missing updates (stable
        // divergence with synced=true). Settle, then act, then rejoin.
        c.provider.disconnect()
        await new Promise((r) => setTimeout(r, 1000))
        applyOp(c.vfs, randomOp(rng, c.name, known))
        c.provider.connect()
        await waitQuiescent([c], { timeoutMs: 15000, stableRounds: 1 })
      } else {
        applyOp(c.vfs, randomOp(rng, c.name, known))
      }
      total++
    }
  }
  console.log(`  applied ${total} ops, waiting for convergence...`)
  await barrier(clients, 'chaos-soak')
  for (const c of clients) {
    const stale = c.vfs.sweepStaleKeys()
    if (stale !== 0) console.log(`  note: ${c.name} swept ${stale} stale keys (expected 0 on clean runs)`)
  }
}

let liveClients: StressClient[] = []

async function main(): Promise<void> {
  const args = parseArgs()
  console.log(`stress: ${args.clients} clients -> ${args.server} room=${args.room} box=${args.boxpath}`)
  const clients: StressClient[] = []
  liveClients = clients
  for (let i = 0; i < args.clients; i++) {
    clients.push(await makeClient(`bot${i}`, args))
  }
  console.log(`connected ${clients.length} clients`)
  if (args.phase === 'all' || args.phase === 'scripted') await phaseScripted(clients)
  if (args.phase === 'all' || args.phase === 'chaos') await phaseChaos(clients, args)
  console.log('ALL GREEN')
  for (const c of clients) c.provider.disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error('STRESS FAILED:', e instanceof Error ? e.message : e)
  for (const c of liveClients) {
    try {
      fs.writeFileSync(`/tmp/stress-${c.name}.bin`, Buffer.from(Y.encodeStateAsUpdate(c.doc)))
    } catch { /* best effort */ }
  }
  if (liveClients.length > 0) console.error('full updates dumped to /tmp/stress-<name>.bin')
  process.exit(1)
})
