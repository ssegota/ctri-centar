import catalogue from '../data/tools.json'

export const TOOLS = catalogue
export const TOOL_BY_ID = Object.fromEntries(catalogue.map((t) => [t.id, t]))
export const BOOKABLE = catalogue.filter((t) => t.bookable)
export const RESTRICTED = catalogue.filter((t) => t.restricted)

export const CATEGORY_ORDER = [
  'fabrication',
  'woodwork',
  'metalwork',
  'electronics',
  'measurement',
  'computing',
  'handtools',
  'workspace',
  'support',
  'safety',
]

/** Strip Croatian diacritics so "glodalica" matches "Glodalica" and "ScAnEr" matches "skener". */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Everything a tool can be matched on, in both languages, precomputed once. */
const HAYSTACK = new Map(
  catalogue.map((t) => [
    t.id,
    normalize(
      [
        t.name.hr, t.name.en,
        t.short.hr, t.short.en,
        t.desc.hr, t.desc.en,
        t.model || '', t.vendor || '', t.cat, t.id,
        ...(t.tags || []),
        ...(t.specs || []).flatMap((s) => [s.hr, s.en, s.v]),
      ].join(' '),
    ),
  ]),
)

/**
 * A term matches when some word in the haystack starts with it, so "pila"
 * finds "stolna pila" but not "ljepila", while "osciloskop" still finds
 * "osciloskopi". Every term must match (AND).
 */
function matchesTerm(hay, term) {
  return hay.startsWith(term) || hay.includes(` ${term}`)
}

export function searchTools(list, query) {
  const q = normalize(query)
  if (!q) return list
  const terms = q.split(' ').filter(Boolean)
  return list.filter((t) => {
    const hay = HAYSTACK.get(t.id) || ''
    return terms.every((term) => matchesTerm(hay, term))
  })
}

export function sortTools(list) {
  return [...list].sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.cat)
    const cb = CATEGORY_ORDER.indexOf(b.cat)
    if (ca !== cb) return ca - cb
    if (a.bookable !== b.bookable) return a.bookable ? -1 : 1
    return a.name.hr.localeCompare(b.name.hr, 'hr')
  })
}

export function maxHoursFor(tool) {
  return tool?.maxHours || 4
}
