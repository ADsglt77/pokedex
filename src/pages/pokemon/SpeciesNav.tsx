import { Button } from '@camply/ui'
import { ArrowLeft } from '@camply/ui/icons'
import { Link } from 'react-router'
import { pokedexHref } from '@/hooks/usePokedexFilters'
import { formatDexNumber } from '@/lib/format'
import type { PokemonSpecies } from '@/types'
import styles from './SpeciesNav.module.css'

interface SpeciesNavProps {
  previous: PokemonSpecies | null
  next: PokemonSpecies | null
}

/** Retour au Pokédex (filtres conservés) et Pokémon voisins. */
export function SpeciesNav({ previous, next }: SpeciesNavProps) {
  return (
    <nav aria-label="Navigation entre les Pokémon" className={styles.nav}>
      <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
        <Link to={pokedexHref()}>Pokédex</Link>
      </Button>
      <div className={styles.neighbours}>
        <Neighbour species={previous} rel="prev" edge="Début du Pokédex" />
        <Neighbour species={next} rel="next" edge="Fin du Pokédex" />
      </div>
    </nav>
  )
}

function Neighbour({
  species,
  rel,
  edge,
}: {
  species: PokemonSpecies | null
  rel: 'prev' | 'next'
  edge: string
}) {
  if (!species) return <span className={styles.edge}>{edge}</span>
  return (
    <Link
      to={`/pokemon/${species.id}`}
      rel={rel}
      className={styles.neighbour}
      aria-label={`${rel === 'prev' ? 'Pokémon précédent' : 'Pokémon suivant'} : ${species.names.fr}`}
    >
      <span className={styles.number}>
        {rel === 'prev' && '← '}
        {formatDexNumber(species.id)}
        {rel === 'next' && ' →'}
      </span>
      <span className={styles.neighbourName}>{species.names.fr}</span>
    </Link>
  )
}
