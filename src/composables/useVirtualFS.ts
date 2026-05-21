import { ref, type Ref } from 'vue'
import * as Y from 'yjs'

const TEXT_EXTENSIONS = new Set([
  '.typ', '.bib', '.yml', '.yaml', '.json', '.toml', '.csv', '.txt', '.md',
])

export function isProbablyBinary(content: string): boolean {
  if (!content) return false
  const reEncoded = new TextDecoder().decode(new TextEncoder().encode(content))
  if (reEncoded !== content) return true
  for (let i = 0; i < Math.min(1024, content.length); i++) {
    const c = content.charCodeAt(i)
    if (c === 0 || (c > 127 && c < 32 && c !== 9 && c !== 10 && c !== 13)) return true
  }
  return false
}

function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function useVirtualFS(ydoc: Y.Doc) {
  const files = ydoc.getMap<Y.Text>('files')
  const version = ref(0)

  const increment = () => { version.value++ }

  files.observeDeep(() => { increment() })

  function listFiles(): string[] {
    return [...files.keys()].sort()
  }

  function getFile(path: string): Y.Text | undefined {
    return files.get(path)
  }

  function setFile(path: string, content: string | Uint8Array) {
    if (content instanceof Uint8Array) {
      content = base64Encode(content)
    }
    let ytext = files.get(path)
    if (ytext) {
      ytext.delete(0, ytext.length)
      ytext.insert(0, content)
    } else {
      ytext = new Y.Text(content)
      files.set(path, ytext)
    }
  }

  function deleteFile(path: string) {
    files.delete(path)
  }

  function renameFile(oldPath: string, newPath: string) {
    const ytext = files.get(oldPath)
    if (!ytext || ytext === undefined) return
    files.set(newPath, ytext)
    files.delete(oldPath)
  }

  function readFile(path: string): { content: string; isBinary: boolean } | null {
    const ytext = files.get(path)
    if (!ytext) return null
    const content = ytext.toString()
    if (!content) return { content: '', isBinary: false }
    const isBin = isProbablyBinary(content)
    if (isBin) {
      return { content: content, isBinary: true }
    }
    return { content, isBinary: false }
  }

  function decodeBinary(path: string): Uint8Array | null {
    const entry = readFile(path)
    if (!entry || !entry.isBinary) return null
    return base64Decode(entry.content)
  }

  function isEmpty(): boolean {
    return files.size === 0
  }

  return {
    files,
    version,
    listFiles,
    getFile,
    setFile,
    deleteFile,
    renameFile,
    readFile,
    decodeBinary,
    isEmpty,
    increment,
  }
}
