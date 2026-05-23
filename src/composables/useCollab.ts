import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { parseHash } from '../lib/hash'
import { getY } from '../lib/ytools'
import { useCompatibleVFS, ensureMapPath } from './useCompatibleVFS'

const NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
  'Grace', 'Heidi', 'Ivan', 'Judy', 'Kevin', 'Linda',
]

const LS_NAME_KEY = 'typst-collab:user-name'
const randItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function nameToColor(name: string): string {
  const h = hashString(name) % 360
  return `hsl(${h}, 70%, 35%)`
}

export function useCollab() {
  const connected = ref(false)
  const users = ref<{ name: string; color: string }[]>([])
  const vfsReady = ref(false)
  const mainFile = ref('main.typ')
  const myName = ref(localStorage.getItem(LS_NAME_KEY) || randItem(NAMES))
  const myColor = computed(() => nameToColor(myName.value))

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
    aw.setLocalStateField('user', { name: myName.value, color: myColor.value })
    watch(myName, (name) => {
      localStorage.setItem(LS_NAME_KEY, name)
      aw.setLocalStateField('user', { name, color: myColor.value })
    })

    aw.on('change', () => {
      const states = aw.getStates()
      const list: { name: string; color: string }[] = []
      states.forEach((state: any, clientId: number) => {
        if (clientId === aw.clientID) return
        if (state.user) {
          list.push({
            name: state.user.name || `User ${clientId}`,
            color: state.user.color || '#666',
          })
        }
      })
      users.value = list
    })

    const meta = ydoc.getMap<any>('meta')
    const stored = meta.get('mainFile')
    if (typeof stored === 'string') mainFile.value = stored
    meta.observe(() => {
      const v = meta.get('mainFile')
      if (typeof v === 'string') mainFile.value = v
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

  function setMainFile(path: string) {
    if (!ydoc) return
    const meta = ydoc.getMap<any>('meta')
    meta.set('mainFile', path)
    mainFile.value = path
  }

  function setMyName(name: string) {
    myName.value = name
  }

  function getYDoc(): Y.Doc | null {
    return ydoc
  }

  onUnmounted(() => {
    provider?.disconnect()
  })

  return {
    connected,
    users,
    vfsReady,
    mainFile,
    myName,
    myColor,
    awareness,
    initFromHash,
    connect,
    disconnect,
    getVFS,
    setMainFile,
    setMyName,
    getYDoc,
  }
}
