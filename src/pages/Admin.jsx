import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Check, Inbox, Users, Calendar, Shield, X } from '../components/Icons.jsx'
import { CopyBox, Empty, Field, Input, Select, Spinner, useToast } from '../components/ui.jsx'
import { StatusBadge } from './Account.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'
import { api } from '../lib/api.js'
import { RESTRICTED, TOOL_BY_ID } from '../lib/tools.js'
import { formatDate, fmtHour, slotEndTime } from '../lib/schedule.js'

export default function Admin() {
  const { t } = useI18n()
  const [tab, setTab] = useState('applications')
  const [apps, setApps] = useState(null)
  const [users, setUsers] = useState(null)
  const [reservations, setReservations] = useState(null)
  const [defaultPw, setDefaultPw] = useState(false)

  const loadApps = useCallback(async () => {
    try { setApps((await api.get('/admin/applications')).applications) } catch { setApps([]) }
  }, [])
  const loadUsers = useCallback(async () => {
    try { setUsers((await api.get('/admin/users')).users) } catch { setUsers([]) }
  }, [])
  const loadRes = useCallback(async () => {
    try { setReservations((await api.get('/reservations?scope=all')).reservations) } catch { setReservations([]) }
  }, [])

  useEffect(() => {
    loadApps(); loadUsers(); loadRes()
    api.get('/auth/me').then((d) => setDefaultPw(!!d.usingDefaultPassword)).catch(() => {})
  }, [loadApps, loadUsers, loadRes])

  const pendingApps = (apps || []).filter((a) => a.status === 'pending').length
  const pendingRes = (reservations || []).filter((r) => r.status === 'pending').length

  const TABS = [
    { key: 'applications', label: t('admin.tabs.applications'), count: pendingApps },
    { key: 'users', label: t('admin.tabs.users'), count: 0 },
    { key: 'reservations', label: t('admin.tabs.reservations'), count: pendingRes },
    { key: 'inductions', label: t('admin.tabs.inductions'), count: 0 },
  ]

  return (
    <div className="page">
      <div className="wrap page-head">
        <span className="eyebrow">{t('admin.title')}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)' }}>{t('admin.title')}</h1>
        <p className="lead mt-2">{t('admin.lead')}</p>
      </div>

      <div className="wrap" style={{ paddingBlock: 24 }}>
        {defaultPw && (
          <div className="note note--danger" style={{ marginBottom: 22 }}>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Alert size={17} /><span>{t('admin.defaultPwWarn')}</span>
            </div>
          </div>
        )}

        <div className="tabs" style={{ marginBottom: 24 }}>
          {TABS.map((x) => (
            <button key={x.key} type="button" className={tab === x.key ? 'is-on' : ''} onClick={() => setTab(x.key)}>
              {x.label}{x.count > 0 && <span className="count">{x.count}</span>}
            </button>
          ))}
        </div>

        {tab === 'applications' && <Applications apps={apps} reload={() => { loadApps(); loadUsers() }} />}
        {tab === 'users' && <Members users={users} reload={loadUsers} />}
        {tab === 'reservations' && <Bookings rows={reservations} reload={loadRes} />}
        {tab === 'inductions' && <Inductions users={users} reload={loadUsers} />}
      </div>
    </div>
  )
}

/* ========================================================================== */
/* Credentials hand-off                                                       */
/* ========================================================================== */

function CredentialsCard({ creds, name, onClose }) {
  const { t, lang } = useI18n()
  if (!creds) return null

  const message = lang === 'hr'
    ? `Poštovani/a ${name},\n\nvaša prijava za korištenje Centra za tehnološki razvoj Istarske županije je odobrena.\n\nKorisničko ime: ${creds.username}\nPrivremena lozinka: ${creds.password}\n\nAktivirajte račun i postavite vlastitu lozinku na:\n${creds.inviteUrl}\n\nPoveznica vrijedi ${creds.expiresInDays} dana. Javit ćemo vam se s terminom uvodne obuke.\n\nSrdačan pozdrav,\nCTRI`
    : `Dear ${name},\n\nyour application to use the Technology Development Centre of Istria County has been approved.\n\nUsername: ${creds.username}\nTemporary password: ${creds.password}\n\nActivate your account and set your own password at:\n${creds.inviteUrl}\n\nThe link is valid for ${creds.expiresInDays} days. We will be in touch with an induction slot.\n\nBest regards,\nCTRI`

  return (
    <div className="panel" style={{ marginBottom: 24, borderColor: 'var(--ok)' }}>
      <div className="panel__head" style={{ background: 'var(--ok-soft)' }}>
        <div className="spread">
          <div className="row" style={{ gap: 8 }}>
            <Check size={17} style={{ color: 'var(--ok)' }} />
            <strong>{t('admin.apps.createdTitle')}</strong>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label={t('admin.apps.done')}><X size={16} /></button>
        </div>
      </div>
      <div className="panel__body">
        <p className="small muted" style={{ marginBottom: 16 }}>{t('admin.apps.createdLead')}</p>
        <div className="stack" style={{ gap: 12 }}>
          <CopyBox label={t('admin.apps.username')} value={creds.username} />
          <CopyBox label={t('admin.apps.tempPassword')} value={creds.password} />
          <CopyBox label={t('admin.apps.inviteLink')} value={creds.inviteUrl} />
          <CopyBox label={t('admin.apps.emailDraft')} value={message} multiline />
        </div>
      </div>
    </div>
  )
}

/* ========================================================================== */
/* Applications                                                               */
/* ========================================================================== */

function ApplicationCard({ app, onApprove, onReject, busy }) {
  const { t, dict } = useI18n()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const d = app.data

  const rows = [
    [t('apply.f.email'), d.email],
    [t('apply.f.phone'), d.phone],
    [t('apply.f.city'), d.city],
    [t('apply.f.institution'), d.institution],
    [t('apply.f.studyProgram'), d.studyProgram],
    [t('apply.f.studyYear'), d.studyYear],
    [t('apply.f.studentId'), d.studentId],
    [t('apply.f.occupation'), d.occupation],
    [t('apply.f.experience'), d.experience ? t(`apply.exp.${d.experience}`) : ''],
    [t('apply.f.companyName'), d.companyName],
    [t('apply.f.oib'), d.oib],
    [t('apply.f.companyRole'), d.companyRole],
    [t('apply.f.companySize'), d.companySize ? t(`apply.sizes.${d.companySize}`) : ''],
    [t('apply.f.website'), d.website],
    [t('apply.f.teamSize'), d.teamSize],
    [t('apply.f.projectTitle'), d.projectTitle],
    [t('apply.f.timeframe'), d.timeframe ? t(`apply.timeframes.${d.timeframe}`) : ''],
    [t('apply.f.equipment'), d.equipment],
  ].filter(([, v]) => v)

  return (
    <article className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__head">
        <div className="spread">
          <div>
            <strong>{d.firstName} {d.lastName}</strong>
            <div className="tiny faint mono">{app.ref} · {formatDate(app.createdAt.slice(0, 10), dict)}</div>
          </div>
          <div className="row">
            <span className="badge badge--teal">{t(`apply.types.${app.type}.t`)}</span>
            {app.status !== 'pending' && (
              <span className={`badge ${app.status === 'approved' ? 'badge--ok' : 'badge--danger'}`}>
                {app.status === 'approved' ? t('admin.apps.approved') : t('admin.apps.rejected')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="panel__body">
        <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          {t('admin.apps.motivation')}
        </div>
        <p style={{ whiteSpace: 'pre-wrap', marginBottom: 18 }}>{d.motivation}</p>

        {rows.length > 0 && (
          <>
            <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('admin.apps.detailsFor')}
            </div>
            <dl className="kv" style={{ marginBottom: 18 }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </>
        )}

        {app.note && <div className="note note--warn" style={{ marginBottom: 14 }}>{app.note}</div>}

        {app.status === 'pending' && (
          rejecting ? (
            <div>
              <Field label={t('admin.apps.rejectReason')} name={`rej-${app.id}`}>
                <textarea id={`rej-${app.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 72 }} />
              </Field>
              <div className="row">
                <button type="button" className="btn btn--danger" onClick={() => onReject(app, note)} disabled={busy}>
                  {t('admin.apps.reject')}
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => setRejecting(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="btn btn--teal" onClick={() => onApprove(app)} disabled={busy}>
                <Check size={15} /> {t('admin.apps.approve')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setRejecting(true)} disabled={busy}>
                {t('admin.apps.reject')}
              </button>
            </div>
          )
        )}
      </div>
    </article>
  )
}

function Applications({ apps, reload }) {
  const { t } = useI18n()
  const toast = useToast()
  const [creds, setCreds] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showProcessed, setShowProcessed] = useState(false)

  if (apps === null) return <Spinner label={t('common.loading')} />

  const pending = apps.filter((a) => a.status === 'pending')
  const processed = apps.filter((a) => a.status !== 'pending')

  async function approve(app) {
    setBusy(true)
    try {
      const res = await api.post(`/admin/applications/${app.id}/approve`)
      setCreds({ ...res.credentials, name: `${app.data.firstName} ${app.data.lastName}` })
      toast(t('admin.apps.approved'))
      reload()
      window.scrollTo(0, 0)
    } catch { toast(t('common.error'), 'err') } finally { setBusy(false) }
  }

  async function reject(app, note) {
    setBusy(true)
    try {
      await api.post(`/admin/applications/${app.id}/reject`, { note })
      toast(t('admin.apps.rejected'))
      reload()
    } catch { toast(t('common.error'), 'err') } finally { setBusy(false) }
  }

  return (
    <>
      <CredentialsCard creds={creds} name={creds?.name} onClose={() => setCreds(null)} />

      <h2 style={{ fontSize: '1.15rem', marginBottom: 14 }}>{t('admin.apps.pending')}</h2>
      {pending.length === 0 ? (
        <Empty icon={<Inbox size={38} />} title={t('admin.apps.none')} hint={t('admin.apps.noneHint')} />
      ) : (
        pending.map((a) => <ApplicationCard key={a.id} app={a} onApprove={approve} onReject={reject} busy={busy} />)
      )}

      {processed.length > 0 && (
        <>
          <div className="spread" style={{ margin: '32px 0 14px' }}>
            <h2 style={{ fontSize: '1.15rem' }}>{t('admin.apps.processed')} ({processed.length})</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowProcessed((s) => !s)}>
              {showProcessed ? t('common.close') : t('tools.details')}
            </button>
          </div>
          {showProcessed && processed.map((a) => (
            <ApplicationCard key={a.id} app={a} onApprove={approve} onReject={reject} busy={busy} />
          ))}
        </>
      )}
    </>
  )
}

/* ========================================================================== */
/* Members                                                                    */
/* ========================================================================== */

function Members({ users, reload }) {
  const { t, dict } = useI18n()
  const { user: me } = useAuth()
  const toast = useToast()
  const [creds, setCreds] = useState(null)
  const [adding, setAdding] = useState(false)

  if (users === null) return <Spinner label={t('common.loading')} />

  async function patch(u, body) {
    try { await api.patch(`/admin/users/${u.id}`, body); reload() }
    catch { toast(t('common.error'), 'err') }
  }

  async function resetPw(u) {
    if (!confirm(t('admin.users.resetPwConfirm'))) return
    try {
      const res = await api.post(`/admin/users/${u.id}/reset`)
      setCreds({ ...res.credentials, name: u.name })
      reload()
      window.scrollTo(0, 0)
    } catch { toast(t('common.error'), 'err') }
  }

  return (
    <>
      <CredentialsCard creds={creds} name={creds?.name} onClose={() => setCreds(null)} />

      <div className="spread" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.15rem' }}>{t('admin.tabs.users')} ({users.length})</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding((a) => !a)}>
          {adding ? t('common.cancel') : t('admin.users.add')}
        </button>
      </div>

      {adding && <AddMember onDone={(c) => { setCreds(c); setAdding(false); reload(); window.scrollTo(0, 0) }} />}

      {users.length === 0 ? (
        <Empty icon={<Users size={38} />} title={t('admin.users.none')} />
      ) : (
        <div className="panel"><div className="table-wrap"><table className="t">
          <thead><tr>
            <th>{t('admin.users.name')}</th>
            <th>{t('auth.username')}</th>
            <th>{t('admin.users.role')}</th>
            <th>{t('admin.users.status')}</th>
            <th>{t('admin.users.lastLogin')}</th>
            <th />
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <div className="tiny faint">{u.email || '—'}{u.org ? ` · ${u.org}` : ''}</div>
                </td>
                <td className="mono small">{u.username}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge--coral' : ''}`}>
                    {u.role === 'admin' ? t('admin.users.roleAdmin') : t('admin.users.roleMember')}
                  </span>
                </td>
                <td>
                  {u.active
                    ? <span className="badge badge--ok">{t('admin.users.active')}</span>
                    : <span className="badge badge--danger">{t('admin.users.inactive')}</span>}
                  {u.pendingPassword && <div className="tiny faint" style={{ marginTop: 4 }}>{t('admin.users.pendingPw')}</div>}
                </td>
                <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                  {u.lastLoginAt ? formatDate(u.lastLoginAt.slice(0, 10), dict) : t('admin.users.never')}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u.id === me.id ? (
                    <span className="tiny faint">{t('admin.users.selfNote')}</span>
                  ) : (
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button type="button" className="btn btn--sm btn--quiet" onClick={() => resetPw(u)}>{t('admin.users.resetPw')}</button>
                      <button
                        type="button"
                        className="btn btn--sm btn--quiet"
                        onClick={() => patch(u, { role: u.role === 'admin' ? 'member' : 'admin' })}
                      >
                        {u.role === 'admin' ? t('admin.users.makeMember') : t('admin.users.makeAdmin')}
                      </button>
                      <button
                        type="button"
                        className={`btn btn--sm ${u.active ? 'btn--danger' : 'btn--ghost'}`}
                        onClick={() => patch(u, { active: !u.active })}
                      >
                        {u.active ? t('admin.users.deactivate') : t('admin.users.activate')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
    </>
  )
}

function AddMember({ onDone }) {
  const { t } = useI18n()
  const toast = useToast()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', memberType: 'individual', org: '', role: 'member' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors({}) }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = t('apply.errRequired')
    if (!form.lastName.trim()) errs.lastName = t('apply.errRequired')
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email)) errs.email = t('apply.errEmail')
    if (Object.keys(errs).length) return setErrors(errs)

    setBusy(true)
    try {
      const res = await api.post('/admin/users', form)
      onDone({ ...res.credentials, name: `${form.firstName} ${form.lastName}` })
    } catch { toast(t('common.error'), 'err') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 22 }} noValidate>
      <h3 style={{ fontSize: '1.05rem' }}>{t('admin.users.addTitle')}</h3>
      <p className="small muted" style={{ marginBottom: 18 }}>{t('admin.users.addLead')}</p>
      <div className="form-grid">
        <Field label={t('apply.f.firstName')} name="a-first" required error={errors.firstName}>
          <Input name="a-first" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
        </Field>
        <Field label={t('apply.f.lastName')} name="a-last" required error={errors.lastName}>
          <Input name="a-last" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        </Field>
        <Field label={t('apply.f.email')} name="a-email" required error={errors.email}>
          <Input name="a-email" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        </Field>
        <Field label={t('admin.users.type')} name="a-type">
          <Select name="a-type" value={form.memberType} onChange={set('memberType')}>
            <option value="student">{t('apply.types.student.t')}</option>
            <option value="individual">{t('apply.types.individual.t')}</option>
            <option value="company">{t('apply.types.company.t')}</option>
            <option value="staff">CTRI</option>
          </Select>
        </Field>
        <Field label={t('apply.f.companyName')} name="a-org" hint={t('common.optional')}>
          <Input name="a-org" value={form.org} onChange={set('org')} />
        </Field>
        <Field label={t('admin.users.role')} name="a-role">
          <Select name="a-role" value={form.role} onChange={set('role')}>
            <option value="member">{t('admin.users.roleMember')}</option>
            <option value="admin">{t('admin.users.roleAdmin')}</option>
          </Select>
        </Field>
      </div>
      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? t('common.saving') : t('admin.users.add')}
      </button>
    </form>
  )
}

/* ========================================================================== */
/* Bookings                                                                   */
/* ========================================================================== */

function Bookings({ rows, reload }) {
  const { t, lang, dict } = useI18n()
  const toast = useToast()
  const [filter, setFilter] = useState('pending')
  const now = Date.now()

  // Hooks must run on every render, so this sits above the loading return.
  const filtered = useMemo(() => {
    const list = rows || []
    if (filter === 'pending') return list.filter((r) => r.status === 'pending')
    if (filter === 'confirmed') return list.filter((r) => r.status === 'confirmed')
    if (filter === 'upcoming') return list.filter((r) => slotEndTime(r.date, r.hour, r.hours) >= now && ['pending', 'confirmed'].includes(r.status))
    return list
  }, [rows, filter, now])

  if (rows === null) return <Spinner label={t('common.loading')} />

  async function act(r, what) {
    try {
      if (what === 'cancel') await api.del(`/reservations/${r.id}`)
      else await api.post(`/admin/reservations/${r.id}/${what}`)
      reload()
    } catch { toast(t('common.error'), 'err') }
  }

  const FILTERS = [
    ['pending', t('admin.res.filterPending')],
    ['upcoming', t('admin.res.filterUpcoming')],
    ['confirmed', t('admin.res.filterConfirmed')],
    ['all', t('admin.res.filterAll')],
  ]

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.15rem' }}>{filter === 'pending' ? t('admin.res.pendingTitle') : t('admin.res.allTitle')}</h2>
        <div className="seg">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<Calendar size={38} />} title={t('admin.res.none')} />
      ) : (
        <div className="panel"><div className="table-wrap"><table className="t">
          <thead><tr>
            <th>{t('booking.tool')}</th><th>{t('booking.who')}</th><th>{t('booking.when')}</th><th>{t('booking.status')}</th><th />
          </tr></thead>
          <tbody>
            {filtered.map((r) => {
              const tool = TOOL_BY_ID[r.toolId]
              const upcoming = slotEndTime(r.date, r.hour, r.hours) >= now
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{tool ? tool.name[lang] : r.toolId}</strong>
                    {tool?.restricted && <div className="tiny" style={{ color: 'var(--warn)' }}>{t('tools.restricted')}</div>}
                    {r.note && <div className="tiny faint" style={{ marginTop: 3, maxWidth: 280 }}>{r.note}</div>}
                  </td>
                  <td>
                    {r.userName}
                    <div className="tiny faint mono">{r.userUsername}{r.userOrg ? ` · ${r.userOrg}` : ''}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(r.date, dict)}
                    <div className="tiny faint">{fmtHour(r.hour)} – {fmtHour(r.hour + r.hours)}</div>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {r.status === 'pending' && (
                        <>
                          <button type="button" className="btn btn--sm btn--teal" onClick={() => act(r, 'approve')}>{t('admin.res.approve')}</button>
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => act(r, 'reject')}>{t('admin.res.reject')}</button>
                        </>
                      )}
                      {r.status === 'confirmed' && upcoming && (
                        <button type="button" className="btn btn--sm btn--danger" onClick={() => act(r, 'cancel')}>{t('admin.res.cancel')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div></div>
      )}
    </>
  )
}

/* ========================================================================== */
/* Inductions                                                                 */
/* ========================================================================== */

function Inductions({ users, reload }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(null)

  if (users === null) return <Spinner label={t('common.loading')} />
  const members = users.filter((u) => u.active)

  async function toggle(u, toolId) {
    const next = u.trained.includes(toolId) ? u.trained.filter((x) => x !== toolId) : [...u.trained, toolId]
    setSaving(u.id)
    try {
      await api.patch(`/admin/users/${u.id}`, { trained: next })
      await reload()
      toast(t('admin.ind.saved'))
    } catch { toast(t('common.error'), 'err') } finally { setSaving(null) }
  }

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <Shield size={18} style={{ color: 'var(--teal)' }} />
        <h2 style={{ fontSize: '1.15rem' }}>{t('admin.tabs.inductions')}</h2>
      </div>
      <p className="small muted" style={{ marginBottom: 20, maxWidth: '70ch' }}>{t('admin.ind.lead')}</p>

      {members.length === 0 ? (
        <Empty icon={<Users size={38} />} title={t('admin.ind.none')} />
      ) : (
        <div className="panel"><div className="table-wrap"><table className="t ind-table">
          <thead><tr>
            <th>{t('admin.ind.user')}</th>
            {RESTRICTED.map((x) => (
              <th key={x.id} className="ind-col" title={x.name[lang]}>
                {(x.abbr || x.name)[lang]}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {members.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <div className="tiny faint mono">{u.username}</div>
                </td>
                {RESTRICTED.map((x) => (
                  <td key={x.id} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={u.trained.includes(x.id)}
                      disabled={saving === u.id}
                      onChange={() => toggle(u, x.id)}
                      style={{ width: 17, height: 17, accentColor: 'var(--teal-bright)' }}
                      aria-label={`${u.name} — ${x.name[lang]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}
    </>
  )
}
