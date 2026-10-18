import { Card } from '@camply/ui'
import { memo } from 'react'
import { speciesPath } from '@/lib/filters'
import { CardArt } from '@/components/CardArt'
import { CardmarketLink } from '@/components/CardmarketLink'
import { PricedValue } from '@/components/PricedValue'
import { formatDexNumber, formatPercent } from '@/lib/format'
import { cardTitle } from '@/lib/species'
import { priceLabel } from '@/lib/prices'
import type { WishRow } from '@/lib/wishlist'
import styles from './WishCard.module.css'

/**
 * Une carte de la liste d'achats : ce qu'elle est, ce qu'elle coûte, où la trouver. Mémoïsée : les
 * lignes de `useWishlist` restent les mêmes d'un filtre à l'autre, seules les nouvelles se rendent.
 * Ses liens vers la fiche sont de simples liens, que la liste fait suivre par le routeur
 * (`useFollowLinks`).
 */
export const WishCard = memo(function WishCard({ row }: { row: WishRow }) {
  const { card, price, change30 } = row
  const speciesId = card.dexIds[0]!

  return (
    <Card as="article" padding="sm" className={styles.wish}>
      {/* La vignette double le lien du titre : cachée au clavier et aux lecteurs d'écran. */}
      <a href={speciesPath(speciesId)} className={styles.wishArt} tabIndex={-1} aria-hidden="true">
        <CardArt card={card} speciesId={speciesId} alt="" />
      </a>

      <div className={styles.wishBody}>
        <header className={styles.wishHead}>
          <h2 className={styles.wishTitle}>
            <a href={speciesPath(speciesId)} className="quiet-link">
              {cardTitle(card)}
            </a>
          </h2>
          <span className="muted numeric">{formatDexNumber(speciesId)}</span>
        </header>
        <p className={styles.wishReference}>{card.reference}</p>

        <dl className={styles.wishPrices}>
          <div>
            <dt>Marché</dt>
            <dd>
              <PricedValue text>{priceLabel(price)}</PricedValue>
            </dd>
          </div>
          <div>
            <dt>Sur 30 jours</dt>
            <dd>{change30 === null ? '—' : formatPercent(change30)}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.wishActions}>
        <CardmarketLink card={card} className={styles.wishLink} />
      </div>
    </Card>
  )
})
