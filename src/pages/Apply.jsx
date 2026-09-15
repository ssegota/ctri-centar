import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Field, Input, Textarea, Select } from '../components/ui.jsx'
import { Cap, User, Building, Check, ArrowRight } from '../components/Icons.jsx'
import { useI18n } from '../i18n/index.jsx'
import { api } from '../lib/api.js'

const TYPES = [
  { key: 'student', Icon: Cap },
  { key: 'individual', Icon: User },
  { key: 'company', Icon: Building },
]

const EMPTY = {
  firstName: '', lastName: '', email: '', phone: '', city: '', birthYear: '',
  institution: '', studyProgram: '', studyYear: '', studentId: '',
  occupation: '', experience: 'none',
  companyName: '', oib: '', companyRole: '', companySize: 'solo', website: '', teamSize: '',
  projectTitle: '', motivation: '', equipment: '', timeframe: 'months',
  gdpr: false, safety: false,
}

export default function Apply() {
  const { t } = useI18n()
  const [type, setType] = useState('student')
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function validate() {
    const e = {}
    const req = (k) => { if (!String(form[k] || '').trim()) e[k] = t('apply.errRequired') }
    req('firstName'); req('lastName')
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email)) e.email = t('apply.errEmail')
    if (form.motivation.trim().length < 10) e.motivation = t('apply.errRequired')
    if (type === 'student') req('institution')
    if (type === 'company') {
      req('companyName')
      if (form.oib && !/^\d{11}$/.test(form.oib.trim())) e.oib = t('apply.errOib')
    }
    if (!form.gdpr) e.gdpr = t('apply.errConsent')
    if (!form.safety) e.safety = t('apply.errConsent')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validate()) {
      document.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    setBusy(true)
    try {
      const res = await api.post('/applications', { type, data: form })
      setDone(res.ref)
      window.scrollTo(0, 0)
    } catch (err) {
      setErrors({ _form: err.code === 'network' ? t('common.networkError') : t('common.error') })
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="wrap section" style={{ maxWidth: 640 }}>
        <span className="badge badge--ok" style={{ padding: '6px 12px' }}><Check size={14} /> {t('apply.successTitle')}</span>
        <h1 className="mt-3" style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{t('apply.successTitle')}</h1>
        <p className="lead mt-3">{t('apply.successLead')}</p>
        <div className="card mt-4">
          <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t('apply.successRef')}</div>
          <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: 6 }}>{done}</div>
        </div>
        <p className="mt-4"><Link to="/" className="btn btn--ghost">{t('apply.successBack')}</Link></p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="wrap page-head">
        <span className="eyebrow">{t('nav.apply')}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)' }}>{t('apply.title')}</h1>
        <p className="lead mt-2">{t('apply.lead')}</p>
      </div>

      <div className="wrap" style={{ paddingBlock: 36, maxWidth: 820 }}>
        <form onSubmit={submit} noValidate>
          {/* ---- applicant type ---- */}
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 34px' }}>
            <legend className="eyebrow" style={{ marginBottom: 12 }}>{t('apply.typeTitle')}</legend>
            <div className="choice">
              {TYPES.map(({ key, Icon }) => (
                <label key={key}>
                  <input type="radio" name="applicantType" value={key} checked={type === key} onChange={() => setType(key)} />
                  <span className="choice__in">
                    <span className="choice__t"><Icon size={18} /> {t(`apply.types.${key}.t`)}</span>
                    <span className="choice__d">{t(`apply.types.${key}.d`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* ---- personal ---- */}
          <h2 style={{ fontSize: '1.15rem', marginBottom: 16 }}>{t('apply.sections.personal')}</h2>
          <div className="form-grid">
            <Field label={t('apply.f.firstName')} name="firstName" required error={errors.firstName}>
              <Input name="firstName" value={form.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="given-name" />
            </Field>
            <Field label={t('apply.f.lastName')} name="lastName" required error={errors.lastName}>
              <Input name="lastName" value={form.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="family-name" />
            </Field>
            <Field label={t('apply.f.email')} name="email" required error={errors.email}>
              <Input name="email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            </Field>
            <Field label={t('apply.f.phone')} name="phone" hint={t('common.optional')}>
              <Input name="phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
            </Field>
            <Field label={t('apply.f.city')} name="city" hint={t('common.optional')}>
              <Input name="city" value={form.city} onChange={set('city')} autoComplete="address-level2" />
            </Field>
            <Field label={t('apply.f.birthYear')} name="birthYear" hint={t('common.optional')}>
              <Input name="birthYear" type="number" min="1930" max="2020" value={form.birthYear} onChange={set('birthYear')} />
            </Field>
          </div>

          {/* ---- type-specific ---- */}
          {type === 'student' && (
            <>
              <h2 style={{ fontSize: '1.15rem', margin: '18px 0 16px' }}>{t('apply.sections.study')}</h2>
              <div className="form-grid">
                <Field label={t('apply.f.institution')} name="institution" required error={errors.institution} span>
                  <Input name="institution" value={form.institution} onChange={set('institution')} error={errors.institution} />
                </Field>
                <Field label={t('apply.f.studyProgram')} name="studyProgram" hint={t('common.optional')}>
                  <Input name="studyProgram" value={form.studyProgram} onChange={set('studyProgram')} />
                </Field>
                <Field label={t('apply.f.studyYear')} name="studyYear" hint={t('common.optional')}>
                  <Input name="studyYear" value={form.studyYear} onChange={set('studyYear')} />
                </Field>
                <Field label={t('apply.f.studentId')} name="studentId" hint={t('common.optional')}>
                  <Input name="studentId" value={form.studentId} onChange={set('studentId')} inputMode="numeric" />
                </Field>
              </div>
            </>
          )}

          {type === 'individual' && (
            <>
              <h2 style={{ fontSize: '1.15rem', margin: '18px 0 16px' }}>{t('apply.sections.personal')}</h2>
              <div className="form-grid">
                <Field label={t('apply.f.occupation')} name="occupation" hint={t('common.optional')}>
                  <Input name="occupation" value={form.occupation} onChange={set('occupation')} />
                </Field>
                <Field label={t('apply.f.experience')} name="experience" hint={t('apply.ph.experience')}>
                  <Select name="experience" value={form.experience} onChange={set('experience')}>
                    {['none', 'some', 'experienced', 'pro'].map((k) => (
                      <option key={k} value={k}>{t(`apply.exp.${k}`)}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </>
          )}

          {type === 'company' && (
            <>
              <h2 style={{ fontSize: '1.15rem', margin: '18px 0 16px' }}>{t('apply.sections.company')}</h2>
              <div className="form-grid">
                <Field label={t('apply.f.companyName')} name="companyName" required error={errors.companyName}>
                  <Input name="companyName" value={form.companyName} onChange={set('companyName')} error={errors.companyName} autoComplete="organization" />
                </Field>
                <Field label={t('apply.f.oib')} name="oib" error={errors.oib} hint={t('common.optional')}>
                  <Input name="oib" value={form.oib} onChange={set('oib')} error={errors.oib} inputMode="numeric" maxLength={11} />
                </Field>
                <Field label={t('apply.f.companyRole')} name="companyRole" hint={t('common.optional')}>
                  <Input name="companyRole" value={form.companyRole} onChange={set('companyRole')} autoComplete="organization-title" />
                </Field>
                <Field label={t('apply.f.companySize')} name="companySize">
                  <Select name="companySize" value={form.companySize} onChange={set('companySize')}>
                    {['solo', 'small', 'medium', 'large'].map((k) => (
                      <option key={k} value={k}>{t(`apply.sizes.${k}`)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('apply.f.website')} name="website" hint={t('common.optional')}>
                  <Input name="website" type="url" value={form.website} onChange={set('website')} placeholder="https://" />
                </Field>
                <Field label={t('apply.f.teamSize')} name="teamSize" hint={t('common.optional')}>
                  <Input name="teamSize" type="number" min="1" max="200" value={form.teamSize} onChange={set('teamSize')} />
                </Field>
              </div>
            </>
          )}

          {/* ---- project ---- */}
          <h2 style={{ fontSize: '1.15rem', margin: '18px 0 16px' }}>{t('apply.sections.project')}</h2>
          <div className="form-grid">
            <Field label={t('apply.f.projectTitle')} name="projectTitle" hint={t('apply.ph.projectTitle')}>
              <Input name="projectTitle" value={form.projectTitle} onChange={set('projectTitle')} />
            </Field>
            <Field label={t('apply.f.timeframe')} name="timeframe">
              <Select name="timeframe" value={form.timeframe} onChange={set('timeframe')}>
                {['weeks', 'months', 'year', 'ongoing'].map((k) => (
                  <option key={k} value={k}>{t(`apply.timeframes.${k}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('apply.f.motivation')} name="motivation" required error={errors.motivation} span>
              <Textarea name="motivation" value={form.motivation} onChange={set('motivation')} error={errors.motivation} placeholder={t('apply.ph.motivation')} rows={6} maxLength={4000} />
            </Field>
            <Field label={t('apply.f.equipment')} name="equipment" hint={t('apply.ph.equipment')} span>
              <Textarea name="equipment" value={form.equipment} onChange={set('equipment')} rows={3} maxLength={800} style={{ minHeight: 84 }} />
            </Field>
          </div>

          {/* ---- consent ---- */}
          <h2 style={{ fontSize: '1.15rem', margin: '18px 0 16px' }}>{t('apply.sections.consent')}</h2>
          <div className="stack" style={{ gap: 14 }}>
            <label className="check">
              <input type="checkbox" checked={form.gdpr} onChange={set('gdpr')} aria-invalid={!!errors.gdpr} />
              <span>{t('apply.f.gdpr')}{errors.gdpr && <span className="field__err" style={{ display: 'block' }}>{errors.gdpr}</span>}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.safety} onChange={set('safety')} aria-invalid={!!errors.safety} />
              <span>{t('apply.f.safety')}{errors.safety && <span className="field__err" style={{ display: 'block' }}>{errors.safety}</span>}</span>
            </label>
          </div>

          {errors._form && <div className="note note--danger mt-3" role="alert">{errors._form}</div>}

          <div className="row mt-4">
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
              {busy ? t('apply.submitting') : t('apply.submit')} {!busy && <ArrowRight size={17} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
