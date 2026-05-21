import { ref, onUnmounted, type Ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const COLORS = [
  '#f38ba8', '#a6e3a1', '#89b4fa', '#f9e2af',
  '#fab387', '#94e2d5', '#cba6f7', '#eba0ac',
]
const NAMES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
  'Grace', 'Heidi', 'Ivan', 'Judy', 'Kevin', 'Linda',
]

const randItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export interface CollabState {
  ydoc: Y.Doc
  ytext: Y.Text
  provider: WebsocketProvider
  awareness: any
  connected: Ref<boolean>
  users: Ref<{ name: string; color: string }[]>
}

const ydoc = new Y.Doc()
const ytext = ydoc.getText('content')

export function useCollab(room: string, serverUrl = 'ws://localhost:4000') {
  const connected = ref(false)
  const users = ref<{ name: string; color: string }[]>([])
  const myName = randItem(NAMES)
  const myColor = randItem(COLORS)

  const provider = new WebsocketProvider(serverUrl, room, ydoc, {
    connect: false,
  })

  provider.on('status', (event: { status: string }) => {
    connected.value = event.status === 'connected'
  })

  provider.on('sync', (synced: boolean) => {
    if (synced) connected.value = true
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
    ydoc,
    ytext,
    provider,
    awareness,
    connected,
    users,
    connect,
    disconnect,
  }
}
