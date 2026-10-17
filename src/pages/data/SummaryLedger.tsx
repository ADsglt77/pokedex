import { DescriptionList } from '@camply/ui'
import type { CollectionSummary } from '@/lib/pokedex'
import { cx } from '@/lib/cx'
import { formatInteger } from '@/lib/format'
import styles from './DataPage.module.css'

const ROWS: { key: keyof CollectionSummary; label: string }[] = [
  { key: 'cards', label: 'Cartes ajoutées' },
  { key: 'owned', label: 'Possédées' },
  { key: 'ordered', label: 'Commandées' },
]

/** L'inventaire d'une collection, une ligne par type de donnée. */
export function SummaryLedger({ summary }: { summary: CollectionSummary }) {
  return (
    <DescriptionList
      className={cx('amounts', styles.ledger)}
      divided
      items={ROWS.map(({ key, label }) => ({
        term: label,
        description: formatInteger(summary[key]),
      }))}
    />
  )
}
