import { ref, type Ref } from 'vue'
import * as Y from 'yjs'
import { ROOT_ID, makeBaseNode, initializeInYMap, _generateId, now } from '../lib/ybox'
import type { DirectoryNode, TextNode, BinaryNode } from '../lib/ybox'

function isProbablyBinary(content: string): boolean {
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

export function ensureMapPath(ydoc: Y.Doc, path: string): Y.Map<any> {
  const steps = path.split('/').filter(Boolean)
  if (steps.length === 0) return ydoc.getMap()
  let p = ydoc.getMap()
  for (const step of steps) {
    if (!p.has(step)) p.set(step, new Y.Map())
    const next = p.get(step)
    if (!(next instanceof Y.Map)) throw new Error(`Path segment "${step}" is not a map`)
    p = next
  }
  return p
}

function traverse(description: Y.Map<any>, relPath: string): { parentDir: DirectoryNode; name: string; leafId: string | undefined } | null {
  const steps = relPath.split('/').filter(Boolean)
  if (steps.length === 0) return null
  const name = steps.pop()!
  let currentId = ROOT_ID
  let current = makeBaseNode(description.get(currentId)!) as DirectoryNode
  if (!current || current.type !== 'directory') return null

  for (const part of steps) {
    const childId = current.children?.get(part)
    if (!childId) return null
    const child = makeBaseNode(description.get(childId)!)
    if (!child || child.type !== 'directory') return null
    current = child as DirectoryNode
    currentId = childId
  }

  const leafId = current.children?.get(name)
  return { parentDir: current, name, leafId }
}

function getNode(description: Y.Map<any>, relPath: string): ReturnType<typeof makeBaseNode> | null {
  const result = traverse(description, relPath)
  if (!result || !result.leafId) return null
  const node = description.get(result.leafId)
  if (!node) return null
  return makeBaseNode(node)
}

export function useCompatibleVFS(description: Y.Map<any>, needsInit = false) {
  if (needsInit) initializeInYMap(description)

  const version = ref(0)
  const increment = () => { version.value++ }
  description.observeDeep(() => { increment() })

  function init() {
    initializeInYMap(description)
  }

  function listFiles(): string[] {
    const result: string[] = []
    function walk(dirNode: DirectoryNode, prefix: string) {
      if (!dirNode.children) return
      for (const [name, childId] of dirNode.children) {
        const child = description.get(childId)
        if (!child) continue
        const node = makeBaseNode(child)
        if (node.type === 'deleted') continue
        const fullPath = prefix ? `${prefix}/${name}` : name
        if (node.type === 'directory') {
          walk(node as DirectoryNode, fullPath)
        } else {
          result.push(fullPath)
        }
      }
    }
    const root = makeBaseNode(description.get(ROOT_ID)!) as DirectoryNode
    if (root) walk(root, '')
    return result.sort()
  }

  function getFile(relPath: string): Y.Text | undefined {
    const node = getNode(description, relPath)
    if (!node) return undefined
    if (node.type !== 'text' && node.type !== 'binary') return undefined
    return (node as TextNode | BinaryNode).content
  }

  function readFileAsString(relPath: string): string | null {
    const ytext = getFile(relPath)
    if (!ytext) return null
    return ytext.toString()
  }

  function readFileAsBytes(relPath: string): Uint8Array | null {
    const node = getNode(description, relPath)
    if (!node) return null
    if (node.type === 'binary') {
      const content = (node as BinaryNode).content.toString()
      return base64Decode(content)
    }
    if (node.type === 'text') {
      const content = (node as TextNode).content.toString()
      return new TextEncoder().encode(content)
    }
    return null
  }

  function isBinary(relPath: string): boolean {
    const node = getNode(description, relPath)
    return node?.type === 'binary'
  }

  function setFile(relPath: string, content: string | Uint8Array) {
    const result = traverse(description, relPath)

    if (result && result.leafId) {
      const existing = makeBaseNode(description.get(result.leafId)!)
      if (existing.type === 'text' || existing.type === 'binary') {
        const existingContent = (existing as TextNode | BinaryNode).content
        const strContent = typeof content === 'string' ? content : base64Encode(content)
        existingContent.delete(0, existingContent.length)
        existingContent.insert(0, strContent)
        existing.mtime = now()
        if (typeof content === 'string' && isProbablyBinary(content)) {
          // content turned binary — update type if needed
          if (existing.type !== 'binary') {
            existing.type = 'binary'
          }
        } else if (content instanceof Uint8Array) {
          if (existing.type !== 'binary') {
            existing.type = 'binary'
          }
        }
        return
      }
    }

    // Create new file
    const parentDir = result?.parentDir ?? (() => {
      const root = makeBaseNode(description.get(ROOT_ID)!) as DirectoryNode
      return root
    })()
    const name = relPath.split('/').filter(Boolean).pop()!
    const id = _generateId()
    const t = now()

    const strContent = content instanceof Uint8Array ? base64Encode(content) : content
    const isBin = content instanceof Uint8Array || isProbablyBinary(strContent)

    const node = new Y.Map<any>()
    node.set('type', isBin ? 'binary' : 'text')
    node.set('parent', '')
    node.set('ctime', t)
    node.set('mtime', t)
    const ytext = new Y.Text(strContent)
    node.set('content', ytext)
    description.set(id, node)
    parentDir.children.set(name, id)
  }

  function deleteFile(relPath: string) {
    const result = traverse(description, relPath)
    if (!result || !result.leafId) return
    const node = makeBaseNode(description.get(result.leafId)!)
    node.type = 'deleted'
    result.parentDir.children.delete(result.name)
  }

  function renameFile(oldRelPath: string, newRelPath: string) {
    const oldResult = traverse(description, oldRelPath)
    if (!oldResult || !oldResult.leafId) return
    const oldNode = makeBaseNode(description.get(oldResult.leafId)!)
    if (oldNode.type === 'deleted') return
    oldResult.parentDir.children.delete(oldResult.name)

    const newResult = traverse(description, newRelPath)
    const parentDir = newResult?.parentDir ?? (() => {
      const root = makeBaseNode(description.get(ROOT_ID)!) as DirectoryNode
      return root
    })()
    const name = newRelPath.split('/').filter(Boolean).pop()!
    parentDir.children.set(name, oldResult.leafId)
  }

  function isEmpty(): boolean {
    const root = makeBaseNode(description.get(ROOT_ID)!) as DirectoryNode
    if (!root || !root.children) return true
    for (const [, childId] of root.children) {
      const child = description.get(childId)
      if (!child) continue
      const node = makeBaseNode(child)
      if (node.type !== 'deleted') return false
    }
    return true
  }

  return {
    description,
    version,
    init,
    listFiles,
    getFile,
    setFile,
    deleteFile,
    renameFile,
    readFileAsString,
    readFileAsBytes,
    isBinary,
    isEmpty,
  }
}

export type CompatibleVFS = ReturnType<typeof useCompatibleVFS>
