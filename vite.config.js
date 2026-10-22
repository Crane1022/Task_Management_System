import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Firebase comes from the CDN (src/firebase/sdk.js), so keep those URLs out of the bundle
  build: { rollupOptions: { external: [/^https:\/\/www\.gstatic\.com\/firebasejs\//] } },
})
