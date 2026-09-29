import { useI18n } from '../i18n/index.jsx'

/**
 * Partner institutions. Istria's lettering is black on the original artwork,
 * so dark mode swaps in a copy with white lettering; the university and
 * faculty marks read on both backgrounds as they are.
 */
const PARTNERS = [
  { key: 'istra', href: 'https://www.istra-istria.hr', light: '/brand/istra.png', dark: '/brand/istra-dark.png', w: 492, h: 312 },
  { key: 'unipu', href: 'https://www.unipu.hr', light: '/brand/unipu.png', w: 238, h: 240 },
  { key: 'fipu', href: 'https://fipu.unipu.hr', light: '/brand/fipu.png', w: 240, h: 240 },
]

export default function Partners({ variant = 'strip' }) {
  const { t } = useI18n()
  return (
    <ul className={`partners partners--${variant}`}>
      {PARTNERS.map((p) => (
        <li key={p.key}>
          <a href={p.href} target="_blank" rel="noopener noreferrer" title={t(`partners.${p.key}`)}>
            <img
              className={p.dark ? 'partners__img--light' : undefined}
              src={p.light}
              alt={t(`partners.${p.key}`)}
              width={p.w}
              height={p.h}
              loading="lazy"
            />
            {p.dark && (
              <img className="partners__img--dark" src={p.dark} alt={t(`partners.${p.key}`)} width={p.w} height={p.h} loading="lazy" />
            )}
            {variant === 'cards' && <span className="partners__name">{t(`partners.${p.key}`)}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}
