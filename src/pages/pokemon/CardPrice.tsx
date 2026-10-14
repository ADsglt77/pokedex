import { Skeleton, Stack, Stat } from '@camply/ui'
import { Suspense, use } from 'react'
import { CardmarketLink } from '@/components/CardmarketLink'
import { PriceChart } from '@/components/PriceChart'
import { details, formatEuro } from '@/lib/format'
import { cardHistory, gainPercent, priceOf } from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { loadPriceHistory, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import styles from './CardPrice.module.css'

/**
 * La carte chez Cardmarket : son id et sa page, son prix du jour, son évolution et, si le prix
 * payé est noté, l'écart.
 */
export function CardPrice({ card }: { card: PokemonCard }) {
  const prices = usePrices()
  const missing = usePricesMissing()
  const paid = useCollectionStore((state) => state.collection.cards[card.id]?.paidPrice ?? null)
  const price = priceOf(prices, card)

  return (
    <Stack as="section" gap={4} aria-labelledby="price-title">
      <div className={styles.head}>
        <h3 id="price-title">Prix Cardmarket</h3>
        <CardmarketLink card={card} className={styles.link} />
        {card.cardmarket !== undefined && (
          <p className={styles.id}>
            Id Cardmarket <span className="numeric">{card.cardmarket}</span>
          </p>
        )}
      </div>
      {price ? (
        <>
          <Stat
            label="Prix du marché"
            value={formatEuro(price.price)}
            delta={paid === null ? undefined : gainPercent(price.price, paid)}
            hint={details(
              paid !== null && `payée ${formatEuro(paid)}`,
              price.low && `au plus bas ${formatEuro(price.low)}`,
              price.avg30 && `moyenne 30 jours ${formatEuro(price.avg30)}`,
            )}
          />
          {card.cardmarket !== undefined && (
            <Suspense fallback={<Skeleton height="7rem" />}>
              <CardPriceHistory card={card} cardmarket={card.cardmarket} />
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
    </Stack>
  )
}

/** La courbe d'une carte qui a un prix (donc un id Cardmarket). */
function CardPriceHistory({ card, cardmarket }: { card: PokemonCard; cardmarket: number }) {
  const history = use(loadPriceHistory(cardmarket))
  return <PriceChart points={cardHistory(history)} label={`Prix de la carte ${card.reference}`} />
}
