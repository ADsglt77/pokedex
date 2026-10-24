import { Table, type SortState } from '@camply/ui'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useGrowingList } from '@/hooks/useGrowingList'
import { cardTitle } from '@/lib/species'
import { CardPageLink } from '@/components/CardPageLink'
import { TableCount } from '@/components/TableCount'
import { cx } from '@/lib/cx'
import { pokedexUrl } from '@/lib/filters'
import { seriesOf } from '@/lib/series'
import { formatEuro, formatEuroChange, statusLabel } from '@/lib/format'
import type { CompletionCost, TrackedCard } from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { type Generation, generationLabel } from '@/config/pokedex'
import type { CardStatus, PokemonCard } from '@/types'
import styles from './ValuePage.module.css'

const money = (value: number | null) => (value === null ? '—' : formatEuro(value))

const STATUS_ORDER: Record<CardStatus, number> = { owned: 0, ordered: 1 }

interface CardRow {
  id: string
  card: PokemonCard
  name: string
  reference: string
  status: CardStatus
  paid: number | null
  value: number | null
  /** Valeur moins prix payé, quand les deux sont connus. */
  gain: number | null
}

/** Ce qui range les cartes, par colonne triable. */
const SORT_VALUES: Record<string, (row: CardRow) => string | number> = {
  name: (row) => row.name,
  status: (row) => STATUS_ORDER[row.status],
  paid: (row) => row.paid ?? -1,
  value: (row) => row.value ?? -1,
  gain: (row) => row.gain ?? Number.NEGATIVE_INFINITY,
}

const collator = new Intl.Collator('fr', { numeric: true })

/** Les cartes dans l'ordre choisi : les textes comme on les lit, les nombres par leur valeur. */
function sortCards(rows: CardRow[], sort: SortState | null) {
  if (!sort) return rows
  const value = SORT_VALUES[sort.key]!
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)]
    return sign * (typeof x === 'string' ? collator.compare(x, y as string) : x - (y as number))
  })
}

/** Les lignes dessinées d'un coup : plus qu'un grand écran n'en montre. */
const ROWS_STEP = 60

/**
 * Les cartes suivies : ce qu'elles ont coûté et ce qu'elles valent, la plus chère d'abord. Jusqu'à
 * un millier de lignes : triées ici (le tri du tableau, contrôlé), dessinées au fur et à mesure du
 * défilement (`useGrowingList`) : la page s'ouvre vite.
 */
export function CardsTable({ cards }: { cards: TrackedCard[] }) {
  const collection = useCollectionStore((state) => state.collection)
  const [sort, setSort] = useState<SortState | null>({ key: 'value', dir: 'desc' })
  const rows = useMemo(
    () =>
      sortCards(
        cards.map(({ card, status, paid, value }) => ({
          id: card.id,
          card,
          name: cardTitle(card),
          reference: card.reference,
          status,
          paid,
          value,
          gain: paid !== null && value !== null ? value - paid : null,
        })),
        sort,
      ),
    [cards, sort],
  )
  const { limit, sentinel, more } = useGrowingList(rows.length, ROWS_STEP)

  return (
    <div className="growing">
      <Table
        bordered={false}
        className={cx('stack-table', styles.cardsTable)}
        data={rows.slice(0, limit)}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        emptyState="Aucune carte suivie : marquez une carte comme possédée ou commandée."
        columns={[
          {
            key: 'name',
            header: 'Carte',
            sortValue: SORT_VALUES.name,
            cell: (row) => (
              <span className={styles.card}>
                <CardPageLink card={row.card} series={seriesOf(collection, row.id)}>
                  {row.name}
                </CardPageLink>
                <span className="muted">{row.reference}</span>
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Statut',
            sortValue: SORT_VALUES.status,
            cell: (row) => statusLabel(row.status),
          },
          {
            key: 'paid',
            header: 'Payé',
            align: 'right',
            sortValue: SORT_VALUES.paid,
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
            sortValue: SORT_VALUES.value,
            cell: (row) => money(row.value),
          },
          {
            key: 'gain',
            header: 'Écart',
            align: 'right',
            sortValue: SORT_VALUES.gain,
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
      {more && <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />}
    </div>
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
      bordered={false}
      className={cx('stack-table', styles.completion)}
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
          // Des Pokémon, sans carte compris ; ceux dont une carte est commandée n'y sont pas : ils
          // comptent dans les commandes.
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
