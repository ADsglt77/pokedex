import { Skeleton, Stack, Stat } from '@camply/ui'
import { Suspense, use } from 'react'
import { PriceChart } from '@/components/PriceChart'
import { details, formatEuro } from '@/lib/format'
import { cardHistory, gainPercent, priceOf } from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { loadPriceHistory, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import styles from './CardPrice.module.css'

/**
 * Le prix du jour de la carte, son évolution et, si le prix payé est noté, l'écart. Celui de
 * Cardmarket ; sans id Cardmarket, celui de TCGplayer, converti en euros (sans courbe).
 */
export function CardPrice({ card }: { card: PokemonCard }) {
  const prices = usePrices()
  const missing = usePricesMissing()
  const paid = useCollectionStore((state) => state.collection.cards[card.id]?.paidPrice ?? null)
  const price = priceOf(prices, card)
  const usdPerEur = price?.source === 'tcgplayer' && prices?.tcgplayer?.usdPerEur

  return (
    <Stack as="section" gap={4} aria-labelledby="price-title">
      <h3 id="price-title" className={styles.title}>
        {usdPerEur ? 'Prix TCGplayer' : 'Prix Cardmarket'}
      </h3>
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
          {usdPerEur ? (
            <p className="muted">
              Cardmarket n’est pas relié à cette carte : prix du marché américain, converti en euros
              (1 € = {usdPerEur.toLocaleString('fr-FR')} $). Pour celui de Cardmarket, ajoutez l’id
              Cardmarket de la carte (« Modifier la carte »).
            </p>
          ) : (
            <Suspense fallback={<Skeleton height="7rem" />}>
              <CardPriceHistory card={card} cardmarket={card.cardmarket!} />
            </Suspense>
          )}
        </>
      ) : (
        (prices || missing) && (
          <p className="muted">
            {missing
              ? 'Les prix ne sont pas disponibles pour le moment.'
              : card.cardmarket
                ? 'Cardmarket n’a pas de prix pour cette carte.'
                : 'Pas de prix : ajoutez l’id Cardmarket de la carte (« Modifier la carte »).'}
          </p>
        )
      )}
    </Stack>
  )
}

/** La courbe d'une carte qui a un prix (donc un id Cardmarket). */
function CardPriceHistory({ card, cardmarket }: { card: PokemonCard; cardmarket: number }) {
  const history = use(loadPriceHistory(cardmarket))
  return <PriceChart points={cardHistory(history)} label={`Prix de la carte ${card.reference}`} />
}
