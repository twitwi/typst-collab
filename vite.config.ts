import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), wasm()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@myriaddreamin/typst.ts'],
  },
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
})
