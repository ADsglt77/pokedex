import { CardArt } from '@/components/CardArt'
import type { CardView } from '@/lib/candidates'
import type { PokemonSpecies } from '@/types'
import styles from './CardStage.module.css'

/** La carte affichée en grand, ou une pochette vide quand aucune n'est candidate. */
export function CardStage({
  candidate,
  species,
}: {
  candidate: CardView | null
  species: PokemonSpecies
}) {
  if (!candidate) {
    return (
      <figure className={styles.stage}>
        <CardArt image={null} hasCard={false} speciesId={species.id} alt="" large />
        <figcaption className={styles.caption}>Illustration à rechercher</figcaption>
      </figure>
    )
  }

  const { card } = candidate
  return (
    <figure className={styles.stage}>
      {/* Une clé par carte : changer de carte rejoue l'arrivée. */}
      <CardArt
        key={card.id}
        image={card.image}
        hasCard
        speciesId={species.id}
        reference={card.reference}
        alt={`Carte ${card.reference} de ${species.names.fr}`}
        large
        eager
        className={styles.card}
      />
    </figure>
  )
}
