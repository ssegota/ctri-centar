import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Field, Input, useToast } from '../components/ui.jsx'
import { Lock } from '../components/Icons.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'
import { api } from '../lib/api.js'

const MIN = 10

export default function SetPassword() {
  const { t } = useI18n()
  const { user, ready, refresh } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token')
  const nav = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  if (!ready) return null
  // Nothing to do here without either an invite link or a session.
  if (!token && !user) return <Navigate to="/login" replace />

  const forced = !!token || !!user?.mustChangePassword
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors({}) }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.newPassword.length < MIN) errs.newPassword = t('auth.pwTooShort')
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = t('auth.pwMismatch')
    if (!forced && !form.currentPassword) errs.currentPassword = t('apply.errRequired')
    if (Object.keys(errs).length) return setErrors(errs)

    setBusy(true)
    try {
      await api.post('/auth/set-password', {
        ...(token ? { token } : null),
        ...(forced ? null : { currentPassword: form.currentPassword }),
        newPassword: form.newPassword,
      })
      await refresh()
      toast(t('auth.pwChanged'))
      nav('/account', { replace: true })
    } catch (err) {
      if (err.code === 'bad_invite') setErrors({ _form: t('auth.invalidInvite') })
      else if (err.code === 'pw_same') setErrors({ newPassword: t('auth.pwSame') })
      else if (err.code === 'pw_short') setErrors({ newPassword: t('auth.pwTooShort') })
      else if (err.code === 'bad_credentials') setErrors({ currentPassword: t('auth.badCredentials') })
      else setErrors({ _form: t('common.error') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <span className="aud__ic" style={{ margin: 0, width: 36, height: 36 }}><Lock size={17} /></span>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>{t('auth.setPwTitle')}</h1>
            <p className="small muted">{token ? t('auth.setPwInviteLead') : t('auth.setPwLead')}</p>
          </div>
        </div>

        {user?.mustChangePassword && !token && (
          <div className="note note--warn" style={{ marginBottom: 16 }}>{t('auth.forcedNote')}</div>
        )}

        <form onSubmit={submit} className="card" noValidate>
          {!forced && (
            <Field label={t('auth.currentPassword')} name="currentPassword" required error={errors.currentPassword}>
              <Input name="currentPassword" type="password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
            </Field>
          )}
          <Field label={t('auth.newPassword')} name="newPassword" required error={errors.newPassword} hint={`${MIN}+`}>
            <Input name="newPassword" type="password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} autoComplete="new-password" autoFocus />
          </Field>
          <Field label={t('auth.confirmPassword')} name="confirmPassword" required error={errors.confirmPassword}>
            <Input name="confirmPassword" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />
          </Field>

          {errors._form && <div className="note note--danger" style={{ marginBottom: 16 }} role="alert">{errors._form}</div>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? t('common.saving') : t('auth.setPw')}
          </button>
        </form>
      </div>
    </div>
  )
}
