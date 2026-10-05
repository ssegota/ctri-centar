import { Mark } from '../components/Logo.jsx'
import { useI18n } from '../i18n/index.jsx'
import { LEADS, TEAM, fullName, initials } from '../data/team.js'

function Person({ p, lead = false }) {
  const { t } = useI18n()
  return (
    <article className={`person${lead ? ' person--lead' : ''}`}>
      <div className="person__photo">
        {p.photo ? (
          <img src={p.photo} alt={p.name} width="480" height="480" loading="lazy" />
        ) : (
          <span className="person__initials" aria-hidden="true">{initials(p.name)}</span>
        )}
      </div>
      <div className="person__body">
        {p.role && <span className="eyebrow">{t(`team.roles.${p.role}`)}</span>}
        <h3 aria-label={fullName(p)}>
          {p.pre && <span className="person__ttl">{p.pre} </span>}
          {p.name}
          {p.post && <span className="person__ttl">, {p.post}</span>}
        </h3>
      </div>
    </article>
  )
}

export default function Team() {
  const { t } = useI18n()
  return (
    <>
      <section className="hero">
        <Mark className="hero__mark" />
        <div className="wrap hero__in" style={{ paddingBlock: 'clamp(56px,8vw,92px)' }}>
          <div className="dot-rule" aria-hidden="true" />
          <h1 className="mt-3" style={{ fontSize: 'clamp(2rem,5vw,3.4rem)' }}>{t('team.title')}</h1>
          <p className="hero__lead">{t('team.lead')}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <span className="eyebrow">{t('team.leadsTitle')}</span>
          <div className="team-grid team-grid--leads mt-3">
            {LEADS.map((p) => <Person key={p.id} p={p} lead />)}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="wrap">
          <span className="eyebrow">{t('team.teamTitle')}</span>
          <h2 className="mt-2">{t('team.teamHeading')}</h2>
          <div className="team-grid mt-4">
            {TEAM.map((p) => <Person key={p.id} p={p} />)}
          </div>
        </div>
      </section>
    </>
  )
}
