import { Fragment } from 'react'
import { Link } from 'react-router'
import { speciesPath } from '@/lib/filters'
import { getSpecies } from '@/lib/species'

/**
 * Les Pokémon d'une carte, chacun vers sa fiche : « Pikachu et Zekrom » (la fenêtre d'une carte
 * d'une collection, `SeriesCard` ; la fiche d'une carte du catalogue, `CardDetails`).
 */
export function SpeciesLinks({ ids }: { ids: number[] }) {
  return ids.map((id, index) => (
    <Fragment key={id}>
      {index > 0 && (index === ids.length - 1 ? ' et ' : ', ')}
      <Link to={speciesPath(id)}>{getSpecies(id)!.names.fr}</Link>
    </Fragment>
  ))
}
