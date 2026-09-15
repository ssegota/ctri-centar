import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import hr from './hr.js'
import en from './en.js'

export const LOCALES = { hr, en }
const STORAGE_KEY = 'ctri.lang'
const I18nCtx = createContext(null)

/**
 * Croatian is the default for everyone. The browser's own language is
 * deliberately ignored — this is a Croatian county's centre, and an English
 * browser in Pula should still land on the Croatian site. English is an
 * explicit choice made with the header toggle, and it is remembered.
 */
function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALES[saved]) return saved
  } catch {}
  return 'hr'
}

/** Walk a dotted path through the active dictionary; fall back to Croatian, then the key itself. */
function resolve(dict, path) {
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), dict)
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(detect)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (path, vars) => {
      let v = resolve(LOCALES[lang], path)
      if (v === undefined) v = resolve(LOCALES.hr, path)
      if (v === undefined) return path
      if (typeof v === 'string' && vars) {
        return v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m))
      }
      return v
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, dict: LOCALES[lang], locale: LOCALES[lang].locale, toggle: () => setLang((l) => (l === 'hr' ? 'en' : 'hr')) }),
    [lang, t],
  )
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

/* ---- Croatian plural rules (1 / 2-4 / 5+), used for result counts ---- */
export function plural(n, lang, one, few, many) {
  if (lang !== 'hr') return n === 1 ? one : many
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
