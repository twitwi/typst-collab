import { ref, shallowRef } from 'vue'

let typstInitialized = false

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

  async function compile(source: string) {
    compiling.value = true
    error.value = null
    try {
      const { $typst } = await import('@myriaddreamin/typst.ts')
      const svg = await $typst.svg({ mainContent: source })
      svgContent.value = svg
    } catch (e: any) {
      error.value = e.message || String(e)
      svgContent.value = ''
    } finally {
      compiling.value = false
    }
  }

  return { init, compile, compiling, svgContent, error }
}
