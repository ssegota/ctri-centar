import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'
import { Sun, Moon, Menu, X, Logout } from './Icons.jsx'
import { useTheme } from '../lib/theme.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function Header() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const { user, isAdmin, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  useEffect(() => { setOpen(false) }, [loc.pathname])

  const links = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/tools', label: t('nav.tools') },
    { to: '/about', label: t('nav.about') },
    { to: '/team', label: t('nav.team') },
    ...(user ? [{ to: '/book', label: t('nav.book') }] : []),
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin') }] : []),
  ]

  async function onLogout() {
    await logout()
    nav('/')
  }

  return (
    <header className="hdr">
      <div className="wrap hdr__in">
        <Logo />

        <nav className="hdr__nav" aria-label={t('nav.menu')}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `hdr__link${isActive ? ' is-active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hdr__tools">
          <div className="seg hdr__lang" role="group" aria-label={t('nav.language')}>
            <button type="button" onClick={() => setLang('hr')} className={lang === 'hr' ? 'is-on' : ''} aria-pressed={lang === 'hr'}>HR</button>
            <button type="button" onClick={() => setLang('en')} className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'}>EN</button>
          </div>

          <button type="button" className="btn btn--icon" onClick={toggle} aria-label={t('nav.theme')} title={t('nav.theme')}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>

          {user ? (
            <>
              <Link to="/account" className="btn btn--ghost btn--sm hdr__only-lg">{t('nav.account')}</Link>
              <button type="button" className="btn btn--icon hdr__only-lg" onClick={onLogout} aria-label={t('nav.logout')} title={t('nav.logout')}>
                <Logout />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--sm hdr__only-lg">{t('nav.login')}</Link>
              <Link to="/apply" className="btn btn--primary btn--sm">{t('nav.apply')}</Link>
            </>
          )}

          <button
            type="button"
            className="btn btn--icon hdr__burger"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={t('nav.menu')}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="hdr__mobile">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
          ))}
          <div className="hdr__mobile-lang">
            <span className="tiny faint">{t('nav.language')}</span>
            <div className="seg" role="group" aria-label={t('nav.language')}>
              <button type="button" onClick={() => setLang('hr')} className={lang === 'hr' ? 'is-on' : ''} aria-pressed={lang === 'hr'}>HR</button>
              <button type="button" onClick={() => setLang('en')} className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'}>EN</button>
            </div>
          </div>
          {user ? (
            <>
              <NavLink to="/account">{t('nav.account')}</NavLink>
              <button type="button" onClick={onLogout}>{t('nav.logout')}</button>
            </>
          ) : (
            <>
              <NavLink to="/login">{t('nav.login')}</NavLink>
              <Link to="/apply" className="btn btn--primary btn--block" style={{ marginTop: 14 }}>{t('nav.apply')}</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
