import type { PointerEvent } from 'react'
import { CardArt } from '@/components/CardArt'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import styles from './CardStage.module.css'

/** L'inclinaison la plus forte, en degrés, la souris au bord de la carte. */
const TILT = 7

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** La souris sur la carte : sa dernière position et l'image demandée. */
let moving: { frame: number; x: number; y: number } | null = null

/**
 * La carte suit la souris, comme tenue en main, et la lumière y glisse. Pas au toucher (le doigt
 * fait défiler la page), ni quand l'utilisateur demande moins de mouvement. Les positions passent
 * par des variables CSS, sans redessiner React à chaque mouvement ; une fois par image affichée (la
 * place de la carte mesurée à chaque mouvement forçait autant de mises en page).
 */
function tilt(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse' || reducedMotion.matches) return
  const holder = event.currentTarget
  moving ??= { frame: 0, x: 0, y: 0 }
  moving.x = event.clientX
  moving.y = event.clientY
  if (moving.frame) return
  moving.frame = requestAnimationFrame(() => {
    if (!moving) return
    const { left, top, width, height } = holder.getBoundingClientRect()
    const x = (moving.x - left) / width
    const y = (moving.y - top) / height
    moving.frame = 0
    holder.style.setProperty('--tilt-x', `${((0.5 - y) * 2 * TILT).toFixed(2)}deg`)
    holder.style.setProperty('--tilt-y', `${((x - 0.5) * 2 * TILT).toFixed(2)}deg`)
    holder.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`)
    holder.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`)
    holder.dataset.tilting = ''
  })
}

/** La souris partie, la carte se repose. */
function release(event: PointerEvent<HTMLDivElement>) {
  if (moving) cancelAnimationFrame(moving.frame)
  moving = null
  const holder = event.currentTarget
  delete holder.dataset.tilting
  for (const name of ['--tilt-x', '--tilt-y']) holder.style.removeProperty(name)
}

/** La carte du Pokémon en grand, ou une pochette vide tant qu'il n'en a pas. */
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
    </figure>
  )
}
