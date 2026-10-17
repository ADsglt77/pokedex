import type { ReactNode } from 'react'
import styles from './Logo.module.css'

/**
 * La marque : le logo puis le nom (`children`), en titre. Le logo est une Poké Ball plate (moitié
 * rouge, moitié blanche, bande et bouton cerclés d'encre), aux couleurs de la marque dans les deux
 * thèmes ; le même dessin sert d'icône d'onglet (`public/favicon.svg`). Dans la coquille
 * (`AppShell`) et sur le Pokédex public.
 */
export function Logo({ children }: { children: ReactNode }) {
  return (
    <span className={styles.brand}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={styles.logo}>
        <circle cx="16" cy="16" r="14" className={styles.ballWhite} />
        <path d="M2 16a14 14 0 0 1 28 0Z" className={styles.ballRed} />
        <path d="M2 16h28" className={styles.ballBand} />
        <circle cx="16" cy="16" r="5.25" className={styles.ballInk} />
        <circle cx="16" cy="16" r="3" className={styles.ballWhite} />
        <circle cx="16" cy="16" r="14" className={styles.ballOutline} />
      </svg>
      {children}
    </span>
  )
}
