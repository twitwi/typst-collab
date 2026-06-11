import { ref } from 'vue'

export interface VFSAdapter {
  listFiles(): string[]
  readFileAsString(path: string): string | null
  readFileAsBytes(path: string): Uint8Array | null
  isBinary(path: string): boolean
}

let typstInitialized = false

export function useTypst() {
  const compiling = ref(false)
  const svgContent = ref<string>('')
  const error = ref<string | null>(null)

  async function init() {
    if (typstInitialized) return
    try {
      const { $typst } = await import('@myriaddreamin/typst.ts')

      $typst.setCompilerInitOptions({
        getModule: () =>
          'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm',
      })
      $typst.setRendererInitOptions({
        getModule: () =>
          'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer@0.7.0/pkg/typst_ts_renderer_bg.wasm',
      })

      typstInitialized = true
    } catch (e) {
      error.value = `Failed to init Typst compiler: ${e}`
    }
  }

  async function setupVfs(vfs: VFSAdapter) {
    const { $typst } = await import('@myriaddreamin/typst.ts')
    $typst.resetShadow()
    for (const filePath of vfs.listFiles()) {
      if (vfs.isBinary(filePath)) {
        const bytes = vfs.readFileAsBytes(filePath)
        if (bytes) $typst.mapShadow('/' + filePath, bytes)
      } else {
        const content = vfs.readFileAsString(filePath)
        if (content !== null) $typst.addSource('/' + filePath, content)
      }
    }
    return $typst
  }

  async function compileFromVFS(vfs: VFSAdapter, entryFile = 'main.typ') {
    compiling.value = true
    error.value = null
    try {
      const $typst = await setupVfs(vfs)
      const svg = await $typst.svg({ mainFilePath: '/' + entryFile })
      svgContent.value = svg
    } catch (e: any) {
      error.value = e.message || String(e)
      svgContent.value = ''
    } finally {
      compiling.value = false
    }
  }

  async function downloadPdf(vfs: VFSAdapter, entryFile = 'main.typ') {
    try {
      const $typst = await setupVfs(vfs)
      const pdfBytes = await $typst.pdf({ mainFilePath: '/' + entryFile })
      if (!pdfBytes) return
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = entryFile.replace(/\.typ$/, '') + '.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      error.value = e.message || String(e)
    }
  }

  return { init, compileFromVFS, downloadPdf, compiling, svgContent, error }
}
