import { Skeleton, Stack, Stat } from '@camply/ui'
import { Suspense, use } from 'react'
import { PriceChart } from '@/components/PriceChart'
import { formatEuro } from '@/lib/format'
import { cardHistory, priceOf } from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { loadPriceHistory, usePrices } from '@/store/prices'
import type { PokemonCard } from '@/types'
import styles from './CardPrice.module.css'

/** Le prix Cardmarket de la carte, son évolution et, si le prix payé est noté, l'écart. */
export function CardPrice({ card }: { card: PokemonCard }) {
  const prices = usePrices()
  const paid = useCollectionStore((state) => state.collection.cards[card.id]?.paidPrice ?? null)
  const price = priceOf(prices, card)

  return (
    <Stack as="section" gap={4} aria-labelledby="price-title">
      <h3 id="price-title" className={styles.title}>
        Prix Cardmarket
      </h3>
      {price ? (
        <>
          <Stat
            label="Prix du marché"
            value={formatEuro(price.price)}
            // L'écart depuis l'achat, en %, quand le prix payé est noté.
            delta={paid ? Math.round(((price.price - paid) / paid) * 100) : undefined}
            hint={[
              paid !== null && `payée ${formatEuro(paid)}`,
              price.low && `au plus bas ${formatEuro(price.low)}`,
              price.avg30 && `moyenne 30 jours ${formatEuro(price.avg30)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <Suspense fallback={<Skeleton height="7rem" />}>
            <CardPriceHistory card={card} />
          </Suspense>
        </>
      ) : (
        <p className="muted">
          {prices
            ? 'Cardmarket n’a pas de prix pour cette carte.'
            : 'Les prix ne sont pas disponibles pour le moment.'}
        </p>
      )}
    </Stack>
  )
}

function CardPriceHistory({ card }: { card: PokemonCard }) {
  const history = use(loadPriceHistory())
  return (
    <PriceChart points={cardHistory(history, card)} label={`Prix de la carte ${card.reference}`} />
  )
}
