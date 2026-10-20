import type { ComponentProps } from 'react'
import { Panel } from '@/components/Panel'
import { cx } from '@/lib/cx'
import styles from './DataPage.module.css'

/**
 * Une section de la page Réglages : un panneau, son ancre (`#exporter`…) et son contenu ; `danger` :
 * une section dangereuse (effacement), bordée de rouge.
 */
export function DataSection({
  danger,
  ...panel
}: ComponentProps<typeof Panel> & { id: string; danger?: boolean }) {
  return (
    <Panel
      {...panel}
      headingLevel={panel.headingLevel ?? 3}
      className={cx(styles.section, danger && styles.danger)}
    />
  )
}
