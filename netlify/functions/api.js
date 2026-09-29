/**
 * CTRL API — a single Netlify function that serves every /api/* route.
 *
 * Auth: signed session token in an httpOnly cookie.
 * Storage: Netlify Blobs (see _lib/store.js).
 */
import { KEYS, readDoc, sessionSecret, updateDoc, writeDoc } from './_lib/store.js'
import { hashPassword, randomId, signToken, verifyPassword, verifyToken } from './_lib/crypto.js'
import {
  HttpError, SESSION_COOKIE, SESSION_TTL_MS, bad, clean, cleanMultiline, clearCookie,
  fail, forbidden, isEmail, json, notFound, parseCookies, sessionCookie, unauthorized,
} from './_lib/http.js'
import {
  ACTIVE_STATUSES, INVITE_DAYS, TOOL_BY_ID, assertBookable, availabilityMap,
  createMemberAccount, makeRef, publicUser, resetMemberPassword,
} from './_lib/domain.js'
import { isValidDate } from '../../src/lib/schedule.js'

const MIN_PASSWORD = 10
const MAX_TOOLS_PER_BOOKING = 12
const MAX_FAILED = 8
const LOCK_MS = 15 * 60 * 1000

/* ========================================================================== */
/* Bootstrap                                                                  */
/* ========================================================================== */

/** Seeds the initial admin/admin account the first time the API is touched. */
async function ensureSeeded() {
  const users = await readDoc(KEYS.users, {})
  if (Object.keys(users).length > 0) return
  const id = randomId(9)
  users[id] = {
    id,
    username: 'admin',
    name: 'Administrator',
    email: '',
    role: 'admin',
    memberType: 'staff',
    org: '',
    passwordHash: await hashPassword('admin'),
    mustChangePassword: false,
    usingDefaultPassword: true,
    active: true,
    trained: [],
    inviteSerial: 0,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    failedAttempts: 0,
    lockedUntil: 0,
  }
  await writeDoc(KEYS.users, users)
}

/* ========================================================================== */
/* Session                                                                    */
/* ========================================================================== */

async function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return null
  const payload = await verifyToken(token, await sessionSecret())
  if (!payload?.uid) return null
  const users = await readDoc(KEYS.users, {})
  const user = users[payload.uid]
  if (!user || user.active === false) return null
  // A password change invalidates every session issued before it.
  if ((payload.ser || 0) !== (user.sessionSerial || 0)) return null
  return user
}

async function requireUser(req) {
  const user = await currentUser(req)
  if (!user) throw unauthorized()
  return user
}

async function requireAdmin(req) {
  const user = await requireUser(req)
  if (user.role !== 'admin') throw forbidden()
  return user
}

async function issueSession(user, url) {
  const token = await signToken(
    { uid: user.id, ser: user.sessionSerial || 0, exp: Date.now() + SESSION_TTL_MS },
    await sessionSecret(),
  )
  return sessionCookie(token, url)
}

/* ========================================================================== */
/* Handlers — auth                                                            */
/* ========================================================================== */

async function handleLogin(req, url) {
  const body = await readJson(req)
  const username = clean(body.username, 60).toLowerCase()
  const password = String(body.password || '')
  if (!username || !password) throw bad('missing credentials', 'bad_credentials')

  const users = await readDoc(KEYS.users, {})
  const user = Object.values(users).find((u) => u.username.toLowerCase() === username)

  if (!user) {
    // Spend comparable time on unknown users so the response does not leak existence.
    await verifyPassword(password, 'pbkdf2$210000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    throw new HttpError(401, 'bad credentials', 'bad_credentials')
  }
  if (user.lockedUntil && Date.now() < user.lockedUntil) {
    throw new HttpError(429, 'locked', 'locked')
  }
  if (user.active === false) throw new HttpError(403, 'inactive', 'inactive')

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    await updateDoc(KEYS.users, (all) => {
      const u = all[user.id]
      if (!u) return all
      u.failedAttempts = (u.failedAttempts || 0) + 1
      if (u.failedAttempts >= MAX_FAILED) {
        u.lockedUntil = Date.now() + LOCK_MS
        u.failedAttempts = 0
      }
      return all
    })
    throw new HttpError(401, 'bad credentials', 'bad_credentials')
  }

  let fresh = user
  await updateDoc(KEYS.users, (all) => {
    const u = all[user.id]
    if (!u) return all
    u.failedAttempts = 0
    u.lockedUntil = 0
    u.lastLoginAt = new Date().toISOString()
    fresh = u
    return all
  })

  return json({ user: publicUser(fresh) }, { headers: { 'Set-Cookie': await issueSession(fresh, url) } })
}

async function handleSetPassword(req, url) {
  const body = await readJson(req)
  const newPassword = String(body.newPassword || '')
  if (newPassword.length < MIN_PASSWORD) throw bad('password too short', 'pw_short')

  let target = null

  if (body.token) {
    const payload = await verifyToken(String(body.token), await sessionSecret())
    if (!payload || payload.purpose !== 'invite') throw bad('invalid invite', 'bad_invite')
    const users = await readDoc(KEYS.users, {})
    const user = users[payload.uid]
    if (!user || user.active === false) throw bad('invalid invite', 'bad_invite')
    if ((payload.ser || 0) !== (user.inviteSerial || 0)) throw bad('invalid invite', 'bad_invite')
    if (!user.mustChangePassword) throw bad('invalid invite', 'bad_invite')
    target = user
  } else {
    target = await requireUser(req)
    if (!target.mustChangePassword) {
      const current = String(body.currentPassword || '')
      if (!current || !(await verifyPassword(current, target.passwordHash))) {
        throw bad('bad credentials', 'bad_credentials')
      }
    }
  }

  if (await verifyPassword(newPassword, target.passwordHash)) throw bad('same password', 'pw_same')

  const passwordHash = await hashPassword(newPassword)
  let fresh = null
  await updateDoc(KEYS.users, (all) => {
    const u = all[target.id]
    if (!u) return all
    u.passwordHash = passwordHash
    u.mustChangePassword = false
    u.usingDefaultPassword = false
    u.inviteSerial = (u.inviteSerial || 0) + 1 // burns any outstanding invite link
    u.inviteExpires = null
    u.sessionSerial = (u.sessionSerial || 0) + 1 // logs out other sessions
    fresh = u
    return all
  })
  if (!fresh) throw notFound()

  return json({ user: publicUser(fresh) }, { headers: { 'Set-Cookie': await issueSession(fresh, url) } })
}

/* ========================================================================== */
/* Handlers — applications                                                    */
/* ========================================================================== */

const APP_TYPES = ['student', 'individual', 'company']

async function handleCreateApplication(req) {
  const body = await readJson(req)
  const type = APP_TYPES.includes(body.type) ? body.type : null
  if (!type) throw bad('invalid type', 'bad_type')

  const d = body.data || {}
  const firstName = clean(d.firstName, 80)
  const lastName = clean(d.lastName, 80)
  const email = clean(d.email, 160).toLowerCase()
  const motivation = cleanMultiline(d.motivation, 4000)

  if (!firstName || !lastName) throw bad('name required', 'required')
  if (!isEmail(email)) throw bad('invalid email', 'bad_email')
  if (motivation.length < 10) throw bad('motivation required', 'required')
  if (!d.gdpr || !d.safety) throw bad('consent required', 'consent')
  if (type === 'company' && !clean(d.companyName, 160)) throw bad('company required', 'required')
  if (type === 'student' && !clean(d.institution, 160)) throw bad('institution required', 'required')

  // Only keep the fields that belong to the chosen applicant type — the form
  // carries defaults for all three, and storing the irrelevant ones would show
  // a student "number of employees" in the admin panel.
  const byType = {
    student: {
      institution: clean(d.institution, 160),
      studyProgram: clean(d.studyProgram, 160),
      studyYear: clean(d.studyYear, 40),
      studentId: clean(d.studentId, 40),
    },
    individual: {
      occupation: clean(d.occupation, 120),
      experience: clean(d.experience, 40),
    },
    company: {
      companyName: clean(d.companyName, 160),
      oib: clean(d.oib, 20),
      companyRole: clean(d.companyRole, 120),
      companySize: clean(d.companySize, 40),
      website: clean(d.website, 200),
      teamSize: clean(d.teamSize, 40),
    },
  }

  const data = {
    firstName, lastName, email, motivation,
    phone: clean(d.phone, 40),
    city: clean(d.city, 80),
    birthYear: clean(d.birthYear, 8),
    equipment: cleanMultiline(d.equipment, 800),
    projectTitle: clean(d.projectTitle, 160),
    timeframe: clean(d.timeframe, 40),
    ...byType[type],
    gdpr: true,
    safety: true,
  }

  let ref = ''
  const id = randomId(9)
  await updateDoc(KEYS.applications, (apps) => {
    ref = makeRef(apps)
    apps[id] = { id, ref, type, status: 'pending', data, createdAt: new Date().toISOString(), decidedAt: null, decidedBy: null, note: '', userId: null }
    return apps
  })

  return json({ ok: true, ref }, { status: 201 })
}

async function handleApproveApplication(req, url, id) {
  const admin = await requireAdmin(req)
  const apps = await readDoc(KEYS.applications, {})
  const app = apps[id]
  if (!app) throw notFound()
  if (app.status !== 'pending') throw bad('already decided', 'decided')

  const d = app.data
  const org = app.type === 'company' ? d.companyName : app.type === 'student' ? d.institution : ''
  const { user, password } = await createMemberAccount({
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    memberType: app.type,
    org,
    applicationId: app.id,
  })

  await updateDoc(KEYS.applications, (all) => {
    const a = all[id]
    if (!a) return all
    a.status = 'approved'
    a.decidedAt = new Date().toISOString()
    a.decidedBy = admin.username
    a.userId = user.id
    return all
  })

  const inviteToken = await signToken(
    { uid: user.id, ser: user.inviteSerial, purpose: 'invite', exp: Date.now() + INVITE_DAYS * 86_400_000 },
    await sessionSecret(),
  )

  return json({
    user: publicUser(user),
    credentials: {
      username: user.username,
      password,
      inviteUrl: `${url.origin}/set-password?token=${encodeURIComponent(inviteToken)}`,
      expiresInDays: INVITE_DAYS,
    },
  })
}

async function handleRejectApplication(req, id) {
  const admin = await requireAdmin(req)
  const body = await readJson(req).catch(() => ({}))
  const note = cleanMultiline(body.note, 1000)
  let found = false
  await updateDoc(KEYS.applications, (all) => {
    const a = all[id]
    if (!a || a.status !== 'pending') return all
    a.status = 'rejected'
    a.decidedAt = new Date().toISOString()
    a.decidedBy = admin.username
    a.note = note
    found = true
    return all
  })
  if (!found) throw notFound()
  return json({ ok: true })
}

/* ========================================================================== */
/* Handlers — users                                                           */
/* ========================================================================== */

async function handleListUsers(req) {
  await requireAdmin(req)
  const users = await readDoc(KEYS.users, {})
  const list = Object.values(users)
    .map((u) => ({ ...publicUser(u), pendingPassword: !!u.mustChangePassword, usingDefaultPassword: !!u.usingDefaultPassword }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return json({ users: list })
}

async function handleCreateUser(req, url) {
  await requireAdmin(req)
  const body = await readJson(req)
  const firstName = clean(body.firstName, 80)
  const lastName = clean(body.lastName, 80)
  const email = clean(body.email, 160).toLowerCase()
  if (!firstName || !lastName) throw bad('name required', 'required')
  if (!isEmail(email)) throw bad('invalid email', 'bad_email')

  const { user, password } = await createMemberAccount({
    firstName, lastName, email,
    memberType: ['student', 'individual', 'company', 'staff'].includes(body.memberType) ? body.memberType : 'individual',
    org: clean(body.org, 160),
    role: body.role === 'admin' ? 'admin' : 'member',
  })

  const inviteToken = await signToken(
    { uid: user.id, ser: user.inviteSerial, purpose: 'invite', exp: Date.now() + INVITE_DAYS * 86_400_000 },
    await sessionSecret(),
  )

  return json({
    user: publicUser(user),
    credentials: {
      username: user.username,
      password,
      inviteUrl: `${url.origin}/set-password?token=${encodeURIComponent(inviteToken)}`,
      expiresInDays: INVITE_DAYS,
    },
  }, { status: 201 })
}

async function handlePatchUser(req, id) {
  const admin = await requireAdmin(req)
  const body = await readJson(req)
  let fresh = null

  await updateDoc(KEYS.users, (all) => {
    const u = all[id]
    if (!u) return all
    if (typeof body.active === 'boolean' && u.id !== admin.id) u.active = body.active
    if ((body.role === 'admin' || body.role === 'member') && u.id !== admin.id) u.role = body.role
    if (Array.isArray(body.trained)) {
      u.trained = body.trained.filter((t) => TOOL_BY_ID[t]?.restricted)
    }
    fresh = u
    return all
  })
  if (!fresh) throw notFound()
  return json({ user: publicUser(fresh) })
}

async function handleResetUserPassword(req, url, id) {
  await requireAdmin(req)
  const result = await resetMemberPassword(id)
  if (!result) throw notFound()
  const inviteToken = await signToken(
    { uid: result.user.id, ser: result.user.inviteSerial, purpose: 'invite', exp: Date.now() + INVITE_DAYS * 86_400_000 },
    await sessionSecret(),
  )
  return json({
    credentials: {
      username: result.user.username,
      password: result.password,
      inviteUrl: `${url.origin}/set-password?token=${encodeURIComponent(inviteToken)}`,
      expiresInDays: INVITE_DAYS,
    },
  })
}

/* ========================================================================== */
/* Handlers — reservations                                                    */
/* ========================================================================== */

function decorate(r, users) {
  const u = users[r.userId]
  return { ...r, userName: u?.name || '—', userUsername: u?.username || '—', userOrg: u?.org || '' }
}

/** Accepts ?toolIds=a,b,c (or a single ?toolId=) and answers for all of them. */
function requestedTools(url) {
  const raw = url.searchParams.get('toolIds') || url.searchParams.get('toolId') || ''
  const ids = [...new Set(raw.split(',').map((x) => clean(x, 60)).filter(Boolean))]
  if (ids.length === 0) throw bad('no tool', 'no_tool')
  if (ids.length > MAX_TOOLS_PER_BOOKING) throw bad('too many tools', 'too_many_tools')
  const tools = ids.map((id) => TOOL_BY_ID[id])
  if (tools.some((t) => !t)) throw notFound('unknown tool')
  return tools
}

async function handleAvailability(req, url) {
  await requireUser(req)
  const tools = requestedTools(url)
  const from = url.searchParams.get('from')
  const days = Math.min(31, Math.max(1, Number(url.searchParams.get('days')) || 7))
  if (!isValidDate(from)) throw bad('bad date', 'bad_date')

  const dates = []
  const cursor = new Date(`${from}T00:00:00`)
  for (let i = 0; i < days; i++) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  const reservations = await readDoc(KEYS.reservations, {})
  const ids = new Set(tools.map((t) => t.id))
  const list = Object.values(reservations).filter((r) => ids.has(r.toolId) && dates.includes(r.date))
  const me = await currentUser(req)

  return json({
    tools: Object.fromEntries(
      tools.map((t) => [t.id, { id: t.id, qty: t.qty, maxHours: t.maxHours || 4, restricted: !!t.restricted }]),
    ),
    availability: Object.fromEntries(
      tools.map((t) => [t.id, availabilityMap(t, dates, list.filter((r) => r.toolId === t.id))]),
    ),
    mine: list
      .filter((r) => r.userId === me.id && ACTIVE_STATUSES.includes(r.status))
      .map((r) => ({ id: r.id, toolId: r.toolId, date: r.date, hour: r.hour, hours: r.hours, status: r.status, groupId: r.groupId || null })),
  })
}

async function handleCreateReservation(req) {
  const user = await requireUser(req)
  if (user.mustChangePassword) throw forbidden('password change required')
  const body = await readJson(req)

  // One tool or many — `toolIds` is the multi-select form, `toolId` the single.
  const rawIds = Array.isArray(body.toolIds) && body.toolIds.length ? body.toolIds : [body.toolId]
  const ids = [...new Set(rawIds.map((x) => clean(x, 60)).filter(Boolean))]
  if (ids.length === 0) throw bad('no tool', 'no_tool')
  if (ids.length > MAX_TOOLS_PER_BOOKING) throw bad('too many tools', 'too_many_tools')
  const tools = ids.map((id) => TOOL_BY_ID[id])
  if (tools.some((t) => !t)) throw notFound('unknown tool')

  const date = clean(body.date, 12)
  const hour = Number(body.hour)
  const hours = Number(body.hours)
  const note = cleanMultiline(body.note, 600)

  const existing = Object.values(await readDoc(KEYS.reservations, {}))
  for (const tool of tools) assertBookable(tool, date, hour, hours, existing)

  const groupId = tools.length > 1 ? randomId(9) : null
  const now = new Date().toISOString()
  const build = (tool) => ({
    id: randomId(9),
    toolId: tool.id,
    userId: user.id,
    date,
    hour,
    hours,
    note,
    groupId,
    // Higher-risk machines need a recorded induction; without one the booking
    // is held for the manager to approve. Judged per tool, not per group.
    status: tool.restricted && !(user.trained || []).includes(tool.id) ? 'pending' : 'confirmed',
    createdAt: now,
    decidedAt: null,
    decidedBy: null,
  })

  let failure = null
  let created = []
  await updateDoc(KEYS.reservations, (all) => {
    // Re-check every tool against the freshest copy, then commit all of them
    // or none — a half-booked group is worse than a clean rejection.
    const running = Object.values(all)
    const batch = []
    for (const tool of tools) {
      try {
        assertBookable(tool, date, hour, hours, [...running, ...batch])
      } catch (err) {
        failure = { code: err.code || 'full', toolId: tool.id }
        return all
      }
      batch.push(build(tool))
    }
    for (const r of batch) all[r.id] = r
    created = batch
    return all
  })
  if (failure) throw new HttpError(409, failure.code, failure.code)

  // `reservation` is kept for callers that booked a single tool.
  return json({ reservations: created, reservation: created[0], groupId }, { status: 201 })
}

async function handleListReservations(req, url) {
  const user = await requireUser(req)
  const scope = url.searchParams.get('scope') === 'all' && user.role === 'admin' ? 'all' : 'mine'
  const [reservations, users] = await Promise.all([readDoc(KEYS.reservations, {}), readDoc(KEYS.users, {})])
  const list = Object.values(reservations)
    .filter((r) => (scope === 'all' ? true : r.userId === user.id))
    .map((r) => decorate(r, users))
    .sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date < b.date ? 1 : -1))
  return json({ reservations: list })
}

/** Cancels every still-active booking in a group the caller owns. */
async function handleCancelGroup(req, groupId) {
  const user = await requireUser(req)
  let count = 0
  await updateDoc(KEYS.reservations, (all) => {
    for (const r of Object.values(all)) {
      if (r.groupId !== groupId) continue
      if (r.userId !== user.id && user.role !== 'admin') continue
      if (!ACTIVE_STATUSES.includes(r.status)) continue
      r.status = 'cancelled'
      r.decidedAt = new Date().toISOString()
      r.decidedBy = user.username
      count++
    }
    return all
  })
  if (count === 0) throw notFound()
  return json({ ok: true, cancelled: count })
}

async function handleCancelReservation(req, id) {
  const user = await requireUser(req)
  let ok = false
  await updateDoc(KEYS.reservations, (all) => {
    const r = all[id]
    if (!r) return all
    if (r.userId !== user.id && user.role !== 'admin') return all
    if (!ACTIVE_STATUSES.includes(r.status)) return all
    r.status = 'cancelled'
    r.decidedAt = new Date().toISOString()
    r.decidedBy = user.username
    ok = true
    return all
  })
  if (!ok) throw notFound()
  return json({ ok: true })
}

async function handleDecideReservation(req, id, decision) {
  const admin = await requireAdmin(req)
  let ok = false
  await updateDoc(KEYS.reservations, (all) => {
    const r = all[id]
    if (!r || r.status !== 'pending') return all
    r.status = decision
    r.decidedAt = new Date().toISOString()
    r.decidedBy = admin.username
    ok = true
    return all
  })
  if (!ok) throw notFound()
  return json({ ok: true })
}

/* ========================================================================== */
/* Router                                                                     */
/* ========================================================================== */

async function readJson(req) {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    throw bad('invalid body', 'bad_body')
  }
}

/** Accepts both /api/* (config path) and the raw /.netlify/functions/api/* form. */
function routePath(url) {
  let p = url.pathname
  p = p.replace(/^\/\.netlify\/functions\/api/, '')
  p = p.replace(/^\/api/, '')
  return p.replace(/\/+$/, '') || '/'
}

export default async function handler(req, context) {
  const url = new URL(req.url)
  const path = routePath(url)
  const method = req.method.toUpperCase()

  try {
    await ensureSeeded()

    /* --- auth --- */
    if (path === '/auth/login' && method === 'POST') return await handleLogin(req, url)
    if (path === '/auth/logout' && method === 'POST') {
      return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie(url) } })
    }
    if (path === '/auth/me' && method === 'GET') {
      const user = await currentUser(req)
      if (!user) throw unauthorized()
      return json({ user: publicUser(user), usingDefaultPassword: !!user.usingDefaultPassword })
    }
    if (path === '/auth/set-password' && method === 'POST') return await handleSetPassword(req, url)

    /* --- public application form --- */
    if (path === '/applications' && method === 'POST') return await handleCreateApplication(req)

    /* --- admin: applications --- */
    if (path === '/admin/applications' && method === 'GET') {
      await requireAdmin(req)
      const apps = await readDoc(KEYS.applications, {})
      const list = Object.values(apps).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return json({ applications: list })
    }
    let m
    if ((m = path.match(/^\/admin\/applications\/([\w-]+)\/approve$/)) && method === 'POST') {
      return await handleApproveApplication(req, url, m[1])
    }
    if ((m = path.match(/^\/admin\/applications\/([\w-]+)\/reject$/)) && method === 'POST') {
      return await handleRejectApplication(req, m[1])
    }

    /* --- admin: users --- */
    if (path === '/admin/users' && method === 'GET') return await handleListUsers(req)
    if (path === '/admin/users' && method === 'POST') return await handleCreateUser(req, url)
    if ((m = path.match(/^\/admin\/users\/([\w-]+)$/)) && method === 'PATCH') return await handlePatchUser(req, m[1])
    if ((m = path.match(/^\/admin\/users\/([\w-]+)\/reset$/)) && method === 'POST') {
      return await handleResetUserPassword(req, url, m[1])
    }

    /* --- reservations --- */
    if (path === '/availability' && method === 'GET') return await handleAvailability(req, url)
    if (path === '/reservations' && method === 'GET') return await handleListReservations(req, url)
    if (path === '/reservations' && method === 'POST') return await handleCreateReservation(req)
    if ((m = path.match(/^\/reservations\/group\/([\w-]+)$/)) && method === 'DELETE') return await handleCancelGroup(req, m[1])
    if ((m = path.match(/^\/reservations\/([\w-]+)$/)) && method === 'DELETE') return await handleCancelReservation(req, m[1])
    if ((m = path.match(/^\/admin\/reservations\/([\w-]+)\/approve$/)) && method === 'POST') {
      return await handleDecideReservation(req, m[1], 'confirmed')
    }
    if ((m = path.match(/^\/admin\/reservations\/([\w-]+)\/reject$/)) && method === 'POST') {
      return await handleDecideReservation(req, m[1], 'rejected')
    }

    return fail(404, 'not found', 'not_found')
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message, err.code)
    console.error('[api]', path, err)
    return fail(500, 'internal error', 'internal')
  }
}

export const config = { path: '/api/*' }
