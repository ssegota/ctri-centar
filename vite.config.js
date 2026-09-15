import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Mounts the Netlify function as dev middleware so `npm run dev` gives you the
 * full app — API included — without the Netlify CLI. In production Netlify
 * serves the same handler; this plugin is dev-only.
 */
function apiMiddleware() {
  return {
    name: 'ctri-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/netlify/functions/api.js')

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = chunks.length ? Buffer.concat(chunks) : undefined

          const host = req.headers.host || 'localhost:5173'
          // Vite strips the mount prefix from req.url — put it back.
          const url = `http://${host}/api${req.url === '/' ? '' : req.url}`

          const request = new Request(url, {
            method: req.method,
            headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
          })

          const response = await handler(request, {})
          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            if (key === 'set-cookie') res.setHeader('Set-Cookie', value)
            else res.setHeader(key, value)
          })
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(`[api] ${err.stack || err}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'dev api error', code: 'internal' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiMiddleware()],
  build: { outDir: 'dist', sourcemap: false },
})
