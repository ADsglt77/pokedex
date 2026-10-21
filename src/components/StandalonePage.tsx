import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import { cx } from '@/lib/cx'
import styles from './StandalonePage.module.css'

/**
 * Une page seule, hors de la coquille (Pokédex public, mentions légales) : la marque et ses
 * actions (`actions`) en tête, son contenu (`children`, dans `<main>` : `className`), puis le pied
 * de page.
 */
export function StandalonePage({
  actions,
  className,
  children,
}: {
  actions: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx('container', styles.page)}>
      <header className={styles.header}>
        <Logo>PokéCodex</Logo>
        {actions}
      </header>
      <main className={cx(styles.main, className)}>{children}</main>
      <footer className={styles.footer}>
        <SiteDisclaimer />
      </footer>
    </div>
  )
}
