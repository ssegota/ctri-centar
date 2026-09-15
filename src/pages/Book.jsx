import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar, Shield, Check, Search, X } from '../components/Icons.jsx'
import { Spinner, useToast } from '../components/ui.jsx'
import { useI18n, plural } from '../i18n/index.jsx'
import { useAuth } from '../lib/auth.jsx'
import { api } from '../lib/api.js'
import { BOOKABLE, CATEGORY_ORDER, TOOL_BY_ID, maxHoursFor, searchTools, sortTools } from '../lib/tools.js'
import { HOURS, addDays, fmtHour, formatDate, isOpenDay, isoDate, isPastSlot, startOfWeek, CLOSE_HOUR } from '../lib/schedule.js'

const MAX_TOOLS = 12

/** Checkbox list of every bookable item, grouped by category and searchable. */
function ToolPicker({ selected, toggle, clear }) {
  const { t, lang } = useI18n()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const matched = searchTools(BOOKABLE, query)
    const byCat = {}
    for (const x of sortTools(matched)) (byCat[x.cat] ||= []).push(x)
    return CATEGORY_ORDER.filter((c) => byCat[c]).map((c) => [c, byCat[c]])
  }, [query])

  return (
    <div className="panel picker">
      <div className="panel__head">
        <div className="spread">
          <strong>{t('booking.pickTools')}</strong>
          {selected.length > 0 && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={clear}>{t('booking.clearAll')}</button>
          )}
        </div>
        <div className="searchbar picker__search">
          <Search size={16} />
          <label htmlFor="picker-search" className="sr-only">{t('booking.searchTools')}</label>
          <input
            id="picker-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('booking.searchTools')}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="picker__list">
        {groups.length === 0 && <p className="small muted" style={{ padding: 16 }}>{t('tools.noResults')}</p>}
        {groups.map(([cat, list]) => (
          <div key={cat} className="picker__grp">
            <h4>{t(`tools.cats.${cat}`)}</h4>
            {list.map((x) => {
              const on = selected.includes(x.id)
              const atLimit = !on && selected.length >= MAX_TOOLS
              return (
                <label key={x.id} className={`picker__row${on ? ' is-on' : ''}${atLimit ? ' is-disabled' : ''}`}>
                  <input type="checkbox" checked={on} disabled={atLimit} onChange={() => toggle(x.id)} />
                  <span className="picker__name">
                    {x.name[lang]}
                    {x.restricted && <Shield size={12} style={{ color: 'var(--warn)', flex: 'none' }} />}
                  </span>
                  {x.qty > 1 && <span className="picker__qty">{x.qty}×</span>}
                </label>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Book() {
  const { t, lang, dict } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  // Accept ?tools=a,b,c and the older ?tool=a so existing links keep working.
  const initial = useMemo(() => {
    const raw = params.get('tools') || params.get('tool') || ''
    const ids = raw.split(',').map((x) => x.trim()).filter((x) => TOOL_BY_ID[x]?.bookable)
    return [...new Set(ids)].slice(0, MAX_TOOLS)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [selected, setSelected] = useState(initial)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sel, setSel] = useState(null)
  const [hours, setHours] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const from = isoDate(weekStart)
  const todayIso = isoDate(new Date())
  const tools = useMemo(() => selected.map((id) => TOOL_BY_ID[id]).filter(Boolean), [selected])
  const maxHours = useMemo(() => (tools.length ? Math.min(...tools.map(maxHoursFor)) : 4), [tools])

  // Keep the URL shareable.
  useEffect(() => {
    const next = new URLSearchParams()
    if (selected.length) next.set('tools', selected.join(','))
    setParams(next, { replace: true })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (selected.length === 0) { setData(null); return }
    setLoading(true)
    try {
      setData(await api.get(`/availability?toolIds=${encodeURIComponent(selected.join(','))}&from=${from}&days=7`))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selected, from])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSel(null); setHours(1) }, [selected])

  const toggle = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_TOOLS ? cur : [...cur, id]))

  /** Units free across every selected tool — the group can only fit in the tightest one. */
  const freeAt = useCallback(
    (date, hour) => {
      if (!data || selected.length === 0) return 0
      let min = Infinity
      for (const id of selected) {
        const cell = data.availability?.[id]?.[date]?.[hour]
        if (!cell) return 0
        min = Math.min(min, cell.free)
      }
      return min === Infinity ? 0 : min
    },
    [data, selected],
  )

  const mineAt = useCallback(
    (date, hour) => (data?.mine || []).filter((r) => r.date === date && hour >= r.hour && hour < r.hour + r.hours),
    [data],
  )

  const maxFromSel = useMemo(() => {
    if (!sel || !data) return 1
    let n = 0
    for (let h = sel.hour; h < CLOSE_HOUR && n < maxHours; h++) {
      if (freeAt(sel.date, h) < 1 || mineAt(sel.date, h).length) break
      n++
    }
    return Math.max(1, n)
  }, [sel, data, maxHours, freeAt, mineAt])

  useEffect(() => { setHours((h) => Math.min(h, maxFromSel)) }, [maxFromSel])

  // Which of the selected tools would need the manager to approve.
  const split = useMemo(() => {
    const trained = user?.trained || []
    return {
      confirm: tools.filter((x) => !x.restricted || trained.includes(x.id)),
      pend: tools.filter((x) => x.restricted && !trained.includes(x.id)),
    }
  }, [tools, user])

  async function confirm() {
    if (!sel || selected.length === 0) return
    setBusy(true)
    try {
      const res = await api.post('/reservations', { toolIds: selected, date: sel.date, hour: sel.hour, hours, note })
      const anyPending = res.reservations.some((r) => r.status === 'pending')
      toast(
        selected.length === 1
          ? anyPending ? t('booking.successPending') : t('booking.successConfirmed')
          : anyPending ? t('booking.successMixed') : t('booking.successMulti'),
      )
      setSel(null); setNote(''); setHours(1)
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
    if (mine.length) {
      const pending = mine.some((r) => r.status === 'pending')
      return { cls: pending ? 'slot--mine-pending' : 'slot--mine', label: pending ? '⏳' : '✓', disabled: true }
    }
    if (isPastSlot(dateIso, hour)) return { cls: 'slot--past', label: '', disabled: true }
    const free = freeAt(dateIso, hour)
    if (free <= 0) return { cls: 'slot--full', label: '', disabled: true }
    if (sel && sel.date === dateIso && hour >= sel.hour && hour < sel.hour + hours) {
      return { cls: 'slot--sel', label: fmtHour(hour), disabled: false }
    }
    const showCount = tools.some((x) => x.qty > 1)
    return { cls: free === 1 && showCount ? 'slot--tight' : 'slot--free', label: showCount ? String(free) : '', disabled: false }
  }

  const n = selected.length

  return (
    <div className="page">
      <div className="wrap page-head">
        <span className="eyebrow">{t('nav.book')}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)' }}>{t('booking.title')}</h1>
        <p className="lead mt-2">{t('booking.groupNote')}</p>
      </div>

      <div className="wrap" style={{ paddingBlock: 28 }}>
        <div className="book-layout">
          <ToolPicker selected={selected} toggle={toggle} clear={() => setSelected([])} />

          <div>
            <div className="spread" style={{ marginBottom: 18 }}>
              <div className="row" style={{ gap: 8 }}>
                {n === 0 ? (
                  <span className="small muted">{t('booking.selectedNone')}</span>
                ) : (
                  <span className="badge badge--teal">
                    {n} {plural(n, lang, t('booking.itemsOne'), t('booking.itemsFew'), t('booking.itemsMany'))} {t('booking.selectedCount')}
                  </span>
                )}
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

            {n > 0 && (
              <div className="row" style={{ gap: 8, marginBottom: 16 }}>
                {tools.map((x) => (
                  <span key={x.id} className="chip">
                    {x.name[lang]}
                    <button type="button" onClick={() => toggle(x.id)} aria-label={`${t('booking.clearAll')} — ${x.name[lang]}`}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {split.pend.length > 0 && (
              <div className="note note--warn" style={{ marginBottom: 16 }}>
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <Shield size={16} />
                  <span>{t('tools.restrictedNote')} — {split.pend.map((x) => x.name[lang]).join(', ')}</span>
                </div>
              </div>
            )}

            {n === 0 ? (
              <div className="empty"><Calendar size={38} /><p className="mt-2">{t('booking.pickAtLeastOne')}</p></div>
            ) : loading && !data ? (
              <div style={{ padding: 60 }}><Spinner label={t('common.loading')} /></div>
            ) : (
              <>
                <div className="tt-scroll">
                  <div className="tt" style={{ gridTemplateColumns: '62px repeat(7, minmax(72px, 1fr))' }} role="grid" aria-label={t('booking.title')}>
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
                          return (
                            <div key={iso + hour} className="tt__cell" role="gridcell">
                              <button
                                type="button"
                                className={`slot ${st.cls}`}
                                disabled={st.disabled}
                                onClick={() => { setSel((c) => (c && c.date === iso && c.hour === hour ? null : { date: iso, hour })); setHours(1) }}
                                aria-label={`${formatDate(iso, dict)} ${fmtHour(hour)}${st.disabled ? '' : ` — ${freeAt(iso, hour)}`}`}
                                title={st.disabled ? undefined : `${formatDate(iso, dict)} ${fmtHour(hour)} — ${freeAt(iso, hour)} ${t('booking.available')}`}
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

                <div className="tt-legend mt-3">
                  <span><i style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }} />{t('booking.legendFree')}</span>
                  <span><i style={{ background: 'var(--warn-soft)' }} />{t('booking.legendTight')}</span>
                  <span><i style={{ background: 'var(--border)' }} />{t('booking.legendFull')}</span>
                  <span><i style={{ background: 'var(--teal-bright)' }} />{t('booking.legendMine')}</span>
                  <span><i style={{ background: 'var(--warn-soft)', boxShadow: 'inset 0 0 0 1.5px var(--warn)' }} />{t('booking.legendPending')}</span>
                  <span><i style={{ background: 'var(--bg-alt)' }} />{t('booking.legendClosed')}</span>
                </div>
                {n > 1 && <p className="tiny faint mt-2">{t('booking.combinedNote')}</p>}
              </>
            )}

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
                    <div style={{ flex: '1 1 280px' }}>
                      <p className="small muted">
                        {formatDate(sel.date, dict)} · {fmtHour(sel.hour)} – {fmtHour(sel.hour + hours)}
                      </p>

                      <ul className="booking-list mt-2">
                        {split.confirm.map((x) => (
                          <li key={x.id}><Check size={14} style={{ color: 'var(--ok)' }} /> {x.name[lang]} <em>{t('booking.willConfirm')}</em></li>
                        ))}
                        {split.pend.map((x) => (
                          <li key={x.id}><Shield size={14} style={{ color: 'var(--warn)' }} /> {x.name[lang]} <em>{t('booking.willPend')}</em></li>
                        ))}
                      </ul>

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
                        <textarea id="resnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('booking.notePlaceholder')} rows={3} maxLength={600} style={{ minHeight: 76 }} />
                      </div>
                    </div>

                    <div style={{ flex: '0 0 auto', minWidth: 210 }}>
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

            {n === 1 && (
              <p className="small muted mt-4">
                <Link to={`/tools/${selected[0]}`} style={{ color: 'var(--teal)', fontWeight: 700 }}>
                  {TOOL_BY_ID[selected[0]].name[lang]} — {t('tools.details')}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
