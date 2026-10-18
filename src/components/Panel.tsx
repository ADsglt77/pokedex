import { Card, CardDescription, CardTitle } from '@camply/ui'
import type { ReactNode, Ref } from 'react'
import { cx } from '@/lib/cx'
import styles from './Panel.module.css'

/**
 * Un bloc d'une page (tableau de bord, valeur, réglages) : une `Card` de camply, son titre et sa
 * phrase, ses actions à droite, puis son contenu (`flush` : un tableau `bordered={false}`, bord à
 * bord). Pas une
 * région nommée : une page en compte jusqu'à huit, trop de points de repère ; son titre (h2) suffit
 * à s'y retrouver.
 */
export function Panel({
  title,
  description,
  actions,
  id,
  className,
  flush = false,
  titleRef,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  id?: string
  className?: string
  /** Le contenu touche les bords du panneau : un tableau, sans cadre en plus du panneau. */
  flush?: boolean
  /** Le titre peut recevoir le focus : quand une action fait disparaître ce qui l'avait. */
  titleRef?: Ref<HTMLHeadingElement>
  children?: ReactNode
}) {
  return (
    <Card padding="none" id={id} className={cx(styles.panel, className)}>
      <div className={styles.head}>
        <div className={styles.titles}>
          <CardTitle
            ref={titleRef}
            tabIndex={titleRef ? -1 : undefined}
            headingLevel={2}
            className={styles.title}
          >
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children && <div className={cx(styles.body, flush && styles.flush)}>{children}</div>}
    </Card>
  )
}
