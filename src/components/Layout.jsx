import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function Layout() {
  const { t } = useI18n()
  const { pathname, hash } = useLocation()

  // Restore top-of-page on navigation, but honour in-page anchors.
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) { el.scrollIntoView({ block: 'start' }); return }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a className="skip-link" href="#main">{t('nav.skip')}</a>
      <Header />
      <main id="main" style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
