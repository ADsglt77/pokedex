import { Table } from '@camply/ui'
import { Link } from 'react-router'
import { cardTitle } from '@/lib/species'
import { TableCount } from '@/components/TableCount'
import { cx } from '@/lib/cx'
import { pokedexUrl, speciesPath } from '@/lib/filters'
import { formatEuro, formatEuroChange, statusLabel } from '@/lib/format'
import type { CompletionCost, TrackedCard } from '@/lib/prices'
import { type Generation, generationLabel } from '@/config/pokedex'
import type { CardStatus } from '@/types'
import styles from './ValuePage.module.css'

const money = (value: number | null) => (value === null ? '—' : formatEuro(value))

const STATUS_ORDER: Record<CardStatus, number> = { owned: 0, ordered: 1, wanted: 2 }

interface CardRow {
  id: string
  name: string
  speciesId: number
  reference: string
  status: CardStatus
  paid: number | null
  value: number | null
  /** Valeur moins prix payé, quand les deux sont connus. */
  gain: number | null
}

/** Les cartes suivies : ce qu'elles ont coûté et ce qu'elles valent, la plus chère d'abord. */
export function CardsTable({ cards }: { cards: TrackedCard[] }) {
  const rows: CardRow[] = cards.map(({ card, status, paid, value }) => ({
    id: card.id,
    name: cardTitle(card),
    speciesId: card.dexIds[0]!,
    reference: card.reference,
    status,
    paid,
    value,
    gain: paid !== null && value !== null ? value - paid : null,
  }))

  return (
    <Table
      className={cx('data-table stack-table', styles.cardsTable)}
      data={rows}
      rowKey={(row) => row.id}
      defaultSort={{ key: 'value', dir: 'desc' }}
      emptyState="Aucune carte suivie : marquez une carte comme possédée, commandée ou souhaitée."
      columns={[
        {
          key: 'name',
          header: 'Carte',
          sortValue: (row) => row.name,
          cell: (row) => (
            <span className={styles.card}>
              <Link to={speciesPath(row.speciesId)}>{row.name}</Link>
              <span className="muted">{row.reference}</span>
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Statut',
          sortValue: (row) => STATUS_ORDER[row.status],
          cell: (row) => statusLabel(row.status),
        },
        {
          key: 'paid',
          header: 'Payé',
          align: 'right',
          sortValue: (row) => row.paid ?? -1,
          // Sur téléphone, « payé » n'est dit que s'il est connu.
          cell: (row) =>
            row.paid === null ? (
              <span className="stack-hidden">—</span>
            ) : (
              <>
                <span className="stack-label">payé </span>
                {formatEuro(row.paid)}
              </>
            ),
        },
        {
          key: 'value',
          header: 'Valeur',
          align: 'right',
          sortValue: (row) => row.value ?? -1,
          cell: (row) => money(row.value),
        },
        {
          key: 'gain',
          header: 'Écart',
          align: 'right',
          sortValue: (row) => row.gain ?? Number.NEGATIVE_INFINITY,
          cell: (row) =>
            row.gain === null ? (
              <span className="stack-hidden">—</span>
            ) : (
              <span className={cx(row.gain > 0 && styles.up, row.gain < 0 && styles.down)}>
                <span className="stack-label">écart </span>
                {formatEuroChange(row.gain)}
              </span>
            ),
        },
      ]}
    />
  )
}

/**
 * Le coût pour compléter chaque génération. Sans les prix du jour (`priced`, pas encore arrivés ou
 * indisponibles), « — » : ni coût, ni cartes sans prix.
 */
export function CompletionTable({
  rows,
  priced,
}: {
  rows: { generation: Generation; cost: CompletionCost }[]
  priced: boolean
}) {
  return (
    <Table
      className={cx('data-table stack-table', styles.completion)}
      data={rows}
      rowKey={(row) => row.generation.id}
      columns={[
        {
          key: 'generation',
          header: 'Génération',
          cell: ({ generation }) => (
            <Link to={pokedexUrl({ generation: generation.id, possession: 'missing' })}>
              {generationLabel(generation)}
            </Link>
          ),
        },
        {
          key: 'toUnlock',
          header: 'À débloquer',
          align: 'right',
          cell: ({ cost }) => (
            <TableCount
              count={cost.priced + cost.unpriced + cost.noCard}
              one="à débloquer"
              many="à débloquer"
            />
          ),
        },
        {
          key: 'noCard',
          header: 'Sans carte',
          align: 'right',
          cell: ({ cost }) => <TableCount count={cost.noCard} one="sans carte" many="sans carte" />,
        },
        {
          key: 'unpriced',
          header: 'Sans prix',
          align: 'right',
          cell: ({ cost }) =>
            priced ? (
              <TableCount count={cost.unpriced} one="sans prix" many="sans prix" />
            ) : (
              <span className="stack-hidden">—</span>
            ),
        },
        {
          key: 'cost',
          header: 'Coût estimé',
          align: 'right',
          cell: ({ cost }) => (priced ? formatEuro(cost.value) : '—'),
        },
      ]}
    />
  )
}
