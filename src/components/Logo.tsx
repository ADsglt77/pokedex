import { cx } from '@/lib/cx'
import styles from './Logo.module.css'

/**
 * Le logo : une Poké Ball, plate (moitié rouge, moitié blanche, bande et bouton cerclés d'encre),
 * aux couleurs de la marque dans les deux thèmes. Le même dessin sert d'icône d'onglet
 * (`public/favicon.svg`). Dans la coquille (`AppShell`) et sur le Pokédex public.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx(styles.logo, className)}>
      <circle cx="16" cy="16" r="14" className={styles.ballWhite} />
      <path d="M2 16a14 14 0 0 1 28 0Z" className={styles.ballRed} />
      <path d="M2 16h28" className={styles.ballBand} />
      <circle cx="16" cy="16" r="5.25" className={styles.ballInk} />
      <circle cx="16" cy="16" r="3" className={styles.ballWhite} />
      <circle cx="16" cy="16" r="14" className={styles.ballOutline} />
    </svg>
  )
}
