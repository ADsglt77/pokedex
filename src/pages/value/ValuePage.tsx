import { Alert, Skeleton, SkeletonText, Stack, Stat } from '@camply/ui'
import { Flag } from '@camply/ui/icons'
import { Suspense, use, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { speciesPath } from '@/lib/filters'
import { ChartPeriodControl, ChartStats } from '@/components/ChartParts'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { PriceChart } from '@/components/PriceChart'
import { PricedValue } from '@/components/PricedValue'
import { UnlockedChart } from '@/components/UnlockedChart'
import { STATUS_ICONS } from '@/components/statusIcons'
import { usePokedex } from '@/hooks/usePokedex'
import { cx } from '@/lib/cx'
import {
  details,
  formatDate,
  formatEuro,
  formatInteger,
  formatPercent,
  pageTitle,
  plural,
  today,
} from '@/lib/format'
import { spendingEvents } from '@/lib/budget'
import {
  firstDate,
  inWindow,
  levelStats,
  periodWindow,
  runningTotal,
  weeksOf,
  type ChartPeriod,
} from '@/lib/chart'
import {
  collectionHistory,
  completionByGeneration,
  completionCost,
  gainPercent,
  priceMovers,
  tallyByStatus,
  trackedCards,
  type PricePoint,
  type Tally,
  type TrackedCard,
} from '@/lib/prices'
import { unlockEvents } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { loadPriceHistories, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import { CardsTable, CompletionTable } from './ValueTables'
import styles from './ValuePage.module.css'

/** « 3 cartes · payées 120,00 € · 1 sans prix » */
const tallyHint = (tally: Tally, withPaid: boolean, priced: boolean) =>
  details(
    plural(tally.count, 'carte', 'cartes'),
    withPaid && tally.paid > 0 && `payées ${formatEuro(tally.paid)}`,
    // Sans les prix (pas encore là, ou indisponibles), chaque carte compterait « sans prix ».
    priced && tally.unpriced > 0 && `${formatInteger(tally.unpriced)} sans prix`,
  )

/**
 * Valeur : ce que vaut la collection au prix Cardmarket du jour, ce qu'elle a coûté, ce que
 * coûterait de la compléter, et son évolution.
 */
export function ValuePage() {
  const prices = usePrices()
  const pricesMissing = usePricesMissing()
  const collection = useCollectionStore((state) => state.collection)
  const { entries } = usePokedex()
  const cards = useMemo(() => trackedCards(collection, prices), [collection, prices])
  const tallies = tallyByStatus(cards)
  const completion = useMemo(() => completionByGeneration(entries, prices), [entries, prices])
  const toComplete = useMemo(() => completionCost(entries, prices), [entries, prices])
  const owned = cards.filter((card) => card.status === 'owned').map((card) => card.card)
  const priced = prices !== null
  const money = (value: number) => <PricedValue>{formatEuro(value)}</PricedValue>

  return (
    <div className="container">
      <title>{pageTitle('Valeur')}</title>
      <PageHeader title="Valeur">
        Prix du marché Cardmarket
        {prices && ` du ${formatDate(prices.date)}`}, en euros. Une estimation : l’état de la carte
        et le vendeur font varier le prix réel.
      </PageHeader>

      <div className={styles.grid}>
        {pricesMissing && (
          <Alert
            className={styles.wide}
            tone="info"
            title="Les prix ne sont pas disponibles pour le moment."
          >
            Ils sont relus chaque jour par le serveur. Les prix payés que vous avez notés restent
            visibles ci-dessous.
          </Alert>
        )}

        <div className={cx('stat-grid', styles.wide)}>
          <Stat
            label="Ma collection"
            icon={<STATUS_ICONS.owned size={18} />}
            value={money(tallies.owned.value)}
            delta={
              prices ? gainPercent(tallies.owned.paidCardsValue, tallies.owned.paid) : undefined
            }
            deltaSuffix={'\u00a0%'}
            hint={tallyHint(tallies.owned, true, priced)}
          />
          <Stat
            label="Commandées"
            icon={<STATUS_ICONS.ordered size={18} />}
            value={money(tallies.ordered.value)}
            hint={tallyHint(tallies.ordered, true, priced)}
          />
          <Stat
            label="Souhaitées"
            icon={<STATUS_ICONS.wanted size={18} />}
            value={money(tallies.wanted.value)}
            hint={tallyHint(tallies.wanted, false, priced)}
          />
          <Stat
            label="Pour compléter le Pokédex"
            icon={<Flag size={18} />}
            value={money(toComplete.value)}
            hint={details(
              priced && plural(toComplete.priced, 'Pokémon chiffré', 'Pokémon chiffrés'),
              priced &&
                toComplete.unpriced > 0 &&
                `${formatInteger(toComplete.unpriced)} sans prix`,
              toComplete.noCard > 0 && `${formatInteger(toComplete.noCard)} sans carte`,
            )}
          />
        </div>

        <Evolution owned={owned} />

        <Movers cards={cards} />

        <Panel
          className={styles.wide}
          flush
          title="Mes cartes"
          description="Ce qu’elles ont coûté et ce qu’elles valent, la plus chère d’abord."
        >
          <CardsTable cards={cards} />
        </Panel>

        <Panel
          className={styles.wide}
          flush
          title="Pour compléter, par génération"
          description="Pour chaque Pokémon à débloquer, le prix de sa carte ; ceux sans carte, ou dont la carte n’a pas de prix, sont comptés à part. Ceux dont la carte est déjà commandée n’y sont pas : ils comptent dans les commandes."
        >
          <CompletionTable rows={completion} priced={prices !== null} />
        </Panel>
      </div>
    </div>
  )
}

/**
 * L'évolution, jour par jour sur la période choisie (7 jours au moins) : la valeur de la collection,
 * les Pokémon débloqués et les dépenses, chacune avec ses chiffres.
 */
function Evolution({ owned }: { owned: PokemonCard[] }) {
  const [period, setPeriod] = useState<ChartPeriod>('month')
  const collection = useCollectionStore((state) => state.collection)
  const orders = useShoppingStore((state) => state.shopping.orders)
  const day = today()
  const unlocks = useMemo(() => unlockEvents(collection), [collection])
  const spending = useMemo(() => spendingEvents(orders), [orders])

  return (
    <Panel
      className={styles.wide}
      title="Évolution"
      description="Jour par jour, sur la période choisie."
      actions={<ChartPeriodControl value={period} onChange={setPeriod} />}
    >
      <div className={styles.charts}>
        <section className={cx(styles.chart, styles.chartWide)}>
          <h3 className={styles.subtitle}>Valeur de ma collection</h3>
          <p className="hint">Vos cartes possédées aujourd’hui, au prix de chaque jour.</p>
          {owned.length > 0 ? (
            <Suspense fallback={<Skeleton height="7rem" />}>
              <CollectionChart cards={owned} period={period} day={day} />
            </Suspense>
          ) : (
            <p className="muted">Aucune carte possédée pour l’instant : pas de courbe à tracer.</p>
          )}
        </section>
        <section className={styles.chart}>
          <h3 className={styles.subtitle}>Pokémon débloqués</h3>
          <p className="hint">Le total, jour après jour.</p>
          <UnlockedChart events={unlocks} period={period} day={day} />
        </section>
        <section className={styles.chart}>
          <h3 className={styles.subtitle}>Dépenses</h3>
          <p className="hint">Vos commandes, cumulées depuis le début de la période.</p>
          <SpendingChart events={spending} period={period} day={day} />
        </section>
      </div>
    </Panel>
  )
}

interface ChartProps {
  period: ChartPeriod
  /** Aujourd'hui : le dernier jour de la période. */
  day: string
}

function CollectionChart({ cards, period, day }: ChartProps & { cards: PokemonCard[] }) {
  // Les cartes sans id Cardmarket n'ont pas d'historique : elles ne pèsent pas sur la courbe. La
  // même carte Cardmarket possédée pour deux Pokémon compte deux fois, comme dans la valeur du
  // jour ; son historique n'est demandé qu'une fois.
  const ids = cards.flatMap((card) => card.cardmarket ?? []).sort((a, b) => a - b)
  const histories = use(loadPriceHistories(ids))
  const series = collectionHistory(histories)
  const window = periodWindow(period, day, series[0]?.date ?? null)
  const points = inWindow(series, window)
  return (
    <>
      <PriceChart points={points} window={window} label="Valeur de ma collection" />
      <ChartStats items={levelStats(points)} />
    </>
  )
}

function SpendingChart({ events, period, day }: ChartProps & { events: PricePoint[] }) {
  if (events.length === 0) return <p className="muted">Aucune commande pour l’instant.</p>
  const window = periodWindow(period, day, firstDate(events))
  const points = runningTotal(events, window, false)
  const spent = points.at(-1)!.value
  return (
    <>
      <PriceChart points={points} window={window} label="Dépenses cumulées" fromZero />
      <ChartStats
        items={[
          { label: 'Dépensé', value: formatEuro(spent) },
          { label: 'Par semaine', value: formatEuro(spent / weeksOf(window)) },
          { label: 'Commandes', value: formatInteger(inWindow(events, window).length) },
        ]}
      />
    </>
  )
}

/**
 * Les cartes possédées dont le prix a le plus monté, ou baissé, sur 30 jours. Sans les prix du
 * jour : « — », une ébauche tant qu'ils arrivent (pas « aucune »).
 */
function Movers({ cards }: { cards: TrackedCard[] }) {
  const prices = usePrices()
  const pricesMissing = usePricesMissing()
  const moves = priceMovers(cards, prices, 5)
  const groups = [
    { title: 'Plus fortes hausses', list: moves.risers, className: styles.up },
    { title: 'Plus fortes baisses', list: moves.fallers, className: styles.down },
  ]
  return (
    <Panel
      className={styles.wide}
      title="Ce qui bouge"
      description="Vos cartes possédées dont le prix du jour s’écarte le plus de leur moyenne Cardmarket sur 30 jours (au moins 5 % et 0,50 €)."
    >
      <div className={styles.columns}>
        {groups.map(({ title, list, className }) => (
          <Stack key={title} gap={2}>
            <h3 className={styles.subtitle}>{title}</h3>
            {!prices ? (
              pricesMissing ? (
                <p className="muted">—</p>
              ) : (
                <SkeletonText lines={2} />
              )
            ) : list.length === 0 ? (
              <p className="muted">Aucune pour l’instant.</p>
            ) : (
              <ul className={styles.movers}>
                {list.map(({ card, price, avg30, change }) => (
                  <li key={card.id}>
                    <Link to={speciesPath(card.dexIds[0]!)}>{card.reference}</Link>
                    <span className={styles.moverPrice}>
                      {formatEuro(price)} <span className={className}>{formatPercent(change)}</span>
                      <span className="muted"> · moyenne {formatEuro(avg30)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        ))}
      </div>
    </Panel>
  )
}
