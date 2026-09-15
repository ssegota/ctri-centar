import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Field, Input } from '../components/ui.jsx'
import { Lock } from '../components/Icons.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function Login() {
  const { t } = useI18n()
  const { user, ready, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to={user.mustChangePassword ? '/set-password' : '/account'} replace />

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError('') }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const u = await login(form.username.trim(), form.password)
      if (u.mustChangePassword) nav('/set-password', { replace: true })
      else nav(loc.state?.from || '/account', { replace: true })
    } catch (err) {
      // Only say "wrong password" when the server actually said so. A 404 or a
      // 500 here means the API is misrouted or down, and reporting that as bad
      // credentials sends people hunting for a password problem that isn't one.
      if (err.code === 'bad_credentials') setError(t('auth.badCredentials'))
      else if (err.code === 'inactive') setError(t('auth.inactive'))
      else if (err.code === 'locked') setError(t('auth.locked'))
      else if (err.code === 'network') setError(t('common.networkError'))
      else setError(t('auth.serverError', { status: err.status || '?' }))
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
            <h1 style={{ fontSize: '1.6rem' }}>{t('auth.loginTitle')}</h1>
            <p className="small muted">{t('auth.loginLead')}</p>
          </div>
        </div>

        <form onSubmit={submit} className="card" noValidate>
          <Field label={t('auth.username')} name="username" required>
            <Input name="username" value={form.username} onChange={set('username')} autoComplete="username" autoFocus autoCapitalize="none" spellCheck="false" />
          </Field>
          <Field label={t('auth.password')} name="password" required>
            <Input name="password" type="password" value={form.password} onChange={set('password')} autoComplete="current-password" />
          </Field>

          {error && <div className="note note--danger" style={{ marginBottom: 16 }} role="alert">{error}</div>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy || !form.username || !form.password}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p className="small muted center mt-3">
          {t('auth.noAccount')}{' '}
          <Link to="/apply" style={{ color: 'var(--teal)', fontWeight: 700 }}>{t('auth.applyLink')}</Link>
        </p>
      </div>
    </div>
  )
}
