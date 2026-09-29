import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

/**
 * Background watermark: the official mark used as a CSS mask, so it paints as
 * a single-colour silhouette in whatever `color` the container sets.
 */
export function Mark({ className = '', style }) {
  return <span className={`mark-silhouette ${className}`} style={style} aria-hidden="true" />
}

/**
 * The official CTRI lockup. Both artworks are rendered and CSS shows the one
 * that matches the active theme, so switching themes never waits on a fetch.
 * The lockup carries the Croatian name in both languages — it is the
 * registered logo, not translatable copy.
 */
export default function Logo({ link = true, className = '' }) {
  const { t } = useI18n()
  const inner = (
    <>
      <img className="logo__img logo__img--light" src="/brand/ctri-light.png" alt="" width="720" height="235" />
      <img className="logo__img logo__img--dark" src="/brand/ctri-dark.png" alt="" width="720" height="235" />
    </>
  )
  const label = `${t('brand.name')} — ${t('brand.full')}`
  if (!link) return <span className={`logo ${className}`} role="img" aria-label={label}>{inner}</span>
  return <Link to="/" className={`logo ${className}`} aria-label={label}>{inner}</Link>
}
