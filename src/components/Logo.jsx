import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

/**
 * The CTRI mark: three broken concentric rings around a coral dot.
 * The two dark rings use currentColor so the mark inverts with the theme;
 * the teal ring and the dot are fixed brand colours in both themes.
 */
export function Mark({ className = '', style }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true" focusable="false">
      <g fill="none" strokeWidth="7.4" strokeLinecap="round">
        <path d="M81.945 25.927A40 40 0 1 0 63.023 87.821" stroke="currentColor" />
        <path d="M62.494 24.384A28.5 28.5 0 1 1 21.608 52.484" stroke="var(--brand-teal)" />
        <path d="M37.055 37.929A17.7 17.7 0 1 1 60.897 63.948" stroke="currentColor" />
      </g>
      <circle cx="50" cy="50" r="6.6" fill="var(--brand-coral)" />
    </svg>
  )
}

export default function Logo({ size = 'md', bare = false, link = true }) {
  const { t } = useI18n()
  const cls = ['logo', size === 'lg' && 'logo--lg', bare && 'logo--bare'].filter(Boolean).join(' ')

  const inner = (
    <>
      <Mark className="logo__mark" />
      <span className="logo__text">
        {/* The wordmark's full stop is the coral square from the brand sheet */}
        <span className="logo__word">
          CTRI<i aria-hidden="true" />
        </span>
        {!bare && (
          <span className="logo__sub">
            {t('brand.fullLines')[0]}
            <br />
            {t('brand.fullLines')[1]}
          </span>
        )}
      </span>
    </>
  )

  if (!link) return <span className={cls}>{inner}</span>
  return (
    <Link to="/" className={cls} aria-label={`${t('brand.name')} — ${t('brand.full')}`}>
      {inner}
    </Link>
  )
}
