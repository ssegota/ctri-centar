/**
 * Exercises the API handler directly (no Netlify runtime) against the local
 * file-backed store. Run with: npm run test:api
 */
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

// Own store, wiped each run. These tests change the admin password and lock an
// account, so they must never touch the store `npm run dev` is using.
const STORE = '.netlify/blobs-test'
process.env.CTRI_LOCAL_STORE_DIR = STORE
await rm(resolve(process.cwd(), STORE), { recursive: true, force: true })
const { default: handler } = await import('../netlify/functions/api.js')

const BASE = 'http://localhost:8888'
let cookie = ''
let pass = 0, fail = 0

function ok(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? `  → ${JSON.stringify(extra)}` : ''}`) }
}

async function call(method, path, body, { useCookie = true } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (useCookie && cookie) headers.Cookie = cookie
  const res = await handler(new Request(`${BASE}/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  }), {})
  const setCookie = res.headers.get('set-cookie')
  if (useCookie && setCookie) cookie = setCookie.split(';')[0]
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  return { status: res.status, data }
}

function futureDate(offsetDays = 0) {
  // Next Wednesday plus offset — always an open day, always in the future.
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7) + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

console.log('\n── auth ──────────────────────────────────────────')
ok('unauthenticated /auth/me is 401', (await call('GET', '/auth/me')).status === 401)
ok('wrong password rejected', (await call('POST', '/auth/login', { username: 'admin', password: 'wrong' })).status === 401)
let r = await call('POST', '/auth/login', { username: 'admin', password: 'admin' })
ok('admin/admin signs in', r.status === 200 && r.data.user.role === 'admin', r.data)
r = await call('GET', '/auth/me')
ok('session cookie works', r.status === 200 && r.data.user.username === 'admin', r.data)
ok('default-password flag is set', r.data.usingDefaultPassword === true)

console.log('\n── application form ──────────────────────────────')
const adminCookie = cookie
cookie = ''
r = await call('POST', '/applications', { type: 'student', data: { firstName: 'Ana', lastName: 'Kovačić' } })
ok('rejects incomplete application', r.status === 400, r.data)
r = await call('POST', '/applications', {
  type: 'student',
  data: {
    firstName: 'Ana', lastName: 'Kovačić', email: 'ana@example.com', institution: 'Sveučilište Jurja Dobrile u Puli',
    motivation: 'Radim na diplomskom radu o senzorskoj mreži i treba mi 3D pisač i osciloskop.',
    gdpr: true, safety: true,
  },
})
ok('accepts a valid application', r.status === 201 && /^CTRI-\d{4}-0001$/.test(r.data.ref), r.data)
const appRef = r.data.ref
r = await call('POST', '/applications', {
  type: 'company',
  data: {
    firstName: 'Marko', lastName: 'Perić', email: 'marko@example.hr', companyName: 'Prototip d.o.o.',
    motivation: 'Razvijamo uređaj za praćenje potrošnje vode i treba nam pristup radionici.',
    gdpr: true, safety: true,
  },
})
ok('reference numbers increment', r.data.ref === 'CTRI-2026-0002' || /0002$/.test(r.data.ref), r.data)

console.log('\n── admin guard ───────────────────────────────────')
ok('anonymous cannot list applications', (await call('GET', '/admin/applications')).status === 401)

cookie = adminCookie
r = await call('GET', '/admin/applications')
ok('admin lists 2 applications', r.status === 200 && r.data.applications.length === 2, r.data)
const pendingApp = r.data.applications.find((a) => a.ref === appRef)

console.log('\n── approval creates an account ───────────────────')
r = await call('POST', `/admin/applications/${pendingApp.id}/approve`)
ok('approval returns credentials', r.status === 200 && !!r.data.credentials.password, r.data)
ok('username derives from the name', r.data.credentials.username === 'ana.kovacic', r.data.credentials)
ok('invite link points at /set-password', r.data.credentials.inviteUrl.startsWith(`${BASE}/set-password?token=`))
const creds = r.data.credentials
const inviteToken = new URL(creds.inviteUrl).searchParams.get('token')
const memberId = r.data.user.id
ok('re-approving is rejected', (await call('POST', `/admin/applications/${pendingApp.id}/approve`)).status === 400)

console.log('\n── first login forces a password change ──────────')
cookie = ''
r = await call('POST', '/auth/login', { username: 'ana.kovacic', password: creds.password })
ok('temp password signs in', r.status === 200, r.data)
ok('mustChangePassword is set', r.data.user.mustChangePassword === true)
const tempSession = cookie
r = await call('POST', '/reservations', { toolId: 'soldering-station', date: futureDate(), hour: 10, hours: 2 })
ok('cannot book before setting a password', r.status === 403, r.data)
r = await call('POST', '/auth/set-password', { newPassword: 'short' })
ok('short password rejected', r.status === 400 && r.data.code === 'pw_short', r.data)
r = await call('POST', '/auth/set-password', { newPassword: 'ispravna-lozinka-2026' })
ok('password change accepted', r.status === 200 && r.data.user.mustChangePassword === false, r.data)

console.log('\n── invite link is single-use ─────────────────────')
r = await call('POST', '/auth/set-password', { token: inviteToken, newPassword: 'drukcija-lozinka-2026' }, { useCookie: false })
ok('used invite token no longer works', r.status === 400 && r.data.code === 'bad_invite', r.data)

console.log('\n── old session is invalidated ────────────────────')
const liveSession = cookie
cookie = tempSession
ok('session from before the change is dead', (await call('GET', '/auth/me')).status === 401)
cookie = liveSession
ok('current session still valid', (await call('GET', '/auth/me')).status === 200)

console.log('\n── booking rules ─────────────────────────────────')
const day = futureDate()
r = await call('POST', '/reservations', { toolId: 'soldering-station', date: day, hour: 10, hours: 2 })
ok('unrestricted tool confirms immediately', r.status === 201 && r.data.reservation.status === 'confirmed', r.data)
const myRes = r.data.reservation.id

r = await call('POST', '/reservations', { toolId: 'table-saw', date: day, hour: 10, hours: 2 })
ok('restricted tool without induction is pending', r.status === 201 && r.data.reservation.status === 'pending', r.data)
const pendingRes = r.data.reservation.id

r = await call('POST', '/reservations', { toolId: 'table-saw', date: day, hour: 11, hours: 1 })
ok('single-unit tool is full while held', r.status === 409 && r.data.code === 'full', r.data)

r = await call('POST', '/reservations', { toolId: 'table-saw', date: day, hour: 8, hours: 6 })
ok('over the per-tool session cap is rejected', r.status === 409 && r.data.code === 'too_long', r.data)

// Find the next Sunday — the Centre is closed.
const sunday = (() => {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
r = await call('POST', '/reservations', { toolId: 'soldering-station', date: sunday, hour: 10, hours: 1 })
ok('Sunday is closed', r.status === 409 && r.data.code === 'closed', r.data)

const saturday = (() => {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()
r = await call('POST', '/reservations', { toolId: 'soldering-station', date: saturday, hour: 10, hours: 1 })
ok('Saturday is closed', r.status === 409 && r.data.code === 'closed', r.data)

r = await call('POST', '/reservations', { toolId: 'soldering-station', date: day, hour: 19, hours: 2 })
ok('cannot run past closing time', r.status === 409 && r.data.code === 'closed', r.data)

r = await call('POST', '/reservations', { toolId: 'soldering-station', date: '2020-05-05', hour: 10, hours: 1 })
ok('past dates rejected', r.status === 409, r.data)

r = await call('POST', '/reservations', { toolId: 'clamp-300', date: day, hour: 10, hours: 1 })
ok('non-bookable item rejected', r.status === 409 && r.data.code === 'not_bookable', r.data)

r = await call('GET', `/availability?toolId=soldering-station&from=${day}&days=7`)
const av = (id) => r.data.availability[id]
ok('availability reflects the booking', av('soldering-station')[day][10].free === 1 && av('soldering-station')[day][10].total === 2, av('soldering-station')?.[day]?.[10])
ok('untouched hour stays fully free', av('soldering-station')[day][15].free === 2)
ok('own bookings are returned', r.data.mine.length === 1)

console.log('\n── capacity across units ─────────────────────────')
r = await call('POST', '/reservations', { toolId: 'soldering-station', date: day, hour: 11, hours: 1 })
ok('second unit of a 2-unit tool books', r.status === 201, r.data)
r = await call('POST', '/reservations', { toolId: 'soldering-station', date: day, hour: 11, hours: 1 })
ok('third booking on a 2-unit tool is full', r.status === 409 && r.data.code === 'full', r.data)

console.log('\n── admin approves a pending booking ──────────────')
const memberSession = cookie
cookie = adminCookie
r = await call('GET', '/reservations?scope=all')
ok('admin sees every booking with member names', r.data.reservations.some((x) => x.userName === 'Ana Kovačić'), r.data.reservations?.[0])
r = await call('POST', `/admin/reservations/${pendingRes}/approve`)
ok('pending booking approved', r.status === 200, r.data)
r = await call('POST', `/admin/reservations/${pendingRes}/approve`)
ok('approving twice is a no-op 404', r.status === 404)

console.log('\n── inductions remove the approval step ───────────')
r = await call('PATCH', `/admin/users/${memberId}`, { trained: ['table-saw'] })
ok('induction recorded', r.status === 200 && r.data.user.trained.includes('table-saw'), r.data)
r = await call('PATCH', `/admin/users/${memberId}`, { trained: ['soldering-station'] })
ok('induction ignored for unrestricted tools', r.data.user.trained.length === 0, r.data.user)
await call('PATCH', `/admin/users/${memberId}`, { trained: ['table-saw'] })

cookie = memberSession
r = await call('POST', '/reservations', { toolId: 'table-saw', date: futureDate(1), hour: 9, hours: 2 })
ok('trained member books a restricted tool directly', r.status === 201 && r.data.reservation.status === 'confirmed', r.data)

console.log('\n── cancellation & ownership ──────────────────────')
r = await call('DELETE', `/reservations/${myRes}`)
ok('member cancels own booking', r.status === 200)
r = await call('GET', `/availability?toolId=soldering-station&from=${day}&days=1`)
ok('capacity is released on cancel', r.data.availability['soldering-station'][day][10].free === 2, r.data.availability['soldering-station'][day][10])

console.log('\n── booking several tools at once ─────────────────')
const multiDay = futureDate(2)
r = await call('POST', '/reservations', { toolIds: ['oscilloscope', 'lab-psu', 'bench-dmm'], date: multiDay, hour: 10, hours: 2 })
ok('three tools book in one request', r.status === 201 && r.data.reservations.length === 3, r.data)
ok('they share a group id', new Set(r.data.reservations.map((x) => x.groupId)).size === 1 && !!r.data.groupId, r.data.groupId)
const groupId = r.data.groupId

r = await call('GET', `/availability?toolIds=oscilloscope,lab-psu,bench-dmm&from=${multiDay}&days=1`)
ok('availability answers for every tool', Object.keys(r.data.availability).length === 3, Object.keys(r.data.availability || {}))
ok('each tool lost one unit', ['oscilloscope', 'lab-psu', 'bench-dmm'].every((id) => r.data.availability[id][multiDay][10].free === 1), r.data.availability)

// table-saw has one unit and is already taken that day, so the whole group must fail
r = await call('POST', '/reservations', { toolIds: ['function-gen', 'table-saw'], date: day, hour: 10, hours: 1 })
ok('a full tool rejects the whole group', r.status === 409, r.data)
r = await call('GET', `/availability?toolId=function-gen&from=${day}&days=1`)
ok('nothing was half-booked', r.data.availability['function-gen'][day][10].free === 2, r.data.availability['function-gen'][day][10])

// 3d-scanner is open to all; table-saw is restricted but ana has the induction,
// so both land confirmed — status is decided per tool, not per group.
r = await call('POST', '/reservations', { toolIds: ['3d-scanner-otter', 'table-saw'], date: multiDay, hour: 16, hours: 1 })
ok('status is decided per tool', r.status === 201 && r.data.reservations.every((x) => x.status === 'confirmed'), r.data.reservations?.map((x) => [x.toolId, x.status]))

// mini-pc is unrestricted, compressor is restricted and ana has no induction for it
r = await call('POST', '/reservations', { toolIds: ['mini-pc', 'compressor'], date: multiDay, hour: 17, hours: 1 })
const byTool = Object.fromEntries((r.data.reservations || []).map((x) => [x.toolId, x.status]))
ok('one group can hold both confirmed and pending', byTool['mini-pc'] === 'confirmed' && byTool['compressor'] === 'pending', byTool)

r = await call('DELETE', `/reservations/group/${groupId}`)
ok('cancelling a group cancels all three', r.status === 200 && r.data.cancelled === 3, r.data)
r = await call('GET', `/availability?toolIds=oscilloscope,lab-psu,bench-dmm&from=${multiDay}&days=1`)
ok('group cancel releases every tool', ['oscilloscope', 'lab-psu', 'bench-dmm'].every((id) => r.data.availability[id][multiDay][10].free === 2), r.data.availability)

const manyIds = ['oscilloscope','lab-psu','bench-dmm','function-gen','soldering-station','thermal-camera','mini-pc','portable-screen','aio-workstation','workbench','height-bench','whiteboard','tool-trolley']
r = await call('POST', '/reservations', { toolIds: manyIds, date: multiDay, hour: 14, hours: 1 })
ok('more than 12 tools is rejected', r.status === 400 && r.data.code === 'too_many_tools', r.data)
r = await call('POST', '/reservations', { toolIds: Array(6).fill('oscilloscope'), date: multiDay, hour: 14, hours: 1 })
ok('a repeated tool counts once', r.status === 201 && r.data.reservations.length === 1, r.data)

console.log('\n── privilege escalation guards ───────────────────')
ok('member cannot list users', (await call('GET', '/admin/users')).status === 403)
ok('member cannot approve applications', (await call('POST', '/admin/applications/x/approve')).status === 403)
ok('member cannot grant themselves admin', (await call('PATCH', `/admin/users/${memberId}`, { role: 'admin' })).status === 403)

cookie = adminCookie
r = await call('PATCH', `/admin/users/${(await call('GET', '/auth/me')).data.user.id}`, { role: 'member' })
ok('admin cannot demote themselves', r.data.user.role === 'admin', r.data.user)

console.log('\n── admin password change clears the warning ──────')
r = await call('POST', '/auth/set-password', { newPassword: 'nova-admin-lozinka-2026' })
ok('voluntary change requires the current password', r.status === 400 && r.data.code === 'bad_credentials', r.data)
r = await call('POST', '/auth/set-password', { currentPassword: 'admin', newPassword: 'nova-admin-lozinka-2026' })
ok('admin password changed', r.status === 200, r.data)
r = await call('POST', '/auth/set-password', { currentPassword: 'nova-admin-lozinka-2026', newPassword: 'nova-admin-lozinka-2026' })
ok('reusing the same password is rejected', r.status === 400 && r.data.code === 'pw_same', r.data)
r = await call('GET', '/auth/me')
ok('default-password warning cleared', r.data.usingDefaultPassword === false, r.data)
ok('old admin password no longer works', (await call('POST', '/auth/login', { username: 'admin', password: 'admin' }, { useCookie: false })).status === 401)

console.log('\n── account lockout ───────────────────────────────')
for (let i = 0; i < 8; i++) await call('POST', '/auth/login', { username: 'ana.kovacic', password: 'nope' }, { useCookie: false })
r = await call('POST', '/auth/login', { username: 'ana.kovacic', password: 'ispravna-lozinka-2026' }, { useCookie: false })
ok('account locks after repeated failures', r.status === 429 && r.data.code === 'locked', r.data)

console.log(`\n${'─'.repeat(50)}\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
