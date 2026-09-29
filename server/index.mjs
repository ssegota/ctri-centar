/**
 * Self-hosted runtime for the API.
 *
 * On Netlify, netlify/functions/api.js is invoked by the platform. On a plain
 * VPS this small HTTP server does the same job: it turns each Node request into
 * a Web `Request`, calls the same handler, and writes the `Response` back.
 * nginx serves dist/ and proxies /api/* here — see deploy/nginx.conf.
 *
 * Outside Netlify the Blobs context is missing, so store.js falls back to JSON
 * files. Point CTRL_LOCAL_STORE_DIR at a persistent directory outside the
 * deployed code, or every deploy would wipe the data.
 */
import http from 'node:http'
import handler from '../netlify/functions/api.js'

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '127.0.0.1'

const server = http.createServer(async (req, res) => {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)

    // The handler builds invite links from url.origin and sets the cookie's
    // Secure flag from url.protocol, so the URL must be the public one. nginx
    // passes both; the server only listens on loopback, so they are trusted.
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
    const host = req.headers.host || `localhost:${PORT}`

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
      else if (value != null) headers.set(key, value)
    }

    const request = new Request(`${proto}://${host}${req.url}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) || !chunks.length ? undefined : Buffer.concat(chunks),
    })

    const response = await handler(request, {})

    const out = {}
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') out[key] = value
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) out['set-cookie'] = cookies

    res.writeHead(response.status, out)
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (err) {
    console.error('[server]', err)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'internal error', code: 'internal' }))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`CTRL API listening on http://${HOST}:${PORT}`)
})
