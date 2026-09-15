/**
 * Password hashing and session tokens built on Web Crypto only — no native
 * dependencies, so the function bundles and cold-starts cleanly on Netlify.
 */

const enc = new TextEncoder()
const PBKDF2_ITERATIONS = 210_000

/* ---------- base64url ---------- */
export function b64url(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/* ---------- random ---------- */
export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function randomId(bytes = 12) {
  return b64url(randomBytes(bytes))
}

/** Human-typable temporary password — no 0/O/1/l/I to avoid transcription errors. */
export function tempPassword(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/* ---------- password hashing ---------- */
export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, iterations)
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(key)}`
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const iterations = Number(iterStr)
  if (!Number.isInteger(iterations) || iterations < 1000) return false
  const key = await derive(password, fromB64url(saltB64), iterations)
  return timingSafeEqual(new Uint8Array(key), fromB64url(hashB64))
}

async function derive(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, 256)
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/* ---------- signed tokens (sessions, invites) ---------- */
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

export async function signToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))
  return `${body}.${b64url(sig)}`
}

/** Returns the payload, or null when the signature is bad or the token has expired. */
export async function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  let expected
  try {
    expected = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))
  } catch {
    return null
  }
  if (!timingSafeEqual(new Uint8Array(expected), fromB64url(sig))) return null
  let payload
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(body)))
  } catch {
    return null
  }
  if (payload.exp && Date.now() > payload.exp) return null
  return payload
}
