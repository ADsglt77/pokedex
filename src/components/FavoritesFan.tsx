import { useMemo } from 'react'
import { CardArt } from '@/components/CardArt'
import { artworkUrl } from '@/config/pokedex'
import { showsImage } from '@/lib/card-images'
import type { PokedexEntry } from '@/lib/pokedex'
import type { PokemonCard } from '@/types'
import styles from './FavoritesFan.module.css'

/** Les Pokémon de départ de Kanto (Bulbizarre, Salamèche, Carapuce) : l'image d'un Pokédex vide. */
const STARTERS = [1, 4, 7]

/**
 * Le dessin d'un Pokédex (`entries`) : trois de ses cartes favorites en éventail, celles des
 * Pokémon débloqués d'abord, dans l'ordre du Pokédex (une carte TAG TEAM une fois) ; sans carte à
 * montrer, les trois Pokémon de départ. Décoratif. À la hauteur de son parent : la tuile Pokédex
 * des Collections, l'en-tête du Pokédex public (D-07) ; `eager` en haut d'une page, à l'écran dès
 * l'ouverture.
 */
export function FavoritesFan({ entries, eager }: { entries: PokedexEntry[]; eager?: boolean }) {
  const cards = useMemo(() => {
    const favorites = new Map<string, PokemonCard>()
    for (const unlocked of [true, false]) {
      for (const entry of entries) {
        const card = entry.card?.card
        if (entry.unlocked === unlocked && card && showsImage(card.image)) {
          favorites.set(card.id, card)
        }
        if (favorites.size === 3) return [...favorites.values()]
      }
    }
    return [...favorites.values()]
  }, [entries])
  return (
    <span className={styles.fan} aria-hidden="true">
      {cards.length > 0
        ? cards.map((card) => (
            <CardArt key={card.id} card={card} alt="" eager={eager} className={styles.fanCard} />
          ))
        : STARTERS.map((id) => (
            <img
              key={id}
              src={artworkUrl(id)}
              alt=""
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              className={styles.starter}
            />
          ))}
    </span>
  )
}
