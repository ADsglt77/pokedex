import { Badge, Card, IconButton } from '@camply/ui'
import { ExternalLink as ExternalIcon, Pencil, Star, X } from '@camply/ui/icons'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { ExternalLink } from '@/components/ExternalLink'
import { PossessionMark } from '@/components/PossessionMark'
import { RarityTag } from '@/components/RarityTag'
import { PRIORITY_LABELS } from '@/config/shopping'
import { formatDexNumber, formatEuro, statusLabel } from '@/lib/format'
import { cardTitle } from '@/lib/catalog'
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
      <Link
        to={`/pokemon/${speciesId}`}
        className={styles.wishArt}
        tabIndex={-1}
        aria-hidden="true"
      >
        <CardArt card={card} speciesId={speciesId} alt="">
          <PossessionMark status={status} />
        </CardArt>
      </Link>

      <div className={styles.wishBody}>
        <header className={styles.wishHead}>
          <h2 className={styles.wishTitle}>
            <Link to={`/pokemon/${speciesId}`}>{title}</Link>
          </h2>
          <span className="muted numeric">{formatDexNumber(speciesId)}</span>
        </header>
        <p className={styles.wishSet}>
          <span>{card.reference}</span>
          <RarityTag card={card} />
          {card.set?.name && (
            <span className="muted" lang="ja">
              {card.set.name}
            </span>
          )}
        </p>

        <dl className={styles.wishPrices}>
          <div>
            <dt>Marché</dt>
            <dd>{price === null ? 'Sans prix' : formatEuro(price)}</dd>
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
          {row.isFavorite && (
            <Badge size="sm" tone="accent" icon={<Star size={10} fill="currentColor" />}>
              Illustration choisie
            </Badge>
          )}
          {status && status !== 'wanted' && (
            <Badge size="sm" tone={status === 'owned' ? 'success' : 'info'}>
              {statusLabel(status)}
            </Badge>
          )}
          <PriceVerdict price={price} maxPrice={preference.maxPrice} />
        </div>

        {preference.note && <p className={styles.wishNote}>{preference.note}</p>}

        <div className={styles.wishActions}>
          {preference.link && (
            <ExternalLink href={preference.link} className={styles.wishLink}>
              Page Cardmarket <ExternalIcon size={13} aria-hidden="true" />
            </ExternalLink>
          )}
          <IconButton
            label={`Modifier ${title}, ${card.reference}`}
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
      </div>
    </Card>
  )
}
