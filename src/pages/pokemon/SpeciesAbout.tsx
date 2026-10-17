import { DescriptionList, SkeletonText } from '@camply/ui'
import { Suspense, use } from 'react'
import { Panel } from '@/components/Panel'
import { artworkUrl, generationById } from '@/config/pokedex'
import { loadSpeciesDetails } from '@/lib/species'
import { formatDecimal } from '@/lib/format'
import type { PokemonSpecies, PokemonSpeciesDetails } from '@/types'
import styles from './SpeciesAbout.module.css'

function category(details: PokemonSpeciesDetails): string | null {
  const status = details.isLegendary
    ? 'légendaire'
    : details.isMythical
      ? 'fabuleux'
      : details.isBaby
        ? 'bébé'
        : null
  if (!details.genus) return status && `Pokémon ${status}`
  return status ? `${details.genus}, ${status}` : details.genus
}

/** « Dans le Pokédex » : ce que dit le jeu de l'espèce. */
export function SpeciesAbout({
  species,
  showArtwork,
}: {
  species: PokemonSpecies
  showArtwork: boolean
}) {
  return (
    <Panel title="Dans le Pokédex">
      {/* Sans carte, l'illustration officielle — clairement présentée comme telle. */}
      {showArtwork && (
        <figure className={styles.artwork}>
          <img
            src={artworkUrl(species.id)}
            alt={`Illustration officielle de ${species.names.fr}`}
            loading="lazy"
          />
          <figcaption>Illustration officielle. Ce n’est pas une carte.</figcaption>
        </figure>
      )}

      <Suspense fallback={<SkeletonText lines={4} />}>
        <SpeciesDetails species={species} />
      </Suspense>
    </Panel>
  )
}

function SpeciesDetails({ species }: { species: PokemonSpecies }) {
  const details = use(loadSpeciesDetails()).get(species.id)
  const generation = generationById(species.generation)!
  const measure = (value: number | null | undefined, unit: string) =>
    value ? `${formatDecimal(value)} ${unit}` : '—'

  return (
    <>
      <DescriptionList
        divided
        items={[
          { term: 'Catégorie', description: (details && category(details)) ?? '—' },
          {
            term: 'Région',
            description: `${generation.region}, génération ${generation.numeral}`,
          },
          { term: 'Taille', description: measure(details?.heightM, 'm') },
          { term: 'Poids', description: measure(details?.weightKg, 'kg') },
        ]}
      />
      {details?.description && <p className={styles.description}>{details.description}</p>}
    </>
  )
}
