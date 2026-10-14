import type { ReactNode, Ref } from 'react'
import { CardArt } from '@/components/CardArt'
import { ExternalLink } from '@/components/ExternalLink'
import type { CatalogCard } from '@/lib/card-catalog'
import { POKECARDEX } from '@/lib/card-images'
import { formatEuro } from '@/lib/format'
import type { CardPrice } from '@/types'
import styles from './CatalogTile.module.css'

/**
 * Une carte du catalogue à choisir : son image (Pokécardex), sa série, son numéro et son année, son
 * prix Cardmarket du jour, et ce qu'on veut dire de plus (`children` : le Pokémon, « déjà une
 * carte »…). Un bouton : `pressed` pour la carte choisie, `disabled` quand on ne peut pas
 * la prendre.
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
  price: CardPrice | null
  speciesId: number
  pressed?: boolean
  disabled?: boolean
  onPick: () => void
  children?: ReactNode
}) {
  // Pas d'`aria-label` : le texte de la tuile la nomme, `children` compris (« Choisir pour… »).
  return (
    <button
      type="button"
      className={styles.choice}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPick}
    >
      <CardArt card={card} speciesId={speciesId} alt="" className={styles.art} />
      <span className={styles.code}>
        {card.key}
        {card.set.year && <span className={styles.year}> · {card.set.year}</span>}
      </span>
      <span className={styles.price}>{price === null ? 'Sans prix' : formatEuro(price.price)}</span>
      {children && <span className={styles.extra}>{children}</span>}
    </button>
  )
}

/** La grille des cartes du catalogue (une liste : chaque carte dans un `li`). */
export function CatalogGrid({
  children,
  ref,
}: {
  children: ReactNode
  ref?: Ref<HTMLUListElement>
}) {
  return (
    <ul ref={ref} className={styles.grid}>
      {children}
    </ul>
  )
}

/** D'où viennent les images de la grille, avec un lien (en tête de grille). */
export function CatalogCredit() {
  return (
    <>
      images <ExternalLink href={POKECARDEX}>Pokécardex</ExternalLink>
    </>
  )
}
