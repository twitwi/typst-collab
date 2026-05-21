import { ref, shallowRef } from 'vue'
import * as Y from 'yjs'
import { isProbablyBinary } from './useVirtualFS'

let typstInitialized = false

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function useTypst() {
  const compiling = ref(false)
  const svgContent = shallowRef<string>('')
  const error = ref<string | null>(null)

  async function init() {
    if (typstInitialized) return
    try {
      const { $typst } = await import('@myriaddreamin/typst.ts')

      $typst.setCompilerInitOptions({
        getModule: () =>
          'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0-rc2/pkg/typst_ts_web_compiler_bg.wasm',
      })
      $typst.setRendererInitOptions({
        getModule: () =>
          'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@0.7.0-rc2/pkg/typst_ts_renderer_bg.wasm',
      })

      typstInitialized = true
    } catch (e) {
      error.value = `Failed to init Typst compiler: ${e}`
    }
  }

  async function compileFromFS(files: Y.Map<Y.Text>) {
    compiling.value = true
    error.value = null
    try {
      const { $typst } = await import('@myriaddreamin/typst.ts')

      $typst.resetShadow()

      for (const [path, ytext] of files) {
        const content = ytext.toString()
        if (!content) continue
        if (isProbablyBinary(content)) {
          const bytes = base64Decode(content)
          $typst.mapShadow('/' + path, bytes)
        } else {
          $typst.addSource('/' + path, content)
        }
      }

      const svg = await $typst.svg({
        mainFilePath: '/main.typ',
      })
      svgContent.value = svg
    } catch (e: any) {
      error.value = e.message || String(e)
      svgContent.value = ''
    } finally {
      compiling.value = false
    }
  }

  return { init, compileFromFS, compiling, svgContent, error }
}
