import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar, Shield, Check } from '../components/Icons.jsx'
import { Spinner, useToast } from '../components/ui.jsx'
import { useI18n, plural } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'
import { api } from '../lib/api.js'
import { BOOKABLE, CATEGORY_ORDER, TOOL_BY_ID, maxHoursFor, sortTools } from '../lib/tools.js'
import {
  HOURS, addDays, fmtHour, formatDate, isOpenDay, isoDate, isPastSlot, startOfWeek, CLOSE_HOUR,
} from '../lib/schedule.js'

export default function Book() {
  const { t, lang, dict } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const requested = params.get('tool')
  const firstTool = useMemo(() => sortTools(BOOKABLE)[0]?.id, [])
  const toolId = TOOL_BY_ID[requested]?.bookable ? requested : firstTool
  const tool = TOOL_BY_ID[toolId]

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null) // { date, hour }
  const [hours, setHours] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const from = isoDate(weekStart)
  const todayIso = isoDate(new Date())
  const trained = (user?.trained || []).includes(toolId)
  const needsApproval = !!tool?.restricted && !trained
  const maxHours = maxHoursFor(tool)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/availability?toolId=${encodeURIComponent(toolId)}&from=${from}&days=7`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [toolId, from])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSel(null); setHours(1) }, [toolId])

  const groups = useMemo(() => {
    const byCat = {}
    for (const x of sortTools(BOOKABLE)) (byCat[x.cat] ||= []).push(x)
    return CATEGORY_ORDER.filter((c) => byCat[c]).map((c) => [c, byCat[c]])
  }, [])

  const mineAt = useCallback(
    (date, hour) =>
      (data?.mine || []).find((r) => r.date === date && hour >= r.hour && hour < r.hour + r.hours),
    [data],
  )

  /** How many consecutive hours are still free from the selected start. */
  const maxFromSel = useMemo(() => {
    if (!sel || !data) return 1
    let n = 0
    for (let h = sel.hour; h < CLOSE_HOUR && n < maxHours; h++) {
      const cell = data.availability?.[sel.date]?.[h]
      if (!cell || cell.free < 1 || mineAt(sel.date, h)) break
      n++
    }
    return Math.max(1, n)
  }, [sel, data, maxHours, mineAt])

  useEffect(() => { setHours((h) => Math.min(h, maxFromSel)) }, [maxFromSel])

  function pick(date, hour) {
    setSel((cur) => (cur && cur.date === date && cur.hour === hour ? null : { date, hour }))
    setHours(1)
  }

  async function confirm() {
    if (!sel) return
    setBusy(true)
    try {
      const res = await api.post('/reservations', { toolId, date: sel.date, hour: sel.hour, hours, note })
      toast(res.reservation.status === 'pending' ? t('booking.successPending') : t('booking.successConfirmed'))
      setSel(null)
      setNote('')
      setHours(1)
      await load()
    } catch (err) {
      const map = {
        full: t('booking.conflict'), past: t('booking.pastSlot'),
        closed: t('booking.closedSlot'), too_long: t('booking.tooLong', { n: maxHours }),
      }
      toast(map[err.code] || t('common.error'), 'err')
      await load()
    } finally {
      setBusy(false)
    }
  }

  function cellState(dateIso, hour) {
    if (!isOpenDay(dateIso)) return { cls: 'slot--closed', label: '', disabled: true }
    const mine = mineAt(dateIso, hour)
    if (mine) {
      return {
        cls: mine.status === 'pending' ? 'slot--mine-pending' : 'slot--mine',
        label: mine.status === 'pending' ? '⏳' : '✓',
        disabled: true,
      }
    }
    if (isPastSlot(dateIso, hour)) return { cls: 'slot--past', label: '', disabled: true }
    const cell = data?.availability?.[dateIso]?.[hour]
    if (!cell) return { cls: '', label: '', disabled: true }
    if (cell.free <= 0) return { cls: 'slot--full', label: '', disabled: true }
    if (sel && sel.date === dateIso && hour >= sel.hour && hour < sel.hour + hours) {
      return { cls: 'slot--sel', label: fmtHour(hour), disabled: false }
    }
    if (cell.total > 1) {
      return { cls: cell.free === 1 ? 'slot--tight' : 'slot--free', label: cell.total > 1 ? String(cell.free) : '', disabled: false }
    }
    return { cls: 'slot--free', label: '', disabled: false }
  }

  return (
    <div className="page">
      <div className="wrap page-head">
        <span className="eyebrow">{t('nav.book')}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)' }}>{t('booking.title')}</h1>
      </div>

      <div className="wrap" style={{ paddingBlock: 28 }}>
        {/* ---- tool picker ---- */}
        <div className="spread" style={{ marginBottom: 22 }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 300, flex: '1 1 300px', maxWidth: 480 }}>
            <label htmlFor="tool-picker">{t('booking.pickTool')}</label>
            <select
              id="tool-picker"
              value={toolId}
              onChange={(e) => setParams({ tool: e.target.value }, { replace: true })}
            >
              {groups.map(([cat, list]) => (
                <optgroup key={cat} label={t(`tools.cats.${cat}`)}>
                  {list.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name[lang]}{x.qty > 1 ? ` (${x.qty}×)` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              {t('booking.today')}
            </button>
            <button type="button" className="btn btn--icon" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label={t('booking.prev')}>
              <ChevronLeft size={17} />
            </button>
            <strong className="small" style={{ minWidth: 190, textAlign: 'center' }}>
              {formatDate(isoDate(days[0]), dict)} – {formatDate(isoDate(days[6]), dict)}
            </strong>
            <button type="button" className="btn btn--icon" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label={t('booking.next')}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        {tool?.restricted && (
          <div className={`note ${trained ? 'note--ok' : 'note--warn'}`} style={{ marginBottom: 18 }}>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              {trained ? <Check size={16} /> : <Shield size={16} />}
              <span>{trained ? t('tools.trainedNote') : t('tools.restrictedNote')}</span>
            </div>
          </div>
        )}

        {/* ---- timetable ---- */}
        {loading && !data ? (
          <div style={{ padding: 60 }}><Spinner label={t('common.loading')} /></div>
        ) : (
          <div className="tt-scroll">
            <div className="tt" style={{ gridTemplateColumns: '62px repeat(7, minmax(78px, 1fr))' }} role="grid" aria-label={t('booking.title')}>
              <div className="tt__hcell tt__corner" />
              {days.map((d) => {
                const iso = isoDate(d)
                return (
                  <div key={iso} className={`tt__hcell${iso === todayIso ? ' is-today' : ''}`} role="columnheader">
                    {dict.days[(d.getDay() + 6) % 7]}
                    <small>{d.getDate()}.{d.getMonth() + 1}.</small>
                  </div>
                )
              })}

              {HOURS.map((hour) => (
                <div key={hour} style={{ display: 'contents' }}>
                  <div className="tt__tcell" role="rowheader">{fmtHour(hour)}</div>
                  {days.map((d) => {
                    const iso = isoDate(d)
                    const st = cellState(iso, hour)
                    const cell = data?.availability?.[iso]?.[hour]
                    return (
                      <div key={iso + hour} className="tt__cell" role="gridcell">
                        <button
                          type="button"
                          className={`slot ${st.cls}`}
                          disabled={st.disabled}
                          onClick={() => pick(iso, hour)}
                          title={
                            st.disabled
                              ? undefined
                              : `${tool.name[lang]} · ${formatDate(iso, dict)} ${fmtHour(hour)} — ${cell?.free ?? 0} ${t('booking.available')} ${t('booking.of')} ${cell?.total ?? 0}`
                          }
                          aria-label={`${formatDate(iso, dict)} ${fmtHour(hour)}${st.disabled ? '' : ` — ${cell?.free ?? 0}/${cell?.total ?? 0}`}`}
                        >
                          {st.label}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="tt-legend mt-3">
          <span><i style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }} />{t('booking.legendFree')}</span>
          <span><i style={{ background: 'var(--warn-soft)' }} />{t('booking.legendTight')}</span>
          <span><i style={{ background: 'var(--border)' }} />{t('booking.legendFull')}</span>
          <span><i style={{ background: 'var(--teal-bright)' }} />{t('booking.legendMine')}</span>
          <span><i style={{ background: 'var(--warn-soft)', boxShadow: 'inset 0 0 0 1.5px var(--warn)' }} />{t('booking.legendPending')}</span>
          <span><i style={{ background: 'var(--bg-alt)' }} />{t('booking.legendClosed')}</span>
        </div>

        {/* ---- confirmation panel ---- */}
        {sel && (
          <div className="panel mt-4">
            <div className="panel__head">
              <div className="row" style={{ gap: 8 }}>
                <Calendar size={17} style={{ color: 'var(--teal)' }} />
                <strong>{t('booking.selected')}</strong>
              </div>
            </div>
            <div className="panel__body">
              <div className="spread" style={{ alignItems: 'flex-start', gap: 24 }}>
                <div style={{ flex: '1 1 260px' }}>
                  <h3 style={{ fontSize: '1.05rem' }}>{tool.name[lang]}</h3>
                  <p className="small muted mt-1">
                    {formatDate(sel.date, dict)} · {fmtHour(sel.hour)} – {fmtHour(sel.hour + hours)}
                  </p>

                  <div className="field mt-3" style={{ maxWidth: 220 }}>
                    <label htmlFor="dur">{t('booking.duration')}</label>
                    <select id="dur" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                      {Array.from({ length: maxFromSel }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>
                          {h} {plural(h, lang, t('booking.hour'), t('booking.hoursFew'), t('booking.hours'))}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ maxWidth: 460 }}>
                    <label htmlFor="resnote">{t('booking.note')}</label>
                    <textarea
                      id="resnote"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t('booking.notePlaceholder')}
                      rows={3}
                      maxLength={600}
                      style={{ minHeight: 76 }}
                    />
                  </div>
                </div>

                <div style={{ flex: '0 0 auto', minWidth: 210 }}>
                  {needsApproval && <div className="note note--warn" style={{ marginBottom: 12 }}>{t('booking.needTraining')}</div>}
                  <button type="button" className="btn btn--primary btn--block" onClick={confirm} disabled={busy}>
                    {busy ? t('booking.confirming') : t('booking.confirm')}
                  </button>
                  <button type="button" className="btn btn--quiet btn--block mt-2" onClick={() => setSel(null)}>
                    {t('booking.clearSel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="small muted mt-4">
          <Link to={`/tools/${toolId}`} style={{ color: 'var(--teal)', fontWeight: 700 }}>{tool?.name[lang]} — {t('tools.details')}</Link>
        </p>
      </div>
    </div>
  )
}
