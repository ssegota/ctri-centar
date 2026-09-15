import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Shield, Check, User } from '../components/Icons.jsx'
import { Empty, Spinner, Field, Input, useToast } from '../components/ui.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'
import { api } from '../lib/api.js'
import { TOOL_BY_ID, RESTRICTED } from '../lib/tools.js'
import { formatDate, fmtHour, slotEndTime } from '../lib/schedule.js'

const STATUS_BADGE = { pending: 'badge--warn', confirmed: 'badge--ok', rejected: 'badge--danger', cancelled: '' }

export function StatusBadge({ status }) {
  const { t } = useI18n()
  const key = { pending: 'statusPending', confirmed: 'statusConfirmed', rejected: 'statusRejected', cancelled: 'statusCancelled' }[status]
  return <span className={`badge ${STATUS_BADGE[status] || ''}`}>{t(`booking.${key}`)}</span>
}

/**
 * Bookings made together share a groupId and are shown as a single row —
 * one slot, several tools, one cancel button.
 */
function groupRows(list) {
  const out = []
  const byGroup = new Map()
  for (const r of list) {
    if (!r.groupId) { out.push({ key: r.id, items: [r] }); continue }
    if (!byGroup.has(r.groupId)) {
      const entry = { key: r.groupId, groupId: r.groupId, items: [] }
      byGroup.set(r.groupId, entry)
      out.push(entry)
    }
    byGroup.get(r.groupId).items.push(r)
  }
  return out
}

function ReservationRow({ row, onCancel, canCancel }) {
  const { t, lang, dict } = useI18n()
  const first = row.items[0]
  const statuses = [...new Set(row.items.map((x) => x.status))]
  return (
    <tr>
      <td>
        {row.items.map((r) => {
          const tool = TOOL_BY_ID[r.toolId]
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{tool ? tool.name[lang] : r.toolId}</strong>
              {statuses.length > 1 && <StatusBadge status={r.status} />}
            </div>
          )
        })}
        {first.note && <div className="tiny faint" style={{ marginTop: 3, maxWidth: 320 }}>{first.note}</div>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {formatDate(first.date, dict)}
        <div className="tiny faint">{fmtHour(first.hour)} – {fmtHour(first.hour + first.hours)}</div>
      </td>
      <td>{statuses.length === 1 ? <StatusBadge status={statuses[0]} /> : <span className="tiny faint">—</span>}</td>
      <td style={{ textAlign: 'right' }}>
        {canCancel && (
          <button type="button" className="btn btn--sm btn--danger" onClick={() => onCancel(row)}>
            {row.items.length > 1 ? t('booking.cancelGroup') : t('account.cancel')}
          </button>
        )}
      </td>
    </tr>
  )
}

export default function Account() {
  const { t, dict, lang } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('reservations')
  const [rows, setRows] = useState(null)

  async function load() {
    try { setRows((await api.get('/reservations')).reservations) } catch { setRows([]) }
  }
  useEffect(() => { load() }, [])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const list = rows || []
    return {
      upcoming: list.filter((r) => slotEndTime(r.date, r.hour, r.hours) >= now && r.status !== 'cancelled' && r.status !== 'rejected')
        .sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1)),
      past: list.filter((r) => slotEndTime(r.date, r.hour, r.hours) < now || r.status === 'cancelled' || r.status === 'rejected'),
    }
  }, [rows])

  async function cancel(row) {
    if (!confirm(t('account.cancelConfirm'))) return
    try {
      if (row.groupId) await api.del(`/reservations/group/${row.groupId}`)
      else await api.del(`/reservations/${row.items[0].id}`)
      toast(t('booking.statusCancelled'))
      load()
    } catch {
      toast(t('common.error'), 'err')
    }
  }

  const trained = user?.trained || []

  return (
    <div className="page">
      <div className="wrap page-head">
        <span className="eyebrow">{t('account.title')}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)' }}>{t('account.welcome')}, {user.name}.</h1>
        <div className="row mt-2">
          <span className="badge"><User size={12} /> {user.username}</span>
          <span className="badge">{t(`apply.types.${user.memberType}.t`) || user.memberType}</span>
          {user.org && <span className="badge">{user.org}</span>}
          {user.role === 'admin' && <span className="badge badge--coral">{t('admin.users.roleAdmin')}</span>}
        </div>
      </div>

      <div className="wrap" style={{ paddingBlock: 28 }}>
        <div className="tabs" style={{ marginBottom: 24 }}>
          {['reservations', 'profile', 'security'].map((k) => (
            <button key={k} type="button" className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
              {t(`account.tabs.${k}`)}
            </button>
          ))}
        </div>

        {tab === 'reservations' && (
          rows === null ? <Spinner label={t('common.loading')} /> : (
            <>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 12 }}>{t('account.upcoming')}</h2>
              {upcoming.length === 0 ? (
                <Empty icon={<Calendar size={38} />} title={t('account.noUpcoming')} hint={t('account.noUpcomingHint')}>
                  <Link to="/tools" className="btn btn--primary">{t('account.browse')}</Link>
                </Empty>
              ) : (
                <div className="panel"><div className="table-wrap"><table className="t">
                  <thead><tr>
                    <th>{t('booking.tool')}</th><th>{t('booking.when')}</th><th>{t('booking.status')}</th><th />
                  </tr></thead>
                  <tbody>{groupRows(upcoming).map((row) => <ReservationRow key={row.key} row={row} onCancel={cancel} canCancel />)}</tbody>
                </table></div></div>
              )}

              {past.length > 0 && (
                <>
                  <h2 style={{ fontSize: '1.15rem', margin: '32px 0 12px' }}>{t('account.past')}</h2>
                  <div className="panel"><div className="table-wrap"><table className="t">
                    <thead><tr>
                      <th>{t('booking.tool')}</th><th>{t('booking.when')}</th><th>{t('booking.status')}</th><th />
                    </tr></thead>
                    <tbody>{groupRows(past).slice(0, 30).map((row) => <ReservationRow key={row.key} row={row} onCancel={cancel} canCancel={false} />)}</tbody>
                  </table></div></div>
                </>
              )}
            </>
          )
        )}

        {tab === 'profile' && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', alignItems: 'start' }}>
            <div className="card">
              <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>{t('account.tabs.profile')}</h3>
              <dl className="kv">
                <dt>{t('admin.users.name')}</dt><dd>{user.name}</dd>
                <dt>{t('auth.username')}</dt><dd className="mono">{user.username}</dd>
                <dt>{t('admin.users.email')}</dt><dd>{user.email || '—'}</dd>
                <dt>{t('account.accountType')}</dt><dd>{t(`apply.types.${user.memberType}.t`) || user.memberType}</dd>
                {user.org && (<><dt>{t('admin.users.type')}</dt><dd>{user.org}</dd></>)}
                <dt>{t('account.memberSince')}</dt><dd>{formatDate(user.createdAt.slice(0, 10), dict)}</dd>
              </dl>
            </div>

            <div className="card">
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <Shield size={17} style={{ color: 'var(--teal)' }} />
                <h3 style={{ fontSize: '1.05rem' }}>{t('account.trainings')}</h3>
              </div>
              {trained.length === 0 ? (
                <p className="small muted">{t('account.noTrainings')}</p>
              ) : (
                <div className="row" style={{ gap: 8 }}>
                  {trained.map((id) => (
                    <span key={id} className="badge badge--ok"><Check size={12} /> {TOOL_BY_ID[id]?.name[lang] || id}</span>
                  ))}
                </div>
              )}
              <p className="tiny faint mt-3">{t('account.trainingsHint')}</p>
              <p className="tiny faint mt-2">
                {RESTRICTED.length} {t('admin.ind.restrictedTools').toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {tab === 'security' && <SecurityPanel />}
      </div>
    </div>
  )
}

function SecurityPanel() {
  const { t } = useI18n()
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors({}) }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.currentPassword) errs.currentPassword = t('apply.errRequired')
    if (form.newPassword.length < 10) errs.newPassword = t('auth.pwTooShort')
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = t('auth.pwMismatch')
    if (Object.keys(errs).length) return setErrors(errs)

    setBusy(true)
    try {
      await api.post('/auth/set-password', { currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast(t('auth.pwChanged'))
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      if (err.code === 'bad_credentials') setErrors({ currentPassword: t('auth.badCredentials') })
      else if (err.code === 'pw_same') setErrors({ newPassword: t('auth.pwSame') })
      else if (err.code === 'pw_short') setErrors({ newPassword: t('auth.pwTooShort') })
      else setErrors({ _form: t('common.error') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 420 }} noValidate>
      <h3 style={{ fontSize: '1.05rem', marginBottom: 16 }}>{t('account.changePw')}</h3>
      <Field label={t('auth.currentPassword')} name="cur" required error={errors.currentPassword}>
        <Input name="cur" type="password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
      </Field>
      <Field label={t('auth.newPassword')} name="new" required error={errors.newPassword} hint="10+">
        <Input name="new" type="password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} autoComplete="new-password" />
      </Field>
      <Field label={t('auth.confirmPassword')} name="conf" required error={errors.confirmPassword}>
        <Input name="conf" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
      </Field>
      {errors._form && <div className="note note--danger" style={{ marginBottom: 14 }} role="alert">{errors._form}</div>}
      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? t('common.saving') : t('auth.setPw')}
      </button>
    </form>
  )
}
