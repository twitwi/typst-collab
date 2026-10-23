// Bundles stress/headless.ts (+ core + boxtools) into stress/dist/headless.mjs.
// Uses the repo's own esbuild: no new dependencies.
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { buildSync } = require('esbuild')
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: { '@': resolve(root, 'src') },
  // Bundle only our own TS (headless/core/boxtools); node_modules (yjs,
  // y-websocket, ws, lib0) stay external so there is exactly one copy of
  // each at runtime and CJS shims like `ws` keep working.
  external: ['yjs', 'y-websocket', 'y-websocket/*', 'ws', 'lib0', 'lib0/*'],
  logLevel: 'info',
}
buildSync({
  ...common,
  entryPoints: [resolve(root, 'stress/headless.ts')],
  outfile: resolve(root, 'stress/dist/headless.mjs'),
})
buildSync({
  ...common,
  entryPoints: [resolve(root, 'stress/probe.ts')],
  outfile: resolve(root, 'stress/dist/probe.mjs'),
})
console.log('stress bundle ready: stress/dist/headless.mjs')
