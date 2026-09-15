import { Link } from 'react-router-dom'
import { Mark } from '../components/Logo.jsx'
import { Shield, ArrowRight } from '../components/Icons.jsx'
import { useI18n } from '../i18n/index.jsx'
import { TOOLS, BOOKABLE, RESTRICTED } from '../lib/tools.js'

export default function About() {
  const { t } = useI18n()
  const units = TOOLS.reduce((sum, x) => sum + x.qty, 0)

  return (
    <>
      <section className="hero">
        <Mark className="hero__mark" />
        <div className="wrap hero__in" style={{ paddingBlock: 'clamp(56px,8vw,92px) clamp(56px,8vw,92px)' }}>
          <div className="dot-rule" aria-hidden="true" />
          <h1 className="mt-3" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)' }}>{t('about.title')}</h1>
          <p className="hero__lead">{t('about.lead')}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 800 }}>
          <span className="eyebrow">{t('about.missionTitle')}</span>
          <div className="stack mt-3" style={{ gap: 18 }}>
            {t('about.mission').map((p, i) => (
              <p key={i} className={i === 0 ? 'lead' : 'muted'}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt" id="rules">
        <div className="wrap">
          <span className="eyebrow">{t('about.rulesTitle')}</span>
          <h2 className="mt-2">{t('about.rulesTitle')}</h2>
          <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            {t('about.rules').map((r) => (
              <article className="card" key={r.t}>
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  <Shield size={18} style={{ color: 'var(--teal)' }} />
                  <h3 style={{ fontSize: '1rem' }}>{r.t}</h3>
                </div>
                <p className="small muted">{r.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <span className="eyebrow">{t('about.equipTitle')}</span>
          <h2 className="mt-2">{t('about.equipTitle')}</h2>
          <p className="lead mt-3">{t('about.equipLead')}</p>

          <div className="stats mt-4">
            <div className="stat"><div className="stat__v">{TOOLS.length}</div><div className="stat__l">{t('tools.title')}</div></div>
            <div className="stat"><div className="stat__v">{units}</div><div className="stat__l">{t('tools.units')}</div></div>
            <div className="stat"><div className="stat__v">{BOOKABLE.length}</div><div className="stat__l">{t('tools.bookable')}</div></div>
            <div className="stat"><div className="stat__v">{RESTRICTED.length}</div><div className="stat__l">{t('tools.restricted')}</div></div>
          </div>

          <p className="mt-4">
            <Link to="/tools" className="btn btn--ghost">{t('tools.title')} <ArrowRight size={16} /></Link>
          </p>
        </div>
      </section>

      <section className="section" id="privacy">
        <div className="wrap">
          <span className="eyebrow">{t('about.privacyTitle')}</span>
          <h2 className="mt-2">{t('about.privacyTitle')}</h2>
          <p className="lead mt-3">{t('about.privacyLead')}</p>
          <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            {t('about.privacyBlocks').map((b) => (
              <article className="card" key={b.t}>
                <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>{b.t}</h3>
                <p className="small muted">{b.d}</p>
              </article>
            ))}
          </div>
          <div className="placeholder mt-3">
            <b>{t('common.placeholder')}</b>
            {t('about.privacyTodo')}
          </div>
        </div>
      </section>

      <section className="section section--alt" id="accessibility">
        <div className="wrap">
          <span className="eyebrow">{t('about.accessTitle')}</span>
          <h2 className="mt-2">{t('about.accessTitle')}</h2>
          <p className="lead mt-3">{t('about.accessLead')}</p>
          <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            {t('about.accessBlocks').map((b) => (
              <article className="card" key={b.t}>
                <h3 style={{ fontSize: '1rem', marginBottom: 10 }}>{b.t}</h3>
                <p className="small muted">{b.d}</p>
              </article>
            ))}
          </div>
          <div className="placeholder mt-3">
            <b>{t('common.placeholder')}</b>
            {t('about.accessTodo')}
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="wrap">
          <span className="eyebrow">{t('about.contactTitle')}</span>
          <h2 className="mt-2">{t('about.contactTitle')}</h2>
          <p className="lead mt-3">{t('about.contactLead')}</p>

          <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
            <div className="card card--pad-sm">
              <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('about.contact.addressLabel')}
              </div>
              <div style={{ fontWeight: 700 }}>{t('about.contact.address')}</div>
            </div>
            <div className="card card--pad-sm">
              <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('about.contact.hoursLabel')}
              </div>
              <div style={{ fontWeight: 700 }}>{t('about.contact.hours')}</div>
              <div className="small muted">{t('about.contact.hoursNote')}</div>
            </div>
            <div className="card card--pad-sm">
              <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('about.contact.emailLabel')}
              </div>
              <a href={`mailto:${t('about.contact.email')}`} style={{ fontWeight: 700, color: 'var(--teal)' }}>{t('about.contact.email')}</a>
            </div>
            <div className="placeholder">
              <b>{t('about.contact.phoneLabel')}</b>
              {t('about.contact.phone')}
            </div>
          </div>

          <p className="small faint mt-3">{t('about.placeholderNote')}</p>
        </div>
      </section>
    </>
  )
}
