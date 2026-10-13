import type { ReactNode } from 'react'
import { CardArt } from '@/components/CardArt'
import type { CatalogCard } from '@/lib/card-catalog'
import { cardImage } from '@/lib/card-images'
import { formatEuro } from '@/lib/format'
import styles from './CatalogTile.module.css'

/**
 * Une carte du catalogue à choisir : son image (Pokécardex), son extension, son numéro et son
 * année, son prix du jour, et ce qu'on veut dire de plus (`children` : le Pokémon, « déjà une
 * carte »…). Un bouton : `pressed` pour la carte choisie, `disabled` quand on ne peut pas la prendre.
 */
export function CatalogTile({
  card,
  price,
  speciesId,
  pressed,
  disabled,
  onPick,
  children,
}: {
  card: CatalogCard
  price: number | null
  speciesId: number
  pressed?: boolean
  disabled?: boolean
  onPick: () => void
  children?: ReactNode
}) {
  const priceText = price === null ? 'Sans prix' : formatEuro(price)
  return (
    <button
      type="button"
      className={styles.choice}
      aria-pressed={pressed}
      disabled={disabled}
      aria-label={`${card.reference}, ${priceText}`}
      onClick={onPick}
    >
      <CardArt
        card={{ image: cardImage(card.reference), reference: card.reference }}
        speciesId={speciesId}
        alt=""
      />
      <span className={styles.code}>
        {card.key}
        {card.set.year && <span className={styles.year}> · {card.set.year}</span>}
      </span>
      <span className={styles.price}>{priceText}</span>
      {children}
    </button>
  )
}

/** La grille des cartes du catalogue (une liste : chaque carte dans un `li`). */
export function CatalogGrid({ children }: { children: ReactNode }) {
  return <ul className={styles.grid}>{children}</ul>
}
