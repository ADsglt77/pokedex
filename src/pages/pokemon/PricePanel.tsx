import { Skeleton, Stat } from '@camply/ui'
import { Suspense, use, useState } from 'react'
import { ChartPeriodControl, ChartStats } from '@/components/ChartParts'
import { CardmarketLink } from '@/components/CardmarketLink'
import { Panel } from '@/components/Panel'
import { PriceChart } from '@/components/PriceChart'
import { inWindow, levelStats, periodWindow, type ChartPeriod } from '@/lib/chart'
import { details, formatEuro, today } from '@/lib/format'
import { cardHistory, gainPercent, priceOf } from '@/lib/prices'
import { loadPriceHistory, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import styles from './PricePanel.module.css'

/**
 * La carte chez Cardmarket : son id et sa page, son prix du jour, son évolution et, si le prix
 * payé (`paid`) est noté, l'écart.
 */
export function PricePanel({ card, paid }: { card: PokemonCard; paid: number | null }) {
  const prices = usePrices()
  const missing = usePricesMissing()
  const price = priceOf(prices, card)

  return (
    <Panel
      title="Prix Cardmarket"
      description={
        card.cardmarket !== undefined && (
          <>
            Id Cardmarket <span className="numeric">{card.cardmarket}</span>
          </>
        )
      }
      actions={<CardmarketLink card={card} className={styles.link} />}
    >
      {price ? (
        <>
          <Stat
            className={styles.stat}
            label="Prix du marché"
            value={formatEuro(price.price)}
            delta={paid === null ? undefined : gainPercent(price.price, paid)}
            deltaSuffix={'\u00a0%'}
            hint={details(
              paid !== null && `payée ${formatEuro(paid)}`,
              price.low && `au plus bas ${formatEuro(price.low)}`,
              price.avg30 && `moyenne 30 jours ${formatEuro(price.avg30)}`,
            )}
          />
          {card.cardmarket !== undefined && (
            <Suspense fallback={<Skeleton height="7rem" />}>
              <PriceHistory card={card} cardmarket={card.cardmarket} avg30={price.avg30} />
            </Suspense>
          )}
        </>
      ) : prices || missing ? (
        <p className="muted">
          {missing
            ? 'Les prix ne sont pas disponibles pour le moment.'
            : card.cardmarket
              ? 'Cardmarket n’a pas de prix pour cette carte.'
              : 'Pas de prix : ajoutez l’id Cardmarket de la carte (« Modifier la carte »).'}
        </p>
      ) : (
        // Les prix arrivent : la place du prix est gardée.
        <Skeleton height="4.5rem" />
      )}
    </Panel>
  )
}

/**
 * La courbe d'une carte qui a un prix (donc un id Cardmarket), jour par jour sur la période
 * choisie, et ses chiffres ; en repère, la moyenne de ses ventes sur 30 jours que donne le guide
 * des prix du jour (une vraie donnée de Cardmarket, quand l'historique relevé est encore court).
 */
function PriceHistory({
  card,
  cardmarket,
  avg30,
}: {
  card: PokemonCard
  cardmarket: number
  avg30: number | null
}) {
  const [period, setPeriod] = useState<ChartPeriod>('month')
  const history = use(loadPriceHistory(cardmarket))
  const series = cardHistory(history)
  const window = periodWindow(period, today(), series[0]?.date ?? null)
  const points = inWindow(series, window)
  return (
    <div className={styles.history}>
      <ChartPeriodControl value={period} onChange={setPeriod} />
      <PriceChart
        points={points}
        window={window}
        label={`Prix de la carte ${card.reference}`}
        reference={avg30 ? { value: avg30, label: 'Moyenne Cardmarket sur 30 jours' } : undefined}
      />
      <ChartStats items={levelStats(points)} />
    </div>
  )
}
