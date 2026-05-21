import * as Y from 'yjs'

export const ROOT_ID = 'root:'

export function _generateId(): string {
  return 'id:' + Math.random().toString(36).slice(2, 10)
}

export type NodeType = 'directory' | 'text' | 'binary' | 'deleted'

export interface BaseNode {
  type: NodeType
  parent: string | ''
  ctime: number
  mtime: number
  y: Y.Map<any>
  yAsBaseNode: BaseNode
}
export interface DirectoryNode extends BaseNode {
  type: 'directory'
  children: Y.Map<string>
}
export interface TextNode extends BaseNode {
  type: 'text'
  content: Y.Text
}
export interface BinaryNode extends BaseNode {
  type: 'binary'
  content: Y.Text
}

export function makeBaseNode(ymap: Y.Map<any>): BaseNode {
  return new Proxy(ymap, {
    get(target, prop, receiver) {
      if (prop === 'y' || prop === 'yAsBaseNode') return target
      return target.get(prop as string)
    },
    set(target, prop, value, receiver) {
      target.set(prop as string, value)
      return true
    },
  }) as unknown as BaseNode
}

export function now(): number {
  return Date.now()
}

export function initializeInYMap(description: Y.Map<any>) {
  if (!description.has(ROOT_ID)) {
    const t = now()
    const root = makeBaseNode(new Y.Map()) as DirectoryNode
    root.parent = ''
    root.ctime = t
    root.mtime = t
    root.type = 'directory'
    root.children = new Y.Map()
    description.set(ROOT_ID, root.yAsBaseNode)
  }
}
