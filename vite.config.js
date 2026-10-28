import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL, pathToFileURL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Local only (npm run dev): serves api/*.js like Vercel does, so the PMS link works without deploying.
// Server values come from .env.local; the service key can be a file outside the repo (TMS_SERVICE_ACCOUNT_FILE).
function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const k of ['ALLOWED_ORIGINS', 'PMS_PROJECT_ID', 'TMS_SERVICE_ACCOUNT']) if (env[k] && !process.env[k]) process.env[k] = env[k]
      const keyFile = resolve(env.TMS_SERVICE_ACCOUNT_FILE || '../TMS_service_account.json')
      if (!process.env.TMS_SERVICE_ACCOUNT && existsSync(keyFile)) process.env.TMS_SERVICE_ACCOUNT = readFileSync(keyFile, 'utf8')
      if (!process.env.TMS_SERVICE_ACCOUNT) server.config.logger.warn('[local-api] no TMS service key: set TMS_SERVICE_ACCOUNT_FILE in .env.local')

      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/(pms-login|pms-task)(\?|$)/.exec(req.url || '')
        if (!m) return next()
        let raw = ''
        for await (const chunk of req) raw += chunk
        try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = raw }
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
        const { default: handler } = await import(pathToFileURL(resolve(`api/${m[1]}.js`)).href)
        await handler(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), localApi()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // 5174, so it can run next to the PMS on 5173
  server: { port: 5174 },
  // Firebase comes from the CDN (src/firebase/sdk.js), so keep those URLs out of the bundle
  build: { rollupOptions: { external: [/^https:\/\/www\.gstatic\.com\/firebasejs\//] } },
})