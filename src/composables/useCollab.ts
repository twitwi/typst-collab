import { ref, onUnmounted, type Ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { parseHash } from '../lib/hash'
import { getY } from '../lib/ytools'
import { useCompatibleVFS, ensureMapPath } from './useCompatibleVFS'

const COLORS = [
  '#f38ba8', '#a6e3a1', '#89b4fa', '#f9e2af',
  '#fab387', '#94e2d5', '#cba6f7', '#eba0ac',
]
const NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
  'Grace', 'Heidi', 'Ivan', 'Judy', 'Kevin', 'Linda',
]

const randItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function useCollab() {
  const connected = ref(false)
  const users = ref<{ name: string; color: string }[]>([])
  const vfsReady = ref(false)
  const myName = randItem(NAMES)
  const myColor = randItem(COLORS)

  const awareness = ref<any>(null)
  let ydoc: Y.Doc | null = null
  let provider: WebsocketProvider | null = null
  let vfs: ReturnType<typeof useCompatibleVFS> | null = null

  function initFromHash(hash: string) {
    const p = parseHash(hash)

    ydoc = new Y.Doc()

    provider = new WebsocketProvider(
      p.server.includes('://') ? p.server : `wss://${p.server}`,
      `${p.docname}?t=${p.token}`,
      ydoc,
      { connect: false }
    )

    provider.on('status', (event: { status: string }) => {
      connected.value = event.status === 'connected'
    })

    provider.on('sync', (synced: boolean) => {
      if (!synced) return
      const existing = getY(ydoc!, p.path)
      if (existing && existing instanceof Y.Map) {
        vfs = useCompatibleVFS(existing)
      } else {
        const created = ensureMapPath(ydoc!, p.path)
        vfs = useCompatibleVFS(created, true)
      }
      vfsReady.value = true
    })

    const aw = provider.awareness
    awareness.value = aw
    aw.setLocalStateField('user', { name: myName, color: myColor })

    aw.on('change', () => {
      const states = aw.getStates()
      const list: { name: string; color: string }[] = []
      states.forEach((state: any, _clientId: number) => {
        if (state.user) {
          list.push({
            name: state.user.name || `User ${_clientId}`,
            color: state.user.color || '#666',
          })
        }
      })
      users.value = list
    })

    return { ydoc, provider }
  }

  function connect() {
    provider?.connect()
  }

  function disconnect() {
    provider?.disconnect()
  }

  function getVFS(): ReturnType<typeof useCompatibleVFS> {
    if (!vfs) throw new Error('VFS not initialized')
    return vfs
  }

  onUnmounted(() => {
    provider?.disconnect()
  })

  return {
    connected,
    users,
    vfsReady,
    awareness,
    initFromHash,
    connect,
    disconnect,
    getVFS,
  }
}
