import { KEYS, readDoc, updateDoc, writeDoc } from './store.js'
import { hashPassword, randomId, tempPassword } from './crypto.js'
import { clean, conflict } from './http.js'
import catalogue from '../../../src/data/tools.json' with { type: 'json' }
import { CLOSE_HOUR, OPEN_HOUR, isOpenAt, fitsInDay, overlaps } from '../../../src/lib/schedule.js'

export const TOOL_BY_ID = Object.fromEntries(catalogue.map((t) => [t.id, t]))
export const ACTIVE_STATUSES = ['pending', 'confirmed']

/* ---------- shaping ----------------------------------------------------- */

/** Everything the browser is allowed to see about a user. */
export function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    memberType: u.memberType,
    org: u.org || '',
    active: u.active !== false,
    trained: u.trained || [],
    mustChangePassword: !!u.mustChangePassword,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
  }
}

/* ---------- usernames --------------------------------------------------- */

const DIACRITICS = { č: 'c', ć: 'c', ž: 'z', š: 's', đ: 'd' }

export function slugName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[čćžšđ]/g, (c) => DIACRITICS[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** first.last, de-duplicated with a numeric suffix. */
export function makeUsername(firstName, lastName, users) {
  const first = slugName(firstName) || 'korisnik'
  const last = slugName(lastName)
  const base = (last ? `${first}.${last}` : first).slice(0, 28)
  const taken = new Set(Object.values(users).map((u) => u.username))
  if (!taken.has(base)) return base
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}${i}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}.${randomId(3).toLowerCase()}`
}

/* ---------- application reference codes --------------------------------- */

export function makeRef(applications) {
  const year = new Date().getFullYear()
  const prefix = `CTRI-${year}-`
  const used = Object.values(applications)
    .map((a) => a.ref)
    .filter((r) => typeof r === 'string' && r.startsWith(prefix))
    .map((r) => Number(r.slice(prefix.length)))
    .filter((n) => Number.isInteger(n))
  const next = (used.length ? Math.max(...used) : 0) + 1
  return prefix + String(next).padStart(4, '0')
}

/* ---------- user creation ---------------------------------------------- */

export const INVITE_DAYS = 14

/**
 * Creates an account with a temporary password. Returns the credentials once,
 * in the clear, so the admin can pass them to the new member; only the hash is
 * stored.
 */
export async function createMemberAccount({ firstName, lastName, email, memberType, org, role = 'member', applicationId = null }) {
  const users = await readDoc(KEYS.users, {})
  const password = tempPassword()
  const id = randomId(9)
  const user = {
    id,
    username: makeUsername(firstName, lastName, users),
    name: clean(`${firstName || ''} ${lastName || ''}`.trim()) || clean(email),
    email: clean(email, 160).toLowerCase(),
    role,
    memberType: memberType || 'individual',
    org: clean(org, 160),
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    active: true,
    trained: [],
    inviteSerial: 1,
    inviteExpires: Date.now() + INVITE_DAYS * 86_400_000,
    applicationId,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: 0,
  }
  users[id] = user
  await writeDoc(KEYS.users, users)
  return { user, password }
}

/** Issues a fresh temporary password and invalidates any outstanding invite link. */
export async function resetMemberPassword(userId) {
  const password = tempPassword()
  const passwordHash = await hashPassword(password)
  let updated = null
  await updateDoc(KEYS.users, (users) => {
    const u = users[userId]
    if (!u) return users
    u.passwordHash = passwordHash
    u.mustChangePassword = true
    u.usingDefaultPassword = false
    u.inviteSerial = (u.inviteSerial || 0) + 1
    u.inviteExpires = Date.now() + INVITE_DAYS * 86_400_000
    u.failedAttempts = 0
    u.lockedUntil = 0
    updated = u
    return users
  })
  return updated ? { user: updated, password } : null
}

/* ---------- reservations ------------------------------------------------ */

/**
 * Validates a booking request against opening hours, the tool's session cap and
 * remaining capacity. Throws HttpError; returns the resolved tool on success.
 */
export function assertBookable(tool, date, hour, hours, existing, now = Date.now()) {
  if (!tool || !tool.bookable) throw conflict('tool not bookable', 'not_bookable')
  if (!Number.isInteger(hours) || hours < 1) throw conflict('invalid duration', 'bad_duration')
  if (!isOpenAt(date, hour)) throw conflict('closed', 'closed')
  if (!fitsInDay(hour, hours)) throw conflict('closed', 'closed')
  const max = tool.maxHours || 4
  if (hours > max) throw conflict('too long', 'too_long')

  const start = new Date(`${date}T00:00:00`)
  start.setHours(hour, 0, 0, 0)
  if (start.getTime() < now) throw conflict('past', 'past')

  const used = existing.filter(
    (r) =>
      r.toolId === tool.id &&
      r.date === date &&
      ACTIVE_STATUSES.includes(r.status) &&
      overlaps(hour, hours, r.hour, r.hours),
  ).length
  if (used >= tool.qty) throw conflict('full', 'full')
  return tool
}

/** Per-hour remaining capacity for one tool across a set of dates. */
export function availabilityMap(tool, dates, reservations) {
  const map = {}
  for (const date of dates) {
    map[date] = {}
    for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
      const taken = reservations.filter(
        (r) =>
          r.toolId === tool.id &&
          r.date === date &&
          ACTIVE_STATUSES.includes(r.status) &&
          overlaps(h, 1, r.hour, r.hours),
      )
      map[date][h] = { free: Math.max(0, tool.qty - taken.length), total: tool.qty }
    }
  }
  return map
}
