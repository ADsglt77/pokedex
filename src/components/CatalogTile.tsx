import { Skeleton } from '@camply/ui'
import { Children, memo, type ReactNode, type Ref } from 'react'
import { CardArt } from '@/components/CardArt'
import { RarityIcon } from '@/components/CatalogIcons'
import { useGrowingList } from '@/hooks/useGrowingList'
import type { CatalogCard } from '@/lib/card-catalog'
import { cx } from '@/lib/cx'
import styles from './CatalogTile.module.css'

type TileCard = Pick<CatalogCard, 'image' | 'reference' | 'rarity'>

/**
 * Une carte du catalogue, serrée : son image ; sur une ligne `heading` (« SV2A 166 », ou « 166 »
 * dans une seule extension) et son prix Cardmarket du jour (une ébauche tant que les prix
 * arrivent) ; sur la suivante, sa rareté et ce qu'on veut dire de plus (`children` : son nom, ses
 * autres Pokémon…). Un bouton : `pressed` pour la carte choisie.
 */
function Tile<C extends TileCard>({
  card,
  heading,
  price,
  speciesId,
  pressed,
  onPick,
  children,
}: {
  card: C
  heading: string
  /**
   * Son prix du jour, écrit (`priceText` : « 12,40 € », « Sans prix », « — » sans prix
   * disponibles) ; `null` tant que les prix arrivent.
   */
  price: string | null
  /** Son Pokémon (le sprite d'une carte sans image) ; aucun pour un dresseur, une énergie. */
  speciesId?: number
  pressed?: boolean
  /** Reçoit la carte ; une fonction stable, sans quoi chaque tuile se redessine. */
  onPick: (card: C) => void
  children?: ReactNode
}) {
  // Pas d'`aria-label` : le texte de la tuile la nomme, `children` compris.
  return (
    <button
      type="button"
      className={styles.choice}
      aria-pressed={pressed}
      onClick={() => onPick(card)}
    >
      <CardArt card={card} speciesId={speciesId} alt="" className={styles.art} />
      <span className={styles.line}>
        <span className={styles.code}>{heading}</span>
        <span className={styles.price}>{price ?? <Skeleton variant="text" width="2.75rem" />}</span>
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
 * Mémoïsée : une grille de centaines de tuiles (une frappe dans la recherche, un filtre, une fiche
 * ouverte) ne redessine que celles dont quelque chose change.
 */
export const CatalogTile = memo(Tile) as typeof Tile

/** Les cartes dessinées d'un coup : plus qu'un grand écran n'en montre. */
const TILES_STEP = 60

/**
 * La grille des cartes du catalogue (une liste : chaque carte dans un `li`). `wide` : des cartes de
 * plusieurs extensions, dont le code (« SV2A 166 ») et le prix tiennent sur une ligne. Une
 * extension, un Pokémon comptent jusqu'à des centaines de cartes : elles sont dessinées au fur et
 * à mesure du défilement (`useGrowingList`) ; une grille montée de nouveau (`key`, une autre
 * extension) repart des premières.
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
  const tiles = Children.toArray(children)
  const { limit, end } = useGrowingList(tiles.length, TILES_STEP)
  return (
    <div className="growing">
      <ul ref={ref} className={cx(styles.grid, wide && styles.wide)}>
        {tiles.slice(0, limit)}
      </ul>
      {end}
    </div>
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
