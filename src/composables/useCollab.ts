import { ref, onUnmounted, type Ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { parseHash } from '../lib/hash'
import { useCompatibleVFS } from './useCompatibleVFS'

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
  const myName = randItem(NAMES)
  const myColor = randItem(COLORS)
  const parsed = ref<{ server: string; docname: string; token: string; path: string } | null>(null)

  let ydoc: Y.Doc | null = null
  let provider: WebsocketProvider | null = null
  let vfs: ReturnType<typeof useCompatibleVFS> | null = null
  let awareness: any = null

  function initFromHash(hash: string) {
    const p = parseHash(hash)
    parsed.value = p

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
      if (synced) connected.value = true
    })

    awareness = provider.awareness
    awareness.setLocalStateField('user', { name: myName, color: myColor })

    awareness.on('change', () => {
      const states = awareness.getStates()
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

    vfs = useCompatibleVFS(ydoc, p.path)

    return { ydoc, provider, vfs }
  }

  function connect() {
    provider?.connect()
  }

  function disconnect() {
    provider?.disconnect()
  }

  function getVFS(): ReturnType<typeof useCompatibleVFS> {
    if (!vfs) throw new Error('VFS not initialized. Call initFromHash first.')
    return vfs
  }

  onUnmounted(() => {
    provider?.disconnect()
  })

  return {
    parsed,
    connected,
    users,
    awareness,
    initFromHash,
    connect,
    disconnect,
    getVFS,
  }
}
