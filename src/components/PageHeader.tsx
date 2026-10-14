import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

/**
 * L'en-tête d'une page : son titre (`<h1>`) et son chapeau à gauche, ses actions principales à
 * droite (dessous sur téléphone).
 */
export function PageHeader({
  title,
  actions,
  children,
}: {
  title: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {children && <div className={styles.lede}>{children}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
