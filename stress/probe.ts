// Pure-local isolation probe: two Y.Docs, no providers, no network.
// Answers: does a rename on A's VFS leak into B's VFS synchronously?
import * as Y from 'yjs'
import { openVfs } from 'yjs-boxtools'

const docA = new Y.Doc()
const docB = new Y.Doc()
console.log('docs identical object:', (docA as unknown) === (docB as unknown))
const vfsA = openVfs(docA, 'box', true)!
const vfsB = openVfs(docB, 'box', true)!
console.log('descriptions identical object:', (vfsA.description as unknown) === (vfsB.description as unknown))
vfsA.setFile('race.typ', 'base\n')
console.log('B sees race.typ before rename:', vfsB.getFile('race.typ') !== undefined)
vfsA.renameNode('race.typ', 'renamed.typ')
console.log('A files:', JSON.stringify(vfsA.listFiles()))
console.log('B files:', JSON.stringify(vfsB.listFiles()))
