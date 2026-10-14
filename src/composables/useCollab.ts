import { ref, computed, watch, onUnmounted } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { parseHash, openVfs, type Vfs } from '@/boxtools'

const NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
  'Grace', 'Heidi', 'Ivan', 'Judy', 'Kevin', 'Linda',
]

const LS_NAME_KEY = 'typst-collab:user-name'
const LS_COLOR_KEY = 'typst-collab:user-color'
const randItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function useCollab() {
  const connected = ref(false)
  const users = ref<{ name: string; color: string }[]>([])
  const vfsReady = ref(false)
  const mainFile = ref('main.typ')
  const myName = ref(localStorage.getItem(LS_NAME_KEY) || randItem(NAMES))
  const forcedColor = ref<string | null>(localStorage.getItem(LS_COLOR_KEY))
  const myColor = computed(() => forcedColor.value || nameToColor(myName.value))

  const awareness = ref<any>(null)
  let ydoc: Y.Doc | null = null
  let provider: WebsocketProvider | null = null
  let vfsImpl: Vfs | null = null
  const _version = ref(0)

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
      // Open the existing box map, or create the chain (root is materialized
      // lazily on first write — an empty box lists as [] either way).
      const vfs = openVfs(ydoc!, p.path, true)
      if (!vfs) return
      vfsImpl = vfs
      vfsImpl.description.observeDeep(() => { _version.value++ })
      vfsReady.value = true
    })

    const aw = provider.awareness
    awareness.value = aw
    aw.setLocalStateField('user', { name: myName.value, color: myColor.value })
    watch([myName, forcedColor], () => {
      localStorage.setItem(LS_NAME_KEY, myName.value)
      aw.setLocalStateField('user', { name: myName.value, color: myColor.value })
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

  function getVFS(): Vfs {
    if (!vfsImpl) throw new Error('VFS not initialized')
    return vfsImpl
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

  function setForcedColor(c: string | null) {
    forcedColor.value = c
  }

  watch(forcedColor, (c) => {
    if (c) localStorage.setItem(LS_COLOR_KEY, c)
    else localStorage.removeItem(LS_COLOR_KEY)
  })

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
    forcedColor,
    awareness,
    version: _version,
    initFromHash,
    connect,
    disconnect,
    getVFS,
    setMainFile,
    setMyName,
    setForcedColor,
    getYDoc,
  }
}
