import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Shield, Check } from '../components/Icons.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'
import { TOOL_BY_ID, maxHoursFor } from '../lib/tools.js'

export default function ToolDetail() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const tool = TOOL_BY_ID[id]

  if (!tool) return <Navigate to="/tools" replace />

  const trained = (user?.trained || []).includes(tool.id)

  return (
    <div className="page">
      <div className="wrap page-head">
        <Link to="/tools" className="btn btn--quiet btn--sm" style={{ marginLeft: -10, marginBottom: 12 }}>
          <ArrowLeft size={15} /> {t('tools.backToList')}
        </Link>
        <span className="eyebrow">{t(`tools.cats.${tool.cat}`)}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.7rem,4vw,2.7rem)' }}>{tool.name[lang]}</h1>
        <p className="lead mt-2">{tool.short[lang]}</p>
        <div className="row mt-3">
          {tool.bookable
            ? <span className="badge badge--teal">{t('tools.bookable')}</span>
            : <span className="badge">{t('tools.noBooking')}</span>}
          {tool.restricted && <span className="badge badge--warn"><Shield size={12} /> {t('tools.restricted')}</span>}
          <span className="badge">{tool.qty} × {t('tools.unit')}</span>
        </div>
      </div>

      <div className="wrap" style={{ paddingBlock: 36 }}>
        <div className="detail-layout">
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>{t('tools.about')}</h2>
            <p className="mt-2 muted" style={{ maxWidth: '70ch' }}>{tool.desc[lang]}</p>

            {tool.specs?.length > 0 && (
              <>
                <h2 className="mt-4" style={{ fontSize: '1.3rem' }}>{t('tools.specs')}</h2>
                <dl className="spec-list mt-3">
                  {tool.specs.map((s) => (
                    <div key={s.v} style={{ display: 'contents' }}>
                      <dt>{s[lang]}</dt>
                      <dd>{s.v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            <dl className="spec-list mt-4" style={{ paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <dt>{t('tools.category')}</dt>
              <dd>{t(`tools.cats.${tool.cat}`)}</dd>
              <dt>{t('tools.quantity')}</dt>
              <dd>{tool.qty}</dd>
              {tool.model && (<><dt>{t('tools.model')}</dt><dd>{tool.model}</dd></>)}
              {tool.vendor && (<><dt>{t('tools.vendor')}</dt><dd>{tool.vendor}</dd></>)}
              {tool.bookable && (
                <><dt>{t('tools.maxSession')}</dt><dd>{maxHoursFor(tool)} {t('tools.hoursShort')}</dd></>
              )}
            </dl>
          </div>

          <aside className="detail-side">
            <div className="panel">
              <div className="panel__head">
                <div className="row" style={{ gap: 8 }}>
                  <Calendar size={17} style={{ color: 'var(--teal)' }} />
                  <strong>{t('booking.title')}</strong>
                </div>
              </div>
              <div className="panel__body">
                {!tool.bookable ? (
                  <p className="small muted">{t('tools.noBookingNote')}</p>
                ) : !user ? (
                  <>
                    <div className="row small muted" style={{ gap: 8, marginBottom: 6 }}>
                      <Clock size={15} />
                      {t('tools.maxSession')}: <strong style={{ color: 'var(--fg)' }}>{maxHoursFor(tool)} {t('tools.hoursShort')}</strong>
                    </div>
                    {tool.restricted && (
                      <div className="note note--warn mt-2">{t('tools.restrictedNote')}</div>
                    )}
                    <Link to="/login" className="btn btn--primary btn--block mt-3">{t('tools.loginToBook')}</Link>
                    <Link to="/apply" className="btn btn--ghost btn--block mt-2">{t('tools.applyToBook')}</Link>
                  </>
                ) : (
                  <>
                    <div className="row small muted" style={{ gap: 8, marginBottom: 12 }}>
                      <Clock size={15} />
                      {t('tools.maxSession')}: <strong style={{ color: 'var(--fg)' }}>{maxHoursFor(tool)} {t('tools.hoursShort')}</strong>
                    </div>
                    {tool.restricted && (
                      <div className={`note ${trained ? 'note--ok' : 'note--warn'}`} style={{ marginBottom: 14 }}>
                        <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                          {trained ? <Check size={15} /> : <Shield size={15} />}
                          <span>{trained ? t('tools.trainedNote') : t('tools.restrictedNote')}</span>
                        </div>
                      </div>
                    )}
                    <Link to={`/book?tool=${tool.id}`} className="btn btn--primary btn--block">
                      {t('tools.bookThis')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
