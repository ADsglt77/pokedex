import type { PointerEvent } from 'react'
import { CardArt } from '@/components/CardArt'
import { ImageCredit } from '@/components/ImageCredit'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import styles from './CardStage.module.css'

/** L'inclinaison la plus forte, en degrés, la souris au bord de la carte. */
const TILT = 7

/**
 * La carte suit la souris, comme tenue en main, et la lumière y glisse. Pas au toucher (le doigt
 * fait défiler la page), ni quand l'utilisateur demande moins de mouvement. Les positions passent
 * par des variables CSS, sans redessiner React à chaque mouvement.
 */
function tilt(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  const holder = event.currentTarget
  const { left, top, width, height } = holder.getBoundingClientRect()
  const x = (event.clientX - left) / width
  const y = (event.clientY - top) / height
  holder.style.setProperty('--tilt-x', `${((0.5 - y) * 2 * TILT).toFixed(2)}deg`)
  holder.style.setProperty('--tilt-y', `${((x - 0.5) * 2 * TILT).toFixed(2)}deg`)
  holder.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`)
  holder.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`)
  holder.dataset.tilting = ''
}

/** La souris partie, la carte se repose. */
function release(event: PointerEvent<HTMLDivElement>) {
  const holder = event.currentTarget
  delete holder.dataset.tilting
  for (const name of ['--tilt-x', '--tilt-y']) holder.style.removeProperty(name)
}

/**
 * La carte du Pokémon en grand, ou une pochette vide tant qu'il n'en a pas. Son image cite sa
 * source (Pokécardex, la condition de son autorisation), avec un lien.
 */
export function CardStage({ view, species }: { view: CardView | null; species: PokemonSpecies }) {
  if (!view) {
    return (
      <figure className={styles.stage}>
        <CardArt card={null} speciesId={species.id} alt="" large />
        <figcaption className={styles.caption}>Carte à choisir</figcaption>
      </figure>
    )
  }

  const { card } = view
  return (
    <figure className={styles.stage}>
      <div className={styles.holder} onPointerMove={tilt} onPointerLeave={release}>
        {/* Une clé par carte : changer de carte rejoue l'arrivée. */}
        <CardArt
          key={card.id}
          card={card}
          speciesId={species.id}
          alt={`Carte ${card.reference} de ${species.names.fr}`}
          large
          eager
          className={styles.card}
        >
          <span className={styles.glare} aria-hidden="true" />
        </CardArt>
      </div>
      <ImageCredit image={card.image} />
    </figure>
  )
}
