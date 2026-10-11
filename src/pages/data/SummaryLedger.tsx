import { DescriptionList } from '@camply/ui'
import type { CollectionSummary } from '@/lib/collection'
import { formatInteger } from '@/lib/format'
import styles from './DataPage.module.css'

const ROWS: { key: keyof CollectionSummary; label: string }[] = [
  { key: 'owned', label: 'Cartes possédées' },
  { key: 'ordered', label: 'Cartes commandées' },
  { key: 'wanted', label: 'Cartes souhaitées' },
  { key: 'favorites', label: 'Illustrations choisies' },
]

/** L'inventaire d'une collection, une ligne par type de donnée. */
export function SummaryLedger({ summary }: { summary: CollectionSummary }) {
  return (
    <DescriptionList
      className={styles.ledger}
      divided
      items={ROWS.map(({ key, label }) => ({
        term: label,
        description: formatInteger(summary[key]),
      }))}
    />
  )
}
