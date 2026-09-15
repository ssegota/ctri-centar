import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Copy, Check } from './Icons.jsx'
import { useAuth } from '../lib/auth.jsx'
import { useI18n } from '../i18n/index.jsx'

/* ---------- Toast ------------------------------------------------------- */
const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const push = useCallback((message, kind = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, kind, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toast && (
        <div className={`toast${toast.kind === 'err' ? ' toast--err' : ''}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/* ---------- Form field -------------------------------------------------- */
export function Field({ label, name, error, hint, required, children, span }) {
  return (
    <div className={`field${span ? ' span-2' : ''}`}>
      <label htmlFor={name}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__err" role="alert">{error}</span>}
    </div>
  )
}

export function Input({ name, error, ...props }) {
  return <input id={name} name={name} aria-invalid={!!error} {...props} />
}

export function Textarea({ name, error, ...props }) {
  return <textarea id={name} name={name} aria-invalid={!!error} {...props} />
}

export function Select({ name, error, children, ...props }) {
  return <select id={name} name={name} aria-invalid={!!error} {...props}>{children}</select>
}

/* ---------- Misc -------------------------------------------------------- */
export function Spinner({ label }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span className="spinner" /> {label && <span className="muted small">{label}</span>}
    </div>
  )
}

export function LoadingPage() {
  const { t } = useI18n()
  return <div className="loading-page"><Spinner label={t('common.loading')} /></div>
}

export function Empty({ icon, title, hint, children }) {
  return (
    <div className="empty">
      {icon}
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      {hint && <p className="small">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function CopyBox({ value, label, multiline = false }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard API is unavailable over plain http on some browsers — fall back.
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setDone(true)
    setTimeout(() => setDone(false), 1800)
  }

  return (
    <div>
      {label && <div className="tiny faint" style={{ marginBottom: 4, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</div>}
      <div className={`copybox${multiline ? ' copybox--pre' : ''}`}>
        <code>{value}</code>
        <button type="button" className="btn btn--sm btn--ghost" onClick={copy}>
          {done ? <Check size={14} /> : <Copy size={14} />}
          {done ? t('admin.apps.copied') : t('admin.apps.copy')}
        </button>
      </div>
    </div>
  )
}

/* ---------- Route guards ------------------------------------------------ */
export function RequireAuth({ admin = false, children }) {
  const { user, ready, mustChangePassword } = useAuth()
  const loc = useLocation()

  if (!ready) return <LoadingPage />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />
  // A temporary password unlocks nothing but the password form.
  if (mustChangePassword && loc.pathname !== '/set-password') return <Navigate to="/set-password" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/account" replace />
  return children
}
