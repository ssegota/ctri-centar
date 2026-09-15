import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="wrap section center">
      <div className="dot-rule" style={{ margin: '0 auto 24px' }} aria-hidden="true" />
      <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>404</h1>
      <h2 className="mt-2">{t('common.notFoundTitle')}</h2>
      <p className="lead mt-2" style={{ marginInline: 'auto' }}>{t('common.notFoundLead')}</p>
      <p className="mt-4"><Link to="/" className="btn btn--primary">{t('common.goHome')}</Link></p>
    </div>
  )
}
