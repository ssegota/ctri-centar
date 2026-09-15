export const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  })
}

export function fail(status, message, code) {
  return json({ message, code: code || null }, { status })
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const bad = (message, code) => new HttpError(400, message, code)
export const unauthorized = (message = 'unauthorized') => new HttpError(401, message, 'unauthorized')
export const forbidden = (message = 'forbidden') => new HttpError(403, message, 'forbidden')
export const notFound = (message = 'not found') => new HttpError(404, message, 'not_found')
export const conflict = (message, code) => new HttpError(409, message, code || 'conflict')

export function parseCookies(req) {
  const header = req.headers.get('cookie') || ''
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

export const SESSION_COOKIE = 'ctri_session'
const SESSION_DAYS = 14

export function sessionCookie(token, url) {
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  const maxAge = SESSION_DAYS * 24 * 60 * 60
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function clearCookie(url) {
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export const SESSION_TTL_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

/** Trim, collapse whitespace and cap length — applied to every user-supplied string. */
export function clean(value, max = 500) {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Same, but keeps line breaks (free-text answers). */
export function cleanMultiline(value, max = 4000) {
  if (value == null) return ''
  return String(value).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, max)
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value || '').trim())
}
