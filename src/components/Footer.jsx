import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import Partners from './Partners.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr__grid">
          <div>
            <Logo link={false} />
            <p className="ftr__motto mt-3">{t('brand.motto')}</p>
            <p className="small muted mt-2" style={{ maxWidth: '32ch' }}>{t('footer.note')}</p>
          </div>

          <div>
            <h4>{t('footer.explore')}</h4>
            <ul>
              <li><Link to="/">{t('nav.home')}</Link></li>
              <li><Link to="/about">{t('nav.about')}</Link></li>
              <li><Link to="/tools">{t('nav.tools')}</Link></li>
            </ul>
          </div>

          <div>
            <h4>{t('footer.access')}</h4>
            <ul>
              <li><Link to="/apply">{t('nav.apply')}</Link></li>
              <li><Link to="/login">{t('nav.login')}</Link></li>
              <li><a href={`mailto:${t('about.contact.email')}`}>{t('about.contact.email')}</a></li>
            </ul>
          </div>

          <div>
            <h4>{t('footer.legal')}</h4>
            <ul>
              <li><Link to="/about#rules">{t('footer.terms')}</Link></li>
              <li><Link to="/about#privacy">{t('footer.privacy')}</Link></li>
              <li><Link to="/about#accessibility">{t('footer.accessibility')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="ftr__partners">
          <h4>{t('partners.title')}</h4>
          <Partners variant="footer" />
        </div>

        <div className="ftr__base">
          <span>© {year} {t('brand.full')}. {t('footer.rights')}</span>
          <span>{t('footer.founder')}</span>
        </div>
      </div>
    </footer>
  )
}
