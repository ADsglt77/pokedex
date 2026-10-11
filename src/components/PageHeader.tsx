import { Stack } from '@camply/ui'
import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

/** Le titre de la page (`<h1>`) et son chapeau. */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <Stack as="header" gap={3} className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {children && <div className={styles.lede}>{children}</div>}
    </Stack>
  )
}
