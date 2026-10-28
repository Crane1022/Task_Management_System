// Optional component tests that run in a simulated browser (jsdom). They are NOT part of `npm test`.
//   npm i -D vitest@2 jsdom @vue/test-utils
//   npx vitest run --config test/dom/vitest.config.js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  root,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['test/dom/**/*.dom.test.js'] },
})
