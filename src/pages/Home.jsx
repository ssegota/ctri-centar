import { Link } from 'react-router-dom'
import { Mark } from '../components/Logo.jsx'
import Partners from '../components/Partners.jsx'
import { ArrowRight, Cap, User, Building } from '../components/Icons.jsx'
import { useI18n } from '../i18n/index.jsx'

const AUD_ICONS = [Cap, User, Building]

export default function Home() {
  const { t } = useI18n()

  return (
    <>
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="hero">
        <Mark className="hero__mark" />
        <div className="wrap hero__in">
          <div className="dot-rule" aria-hidden="true" />
          <h1 style={{ marginTop: 28 }}>
            {t('home.heroTitle').map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>
          <p className="hero__tag">{t('brand.tagline')}</p>
          <p className="hero__lead">{t('home.heroLead')}</p>
          <div className="hero__cta">
            <Link to="/apply" className="btn btn--primary btn--lg">
              {t('home.ctaApply')} <ArrowRight size={17} />
            </Link>
            <Link to="/tools" className="btn btn--ghost btn--lg">{t('home.ctaTools')}</Link>
          </div>
        </div>
      </section>

      {/* ---- What CTRL is -------------------------------------------- */}
      <section className="section">
        <div className="wrap">
          <span className="eyebrow">{t('home.whatEyebrow')}</span>
          <h2 className="mt-2" style={{ maxWidth: '16ch' }}>{t('home.whatTitle')}</h2>
          <p className="lead mt-3">{t('home.whatLead')}</p>

          <div className="grid pillars mt-4">
            {t('home.pillars').map((p) => (
              <article key={p.n} className="pillar">
                <span className="pillar__n">{p.n.toUpperCase()}</span>
                <h3>{p.t}</h3>
                <p>{p.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Numbers -------------------------------------------------- */}
      <section className="section section--alt">
        <div className="wrap">
          <span className="eyebrow">{t('home.statsEyebrow')}</span>
          <div className="stats mt-3">
            {t('home.stats').map((s) => (
              <div className="stat" key={s.l}>
                <div className="stat__v">{s.v}</div>
                <div className="stat__l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Who it is for -------------------------------------------- */}
      <section className="section">
        <div className="wrap">
          <span className="eyebrow">{t('home.audienceEyebrow')}</span>
          <h2 className="mt-2">{t('home.audienceTitle')}</h2>
          <p className="lead mt-3">{t('home.audienceLead')}</p>

          <div className="grid audience mt-4">
            {t('home.audience').map((a, i) => {
              const Icon = AUD_ICONS[i]
              return (
                <article className="aud" key={a.t}>
                  <span className="aud__ic"><Icon size={21} /></span>
                  <h3>{a.t}</h3>
                  <p className="small muted mt-1">{a.d}</p>
                  <ul>{a.pts.map((p) => <li key={p}>{p}</li>)}</ul>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- Zones ---------------------------------------------------- */}
      <section className="section section--alt">
        <div className="wrap">
          <span className="eyebrow">{t('home.zonesEyebrow')}</span>
          <h2 className="mt-2">{t('home.zonesTitle')}</h2>
          <p className="lead mt-3">{t('home.zonesLead')}</p>

          <div className="grid zones mt-4">
            {t('home.zones').map((z) => (
              <article className="zone" key={z.c}>
                <div className="zone__hd">
                  <h3>{z.t}</h3>
                  <span className="zone__c">{z.c}</span>
                </div>
                <p>{z.d}</p>
              </article>
            ))}
          </div>

          <p className="mt-4">
            <Link to="/tools" className="btn btn--ghost">
              {t('home.ctaTools')} <ArrowRight size={16} />
            </Link>
          </p>
        </div>
      </section>

      {/* ---- How it works --------------------------------------------- */}
      <section className="section">
        <div className="wrap">
          <span className="eyebrow">{t('home.stepsEyebrow')}</span>
          <h2 className="mt-2">{t('home.stepsTitle')}</h2>
          <div className="steps mt-4">
            {t('home.steps').map((s) => (
              <div className="step" key={s.t}>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Partners ------------------------------------------------- */}
      <section className="partners-band">
        <div className="wrap">
          <div style={{ maxWidth: '46ch' }}>
            <span className="eyebrow">{t('partners.title')}</span>
            <p className="small muted mt-1">{t('partners.lead')}</p>
          </div>
          <Partners />
        </div>
      </section>

      {/* ---- Closing CTA ---------------------------------------------- */}
      <section className="section">
        <div className="wrap">
          <div className="cta-band">
            <Mark className="cta-band__mark" />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="dot-rule" aria-hidden="true" />
              <h2 className="mt-3">{t('home.ctaTitle')}</h2>
              <p>{t('home.ctaLead')}</p>
              <div className="row mt-4">
                <Link to="/apply" className="btn btn--primary btn--lg">
                  {t('home.ctaBtn')} <ArrowRight size={17} />
                </Link>
                <Link to="/tools" className="btn btn--ghost btn--lg" style={{ borderColor: 'rgba(255,255,255,.34)', color: '#fff' }}>
                  {t('home.ctaSecondary')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
