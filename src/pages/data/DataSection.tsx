import type { ReactNode, Ref } from 'react'
import { Panel } from '@/components/Panel'
import { cx } from '@/lib/cx'
import styles from './DataPage.module.css'

interface DataSectionProps {
  id: string
  title: string
  /** La phrase sous le titre : ce que fait la section. */
  description?: ReactNode
  children: ReactNode
  /** Section dangereuse (effacement), bordée de rouge. */
  danger?: boolean
  /** Le titre, pour y mener le focus quand une action retire son bouton (`focusAfter`). */
  titleRef?: Ref<HTMLHeadingElement>
}

/** Une section de la page Données : un panneau, son ancre (`#exporter`…) et son contenu. */
export function DataSection({
  id,
  title,
  description,
  children,
  danger,
  titleRef,
}: DataSectionProps) {
  return (
    <Panel
      id={id}
      title={title}
      description={description}
      titleRef={titleRef}
      className={cx(styles.section, danger && styles.danger)}
    >
      {children}
    </Panel>
  )
}
