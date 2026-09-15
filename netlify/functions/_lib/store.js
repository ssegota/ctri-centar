/**
 * Persistence layer.
 *
 * Primary backend is Netlify Blobs, which needs no provisioning — it is part of
 * the Netlify deploy. When the Blobs context is unavailable (plain `vite dev`,
 * or a unit test run outside the Netlify CLI) we fall back to JSON files under
 * .netlify/blobs-local/ so the whole API still works locally.
 */
import { getStore } from '@netlify/blobs'

const STORE_NAME = 'ctri'
const LOCAL_DIR = '.netlify/blobs-local'

let backend = null

async function localBackend() {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const dir = path.resolve(process.cwd(), LOCAL_DIR)
  await fs.mkdir(dir, { recursive: true })
  const file = (key) => path.join(dir, `${key}.json`)
  return {
    kind: 'local',
    async get(key) {
      try {
        return JSON.parse(await fs.readFile(file(key), 'utf8'))
      } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
      }
    },
    async set(key, value) {
      // Re-create the directory each time: it is easy to wipe .netlify during
      // local development, and a cached backend should survive that.
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(file(key), JSON.stringify(value, null, 2))
    },
  }
}

async function resolveBackend() {
  if (backend) return backend
  try {
    const store = getStore({ name: STORE_NAME, consistency: 'strong' })
    // Touch the store once so a missing Blobs context fails here, not mid-request.
    await store.get('__probe')
    backend = {
      kind: 'blobs',
      get: (key) => store.get(key, { type: 'json' }),
      set: (key, value) => store.setJSON(key, value),
    }
  } catch {
    backend = await localBackend()
  }
  return backend
}

export async function readDoc(key, fallback = {}) {
  const b = await resolveBackend()
  const value = await b.get(key)
  return value == null ? structuredClone(fallback) : value
}

export async function writeDoc(key, value) {
  const b = await resolveBackend()
  await b.set(key, value)
  return value
}

/** Read → mutate → write. Fine at this scale; see README for the concurrency note. */
export async function updateDoc(key, mutate, fallback = {}) {
  const current = await readDoc(key, fallback)
  const next = (await mutate(current)) ?? current
  await writeDoc(key, next)
  return next
}

export const KEYS = {
  users: 'users',
  applications: 'applications',
  reservations: 'reservations',
  meta: 'meta',
}

/** Session secret: env var wins; otherwise one is generated and persisted once. */
export async function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  const meta = await readDoc(KEYS.meta, {})
  if (meta.secret) return meta.secret
  const { randomId } = await import('./crypto.js')
  const secret = randomId(32)
  await writeDoc(KEYS.meta, { ...meta, secret })
  return secret
}

/** Reset helper used by the test harness. */
export function __resetBackend() {
  backend = null
}
