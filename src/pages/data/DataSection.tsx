import { Stack } from '@camply/ui'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './DataPage.module.css'

interface DataSectionProps {
  id: string
  title: string
  children: ReactNode
  /** Section mise à part (effacement). */
  apart?: boolean
}

export function DataSection({ id, title, children, apart }: DataSectionProps) {
  return (
    <Stack
      as="section"
      gap={4}
      align="start"
      id={id}
      className={cx(styles.section, apart && styles.apart)}
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className={styles.title}>
        {title}
      </h2>
      {children}
    </Stack>
  )
}
