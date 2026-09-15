/**
 * End-to-end journey against a running dev server (`npm run dev` on :5173).
 * Covers: company application → approval → invite → pending booking → approval.
 */
const B = 'http://localhost:5173/api'
let jar = {}
const ck = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
async function call(method, path, body, useJar = true) {
  const res = await fetch(B + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(useJar && ck() ? { Cookie: ck() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const sc = res.headers.get('set-cookie')
  if (sc && useJar) { const [kv] = sc.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1) }
  const txt = await res.text()
  return { status: res.status, data: txt ? JSON.parse(txt) : null }
}
let pass = 0, fail = 0
const ok = (l, c, x) => { c ? (pass++, console.log(`  ✓ ${l}`)) : (fail++, console.log(`  ✗ ${l} → ${JSON.stringify(x)}`)) }
const day = (() => { const d = new Date(); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

console.log('\n── company application → approval → pending booking → approval ──')
let r = await call('POST', '/applications', { type: 'company', data: {
  firstName: 'Marko', lastName: 'Perić', email: 'marko@prototip.hr', companyName: 'Prototip d.o.o.',
  oib: '12345678901', companyRole: 'CTO', companySize: 'small', website: 'https://prototip.hr', teamSize: '3',
  projectTitle: 'Mjerač potrošnje vode', timeframe: 'months',
  motivation: 'Razvijamo uređaj za daljinsko očitanje vodomjera i treba nam pristup elektroničkom laboratoriju i 3D pisaču.',
  gdpr: true, safety: true } }, false)
ok('company application accepted', r.status === 201, r.data)

jar = {}
await call('POST', '/auth/login', { username: 'admin', password: 'admin' })
r = await call('GET', '/admin/applications')
const app = r.data.applications[0]
ok('application visible to admin', !!app, r.data)
ok('company fields stored', app.data.companyName === 'Prototip d.o.o.' && app.data.oib === '12345678901', app.data)
ok('student fields not stored on a company application', app.data.institution === undefined && app.data.experience === undefined, Object.keys(app.data))

r = await call('POST', `/admin/applications/${app.id}/approve`)
const creds = r.data.credentials
ok('account created as marko.peric', creds.username === 'marko.peric', creds)
ok('org carried over from the company name', r.data.user.org === 'Prototip d.o.o.', r.data.user)
const memberId = r.data.user.id
const adminJar = { ...jar }

jar = {}
r = await call('POST', '/auth/set-password', { token: new URL(creds.inviteUrl).searchParams.get('token'), newPassword: 'marko-lozinka-2026' })
ok('invite link sets the password', r.status === 200 && r.data.user.mustChangePassword === false, r.data)

r = await call('POST', '/reservations', { toolId: 'compressor', date: day, hour: 9, hours: 2, note: 'Ispitivanje pneumatike' })
ok('restricted tool without induction → pending', r.data.reservation?.status === 'pending', r.data)
const resId = r.data.reservation.id

r = await call('GET', `/availability?toolId=compressor&from=${day}&days=1`)
ok('pending booking holds capacity', r.data.availability.compressor[day][9].free === 1 && r.data.availability.compressor[day][9].total === 2, r.data.availability?.compressor?.[day]?.[9])

console.log('\n── booking several tools in one go ──')
r = await call('POST', '/reservations', { toolIds: ['oscilloscope', 'soldering-station', 'mini-pc'], date: day, hour: 13, hours: 2, note: 'Ispitivanje prototipa' })
ok('three tools booked together', r.status === 201 && r.data.reservations.length === 3, r.data)
const gid = r.data.groupId
ok('group id issued', !!gid)
r = await call('GET', '/reservations')
ok('all three appear for the member', r.data.reservations.filter((x) => x.groupId === gid).length === 3)
r = await call('DELETE', `/reservations/group/${gid}`)
ok('cancelling the group clears all three', r.status === 200 && r.data.cancelled === 3, r.data)
r = await call('GET', `/availability?toolIds=oscilloscope,soldering-station,mini-pc&from=${day}&days=1`)
ok('capacity returned to every tool', ['oscilloscope', 'soldering-station', 'mini-pc'].every((id) => r.data.availability[id][day][13].free === r.data.tools[id].qty), r.data.availability)


const memberJar = { ...jar }
jar = { ...adminJar }
r = await call('GET', '/reservations?scope=all')
const row = r.data.reservations.find((x) => x.id === resId)
ok('admin sees the request with member and org', row?.userName === 'Marko Perić' && row?.userOrg === 'Prototip d.o.o.', row)
ok('admin approves it', (await call('POST', `/admin/reservations/${resId}/approve`)).status === 200)

jar = { ...memberJar }
r = await call('GET', '/reservations')
ok('member sees it confirmed', r.data.reservations.find((x) => x.id === resId)?.status === 'confirmed', r.data.reservations)

console.log('\n── deactivation cuts access ──')
jar = { ...adminJar }
await call('PATCH', `/admin/users/${memberId}`, { active: false })
jar = { ...memberJar }
ok('deactivated session is rejected', (await call('GET', '/auth/me')).status === 401)
ok('deactivated member cannot sign in', (await call('POST', '/auth/login', { username: 'marko.peric', password: 'marko-lozinka-2026' }, false)).status === 403)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
