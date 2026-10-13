import { useState, type ReactNode } from 'react'
import { spriteUrl } from '@/config/pokedex'
import { cx } from '@/lib/cx'
import type { CardImage, PokemonCard } from '@/types'
import styles from './CardArt.module.css'

interface CardArtProps {
  /** `null` : aucune carte connue, on montre une pochette vide. */
  card: Pick<PokemonCard, 'image' | 'reference'> | null
  /** L'image à prendre si celle de la carte ne se charge pas (TCGplayer, quand Pokécardex ne l'a pas). */
  fallback?: CardImage | null
  speciesId: number
  alt: string
  /** `large` charge le scan haute définition. */
  large?: boolean
  /** Pokémon pas encore débloqué : carte en gris. */
  locked?: boolean
  eager?: boolean
  /** Contenu posé sur la carte (marque de possession…). */
  children?: ReactNode
  className?: string
}

/**
 * Une carte aux proportions réelles (63 × 88). Sans scan : une carte de substitution avec le
 * sprite et la référence. Sans carte : une pochette vide. Une image n'est jamais inventée.
 * Faite de `span` : elle peut se trouver dans un lien (tuile du Pokédex).
 */
export function CardArt({
  card,
  fallback,
  speciesId,
  alt,
  large,
  locked,
  eager,
  children,
  className,
}: CardArtProps) {
  // Une image qui ne se charge pas laisse place à la suivante, puis à la carte de substitution.
  const [failed, setFailed] = useState<string[]>([])
  const src =
    [card?.image, fallback]
      .flatMap((image) => (image ? [large ? image.large : image.small] : []))
      .find((source) => !failed.includes(source)) ?? null
  const showScan = src !== null

  return (
    <span
      className={cx(
        styles.card,
        !showScan && styles.proxy,
        !card && styles.empty,
        locked && styles.locked,
        className,
      )}
    >
      {showScan ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed((list) => [...list, src])}
          className={styles.scan}
        />
      ) : (
        <span
          className={styles.placeholder}
          {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
        >
          <img src={spriteUrl(speciesId)} alt="" loading="lazy" className={styles.sprite} />
          {card && (
            <>
              <span className={styles.reference}>{card.reference}</span>
              <span className={styles.note}>Pas d’image</span>
            </>
          )}
        </span>
      )}
      {children}
    </span>
  )
}
