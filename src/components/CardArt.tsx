import { useState, type ReactNode } from 'react'
import { spriteUrl } from '@/config/pokedex'
import { localSrc } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import type { PokemonCard } from '@/types'
import styles from './CardArt.module.css'

interface CardArtProps {
  /** `null` : aucune carte connue, on montre une pochette vide. */
  card: Pick<PokemonCard, 'image' | 'reference'> | null
  /** Son Pokémon, dont le sprite orne la carte de substitution ; aucun pour un dresseur, une énergie. */
  speciesId?: number
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
  speciesId,
  alt,
  large,
  locked,
  eager,
  children,
  className,
}: CardArtProps) {
  // Une image qui ne se charge pas (adresse collée disparue…) laisse place à la carte de
  // substitution.
  const [failed, setFailed] = useState<string | null>(null)
  const image = card?.image
  const src = image ? localSrc(large ? image.large : image.small) : null
  const showScan = src !== null && src !== failed

  return (
    <span
      className={cx(
        styles.card,
        !showScan && styles.proxy,
        !card && styles.empty,
        large && styles.large,
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
          onError={() => setFailed(src)}
          className={styles.scan}
        />
      ) : (
        <span
          className={styles.placeholder}
          {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
        >
          {speciesId !== undefined && (
            <img
              src={spriteUrl(speciesId)}
              alt=""
              loading="lazy"
              decoding="async"
              className={styles.sprite}
            />
          )}
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
