import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@myriaddreamin') || id.includes('@vedivad')) {
            return 'typst-vendor'
          }
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@myriaddreamin/typst.ts', '@vedivad/typst-web-service'],
  },
})
