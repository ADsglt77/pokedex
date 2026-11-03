import { Skeleton, Stat } from '@camply/ui'
import { Suspense, use, useState } from 'react'
import { ChartPeriodControl, LevelChart } from '@/components/ChartParts'
import { CardmarketLink } from '@/components/CardmarketLink'
import { Panel } from '@/components/Panel'
import type { ChartPeriod } from '@/lib/chart'
import { details, formatEuro } from '@/lib/format'
import { cardHistory, gainPercent, priceOf } from '@/lib/prices'
import { loadPriceHistory, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import styles from './PricePanel.module.css'

/**
 * Une carte chez Cardmarket : de quoi trouver son prix, sa page (dans sa langue), et nommer sa
 * courbe.
 */
type PricedCard = Pick<PokemonCard, 'cardmarket' | 'page' | 'reference' | 'language'>

/**
 * Ce que dit le panneau d'une carte sans prix : les prix manquent, Cardmarket n'en a pas pour elle,
 * ou elle n'a pas d'id Cardmarket (`withoutId`).
 */
function noPriceText(missing: boolean, cardmarket: number | undefined, withoutId: string) {
  if (missing) return 'Les prix ne sont pas disponibles pour le moment.'
  if (cardmarket) return 'Cardmarket n’a pas de prix pour cette carte.'
  return withoutId
}

/**
 * La carte chez Cardmarket : son id et sa page, son prix du jour, son évolution et, si le prix
 * payé (`paid`) est noté, l'écart (la fiche d'un Pokémon, une carte du catalogue). `withoutId` :
 * ce qu'il dit d'une carte sans id Cardmarket (par défaut, qu'il n'est pas connu). Le prix d'une
 * carte française est celui de toutes les langues (son produit est partagé) : il le dit.
 */
export function PricePanel({
  card,
  paid = null,
  withoutId = 'Pas de prix : son id Cardmarket n’est pas connu.',
  headingLevel,
}: {
  card: PricedCard
  paid?: number | null
  withoutId?: string
  headingLevel?: 2 | 3
}) {
  // L'historique est demandé tout de suite, avec les prix du jour (plus d'un Mo) et pas après eux :
  // la même promesse, que la courbe lira (`use`).
  if (card.cardmarket !== undefined) void loadPriceHistory(card.cardmarket)
  const ids = card.cardmarket === undefined ? [] : [card.cardmarket]
  const prices = usePrices(ids)
  const missing = usePricesMissing(ids)
  const price = priceOf(prices, card)

  return (
    <Panel
      title="Prix Cardmarket"
      headingLevel={headingLevel}
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
          <div className={styles.price}>
            <Stat
              variant="plain"
              label="Prix du marché"
              value={formatEuro(price.price)}
              delta={paid === null ? undefined : gainPercent(price.price, paid)}
              deltaSuffix={'\u00a0%'}
              hint={details(
                paid !== null && `payée ${formatEuro(paid)}`,
                price.low && `au plus bas ${formatEuro(price.low)}`,
                price.monthAgo && `il y a 30 jours ${formatEuro(price.monthAgo)}`,
              )}
            />
            {card.language === 'fr' && (
              <p className={styles.scope}>
                Prix toutes langues : une carte française partage sa fiche Cardmarket avec les
                autres langues, surtout des offres en anglais.
              </p>
            )}
          </div>
          <Suspense fallback={<Skeleton height="7rem" />}>
            <PriceHistory card={card} />
          </Suspense>
        </>
      ) : prices || missing ? (
        <p className="muted">{noPriceText(missing, card.cardmarket, withoutId)}</p>
      ) : (
        // Les prix arrivent : la place du prix est gardée.
        <Skeleton height="4.5rem" />
      )}
    </Panel>
  )
}

/**
 * La courbe d'une carte qui a un prix (donc un id Cardmarket), jour par jour sur la période
 * choisie, et ses chiffres.
 */
function PriceHistory({ card }: { card: PricedCard }) {
  const [period, setPeriod] = useState<ChartPeriod>('month')
  const history = use(loadPriceHistory(card.cardmarket!))
  return (
    <div className={styles.history}>
      <ChartPeriodControl value={period} onChange={setPeriod} />
      <LevelChart
        series={cardHistory(history)}
        period={period}
        label={`Prix de la carte ${card.reference}`}
      />
    </div>
  )
}
