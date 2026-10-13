import { CardArt } from '@/components/CardArt'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import styles from './CardStage.module.css'

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
      {/* Une clé par carte : changer de carte rejoue l'arrivée. */}
      <CardArt
        key={card.id}
        card={card}
        speciesId={species.id}
        alt={`Carte ${card.reference} de ${species.names.fr}`}
        large
        eager
        className={styles.card}
      />
    </figure>
  )
}
