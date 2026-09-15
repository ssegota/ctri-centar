import { useMemo, useState, useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X, Wrench, ArrowRight } from '../components/Icons.jsx'
import { Empty } from '../components/ui.jsx'
import { useI18n, plural } from '../i18n/index.jsx'
import { TOOLS, CATEGORY_ORDER, searchTools, sortTools } from '../lib/tools.js'

function ToolCard({ tool }) {
  const { t, lang } = useI18n()
  return (
    <Link to={`/tools/${tool.id}`} className="tcard">
      <div className="tcard__top">
        <span className="tcard__cat">{t(`tools.cats.${tool.cat}`)}</span>
        {tool.qty > 1 && <span className="badge">{tool.qty} ×</span>}
      </div>
      <h3>{tool.name[lang]}</h3>
      <p>{tool.short[lang]}</p>
      <div className="tcard__foot">
        {tool.bookable
          ? <span className="badge badge--teal">{t('tools.bookable')}</span>
          : <span className="badge">{t('tools.noBooking')}</span>}
        {tool.restricted && <span className="badge badge--warn">{t('tools.restricted')}</span>}
      </div>
    </Link>
  )
}

export default function Tools() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') || ''
  const cat = params.get('cat') || ''
  const avail = params.get('avail') || ''
  const deferredQuery = useDeferredValue(query)

  const update = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // Counts shown next to each filter reflect the *other* active filters,
  // so the sidebar never offers a facet that would return nothing.
  const afterSearch = useMemo(() => searchTools(TOOLS, deferredQuery), [deferredQuery])
  const afterAvail = useMemo(
    () => afterSearch.filter((x) => (avail === 'bookable' ? x.bookable : avail === 'free' ? !x.bookable : true)),
    [afterSearch, avail],
  )
  const results = useMemo(
    () => sortTools(afterAvail.filter((x) => (cat ? x.cat === cat : true))),
    [afterAvail, cat],
  )

  const catCounts = useMemo(() => {
    const counts = {}
    for (const x of afterAvail) counts[x.cat] = (counts[x.cat] || 0) + 1
    return counts
  }, [afterAvail])

  const availCounts = useMemo(() => {
    const base = afterSearch.filter((x) => (cat ? x.cat === cat : true))
    return { all: base.length, bookable: base.filter((x) => x.bookable).length, free: base.filter((x) => !x.bookable).length }
  }, [afterSearch, cat])

  const hasFilters = !!(query || cat || avail)
  const n = results.length

  return (
    <div className="page">
      <div className="wrap page-head">
        <span className="eyebrow">{t('nav.tools')}</span>
        <h1 className="mt-2" style={{ fontSize: 'clamp(1.9rem,4.4vw,3rem)' }}>{t('tools.title')}</h1>
        <p className="lead mt-2">{t('tools.lead')}</p>
      </div>

      <div className="wrap" style={{ paddingBlock: 32 }}>
        <div className="searchbar" style={{ marginBottom: 28 }}>
          <Search size={19} />
          <label htmlFor="tool-search" className="sr-only">{t('tools.searchLabel')}</label>
          <input
            id="tool-search"
            type="search"
            value={query}
            onChange={(e) => update('q', e.target.value)}
            placeholder={t('tools.searchPlaceholder')}
            autoComplete="off"
          />
          {query && (
            <button type="button" className="btn btn--icon searchbar__clear" onClick={() => update('q', '')} aria-label={t('tools.clear')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="tool-layout">
          <aside className="filters">
            <div className="filters__grp">
              <h4>{t('tools.availability')}</h4>
              <div className="filters__chips">
                {[
                  { key: '', label: t('tools.all'), count: availCounts.all },
                  { key: 'bookable', label: t('tools.bookableOnly'), count: availCounts.bookable },
                  { key: 'free', label: t('tools.freeUse'), count: availCounts.free },
                ].map((o) => (
                  <button
                    key={o.key || 'all'}
                    type="button"
                    className={`fchip${avail === o.key ? ' is-on' : ''}`}
                    onClick={() => update('avail', o.key)}
                    aria-pressed={avail === o.key}
                  >
                    {o.label} <span>{o.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filters__grp">
              <h4>{t('tools.categories')}</h4>
              <div className="filters__chips">
                <button type="button" className={`fchip${!cat ? ' is-on' : ''}`} onClick={() => update('cat', '')} aria-pressed={!cat}>
                  {t('tools.all')} <span>{afterAvail.length}</span>
                </button>
                {CATEGORY_ORDER.filter((c) => catCounts[c]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`fchip${cat === c ? ' is-on' : ''}`}
                    onClick={() => update('cat', cat === c ? '' : c)}
                    aria-pressed={cat === c}
                  >
                    {t(`tools.cats.${c}`)} <span>{catCounts[c]}</span>
                  </button>
                ))}
              </div>
            </div>

            {hasFilters && (
              <div className="filters__grp">
                <button type="button" className="btn btn--ghost btn--sm btn--block" onClick={() => setParams({}, { replace: true })}>
                  {t('tools.resetFilters')}
                </button>
              </div>
            )}
          </aside>

          <div>
            <p className="small muted" style={{ marginBottom: 16 }} aria-live="polite">
              {n} {plural(n, lang, t('tools.resultsOne'), t('tools.resultsFew'), t('tools.results'))}
            </p>

            {n === 0 ? (
              <Empty icon={<Wrench size={40} />} title={t('tools.noResults')} hint={t('tools.noResultsHint')}>
                <button type="button" className="btn btn--ghost" onClick={() => setParams({}, { replace: true })}>
                  {t('tools.resetFilters')}
                </button>
              </Empty>
            ) : (
              <div className="tool-grid">
                {results.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
