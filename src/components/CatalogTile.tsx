import { Skeleton } from '@camply/ui'
import type { ReactNode, Ref } from 'react'
import { CardArt } from '@/components/CardArt'
import { RarityIcon } from '@/components/CatalogIcons'
import { PricedValue } from '@/components/PricedValue'
import type { CatalogCard } from '@/lib/card-catalog'
import { cx } from '@/lib/cx'
import { priceLabel } from '@/lib/prices'
import type { CardPrice } from '@/types'
import styles from './CatalogTile.module.css'

/**
 * Une carte du catalogue à choisir, serrée : son image ; sur une ligne `heading` (« SV2A 166 », ou
 * « 166 » dans une seule extension) et son prix Cardmarket du jour (une ébauche tant que les prix
 * arrivent) ; sur la suivante, sa rareté et ce qu'on veut dire de plus (`children` : le Pokémon,
 * « déjà une carte »…).
 * Un bouton : `pressed` pour la carte choisie, `disabled` quand on ne peut pas la prendre.
 */
export function CatalogTile({
  card,
  heading,
  price,
  speciesId,
  pressed,
  disabled,
  onPick,
  children,
}: {
  card: CatalogCard
  heading: string
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
      <span className={styles.line}>
        <span className={styles.code}>{heading}</span>
        <span className={styles.price}>
          <PricedValue text>{priceLabel(price?.price ?? null)}</PricedValue>
        </span>
      </span>
      {(card.rarity || children) && (
        <span className={styles.line}>
          {card.rarity && <RarityIcon rarity={card.rarity} />}
          {children && <span className={styles.extra}>{children}</span>}
        </span>
      )}
    </button>
  )
}

/**
 * La grille des cartes du catalogue (une liste : chaque carte dans un `li`). `wide` : des cartes de
 * plusieurs extensions, dont le code (« SV2A 166 ») et le prix tiennent sur une ligne.
 */
export function CatalogGrid({
  children,
  wide = false,
  ref,
}: {
  children: ReactNode
  wide?: boolean
  ref?: Ref<HTMLUListElement>
}) {
  return (
    <ul ref={ref} className={cx(styles.grid, wide && styles.wide)}>
      {children}
    </ul>
  )
}

/**
 * La grille tant que le catalogue arrive : `count` cartes en ébauche, à la taille des vraies (la
 * page ne saute pas à leur arrivée).
 */
export function CatalogGridSkeleton({ count }: { count: number }) {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={styles.skeleton}>
          <Skeleton variant="rect" className={styles.skeletonArt} />
          <Skeleton width="70%" />
        </li>
      ))}
    </ul>
  )
}
