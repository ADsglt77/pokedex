import { Badge, Card, IconButton } from '@camply/ui'
import { Pencil, X } from '@camply/ui/icons'
import { Link } from 'react-router'
import { speciesPath } from '@/lib/filters'
import { CardArt } from '@/components/CardArt'
import { CardmarketLink } from '@/components/CardmarketLink'
import { PossessionMark } from '@/components/PossessionMark'
import { PRIORITY_LABELS } from '@/config/shopping'
import { formatDexNumber, formatEuro, formatPercent, statusLabel } from '@/lib/format'
import { cardTitle } from '@/lib/species'
import { priceLabel } from '@/lib/prices'
import { priceVerdict } from '@/lib/purchase-planner'
import type { WishRow } from '@/lib/wishlist'
import styles from './ShoppingPage.module.css'

const PRIORITY_TONES = { high: 'accent', normal: 'neutral', low: 'neutral' } as const

/** Prix du marché comparé au prix maximum : sous le maximum, au-dessus, ou rien à comparer. */
function PriceVerdict({ price, maxPrice }: { price: number | null; maxPrice?: number }) {
  const verdict = priceVerdict(price, maxPrice)
  if (!verdict) return null
  return verdict === 'under' ? (
    <Badge size="sm" tone="success">
      Sous votre prix maximum
    </Badge>
  ) : (
    <Badge size="sm" tone="warn">
      Au-dessus de votre prix maximum
    </Badge>
  )
}

/** Le prix du marché nettement sous sa moyenne sur 30 jours (10 % et plus) : un bon moment. */
function PriceDrop({ change }: { change: number | null }) {
  if (change === null || change > -0.1) return null
  return (
    <Badge size="sm" tone="success">
      {formatPercent(change)} sur 30 jours
    </Badge>
  )
}

/** Une carte de la liste d'achats : ce qu'elle est, ce qu'elle coûte, ce qu'on en attend. */
export function WishCard({
  row,
  onEdit,
  onRemove,
}: {
  row: WishRow
  onEdit: () => void
  onRemove: () => void
}) {
  const { card, preference, status, price } = row
  const speciesId = card.dexIds[0]!
  const title = cardTitle(card)

  return (
    <Card padding="sm" role="article" className={styles.wish}>
      {/* La vignette double le lien du titre : cachée au clavier et aux lecteurs d'écran. */}
      <Link to={speciesPath(speciesId)} className={styles.wishArt} tabIndex={-1} aria-hidden="true">
        <CardArt card={card} speciesId={speciesId} alt="">
          <PossessionMark status={status} />
        </CardArt>
      </Link>

      <div className={styles.wishBody}>
        <header className={styles.wishHead}>
          <h2 className={styles.wishTitle}>
            <Link to={speciesPath(speciesId)}>{title}</Link>
          </h2>
          <span className="muted numeric">{formatDexNumber(speciesId)}</span>
        </header>
        <p className={styles.wishReference}>{card.reference}</p>

        <dl className={styles.wishPrices}>
          <div>
            <dt>Marché</dt>
            <dd>{priceLabel(price)}</dd>
          </div>
          <div>
            <dt>Maximum</dt>
            <dd>{preference.maxPrice === undefined ? 'Aucun' : formatEuro(preference.maxPrice)}</dd>
          </div>
        </dl>

        <div className={styles.wishBadges}>
          <Badge size="sm" tone={PRIORITY_TONES[preference.priority]}>
            Priorité {PRIORITY_LABELS[preference.priority].toLowerCase()}
          </Badge>
          {status && (
            <Badge size="sm" tone={status === 'owned' ? 'success' : 'info'}>
              {statusLabel(status)}
            </Badge>
          )}
          <PriceVerdict price={price} maxPrice={preference.maxPrice} />
          <PriceDrop change={row.change30} />
        </div>

        {preference.note && <p className={styles.wishNote}>{preference.note}</p>}
      </div>

      {/* Le pied de la carte, sur toute sa largeur : le lien et les actions ne se serrent pas. */}
      <div className={styles.wishActions}>
        <CardmarketLink card={card} className={styles.wishLink} />
        <IconButton
          label={`Régler l’achat de ${title}, ${card.reference}`}
          size="sm"
          variant="ghost"
          onClick={onEdit}
        >
          <Pencil size={15} />
        </IconButton>
        <IconButton
          label={`Retirer ${title}, ${card.reference}, de la liste d’achats`}
          size="sm"
          variant="ghost"
          onClick={onRemove}
        >
          <X size={15} />
        </IconButton>
      </div>
    </Card>
  )
}
