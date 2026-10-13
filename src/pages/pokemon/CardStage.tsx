import { CardArt } from '@/components/CardArt'
import { ExternalLink } from '@/components/ExternalLink'
import { isPokecardexImage, POKECARDEX } from '@/lib/card-images'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import styles from './CardStage.module.css'

/**
 * La carte du Pokémon en grand, ou une pochette vide tant qu'il n'en a pas. Une image de Pokécardex
 * le cite, avec un lien : la condition de son autorisation.
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
      {card.image && isPokecardexImage(card.image) && (
        <figcaption className={styles.caption}>
          Image : <ExternalLink href={POKECARDEX}>Pokécardex</ExternalLink>
        </figcaption>
      )}
    </figure>
  )
}
