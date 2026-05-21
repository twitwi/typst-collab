import { ref, onUnmounted, type Ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useVirtualFS } from './useVirtualFS'

const COLORS = [
  '#f38ba8', '#a6e3a1', '#89b4fa', '#f9e2af',
  '#fab387', '#94e2d5', '#cba6f7', '#eba0ac',
]
const NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
  'Grace', 'Heidi', 'Ivan', 'Judy', 'Kevin', 'Linda',
]

const randItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const ydoc = new Y.Doc()

export function useCollab(room: string, serverUrl = 'ws://localhost:4000') {
  const connected = ref(false)
  const users = ref<{ name: string; color: string }[]>([])
  const activeFile = ref('main.typ')
  const myName = randItem(NAMES)
  const myColor = randItem(COLORS)

  const vfs = useVirtualFS(ydoc)

  const provider = new WebsocketProvider(serverUrl, room, ydoc, {
    connect: false,
  })

  provider.on('status', (event: { status: string }) => {
    connected.value = event.status === 'connected'
  })

  provider.on('sync', (synced: boolean) => {
    if (synced) connected.value = true
    if (synced && vfs.isEmpty()) {
      const initial = `= Hello, Typst!

This is a *collaborative* document.

#align(center)[
  #rect(fill: blue.transparentize(0.8))[
    #text(size: 24pt)[Welcome to typst-collab!]
  ]
]

== Features
- Real-time collaboration via Yjs
- Live preview with Typst WASM
- Split pane editor

#lorem(30)
`
      vfs.setFile('main.typ', initial)
      activeFile.value = 'main.typ'
    }
  })

  const awareness = provider.awareness
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

  function setActiveFile(path: string) {
    activeFile.value = path
  }

  function connect() {
    provider.connect()
  }

  function disconnect() {
    provider.disconnect()
  }

  onUnmounted(() => {
    provider.disconnect()
  })

  return {
    vfs,
    activeFile,
    setActiveFile,
    awareness,
    connected,
    users,
    connect,
    disconnect,
  }
}
