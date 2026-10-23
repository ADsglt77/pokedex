import { Card } from '@camply/ui'
import { memo } from 'react'
import { cardPath, seriesPath } from '@/lib/filters'
import { CardArt } from '@/components/CardArt'
import { CardmarketLink } from '@/components/CardmarketLink'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { PricedValue } from '@/components/PricedValue'
import { cardLanguage } from '@/lib/collection'
import { formatDexNumber, formatPercent } from '@/lib/format'
import { cardTitle } from '@/lib/species'
import { priceLabel } from '@/lib/prices'
import type { WishRow } from '@/lib/wishlist'
import styles from './WishCard.module.css'

/**
 * Une carte de la liste d'achats : ce qu'elle est (et la collection d'extension dont elle est une
 * case), ce qu'elle coûte, où la trouver. Mémoïsée : les lignes de `useWishlist` restent les mêmes
 * d'un filtre à l'autre, seules les nouvelles se rendent. Ses liens, vers sa page (`cardPath` :
 * la fiche de son Pokémon, ou la page de sa collection, sa fenêtre ouverte) et vers sa
 * collection, sont de simples liens, que la liste fait suivre par le routeur (`useFollowLinks`).
 */
export const WishCard = memo(function WishCard({ row }: { row: WishRow }) {
  const { card, price, change30, series } = row
  const [speciesId] = card.dexIds
  const path = cardPath(card, series)
  const art = <CardArt card={card} speciesId={speciesId} alt="" />

  return (
    <Card as="article" padding="sm" className={styles.wish}>
      {/* La vignette double le lien du titre : cachée au clavier et aux lecteurs d'écran. */}
      {path ? (
        <a href={path} className={styles.wishArt} tabIndex={-1} aria-hidden="true">
          {art}
        </a>
      ) : (
        <span className={styles.wishArt}>{art}</span>
      )}

      <div className={styles.wishBody}>
        <header className={styles.wishHead}>
          <h2 className={styles.wishTitle}>
            {path ? (
              <a href={path} className="quiet-link">
                {cardTitle(card)}
              </a>
            ) : (
              cardTitle(card)
            )}
          </h2>
          {speciesId !== undefined && (
            <span className="muted numeric">{formatDexNumber(speciesId)}</span>
          )}
        </header>
        <p className={styles.wishReference}>
          {card.reference}
          <LanguageFlag language={cardLanguage(card)} />
        </p>
        {series && (
          <p className="hint">
            <a href={seriesPath(series.set, cardLanguage(series))}>Collection {series.name}</a>
          </p>
        )}

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
