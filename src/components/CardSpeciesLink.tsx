import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { speciesPath } from '@/lib/filters'
import type { PokemonCard } from '@/types'

/**
 * Le lien d'une carte vers la fiche de son Pokémon (le premier d'une carte TAG TEAM) ; une carte
 * sans Pokémon (un dresseur, une énergie) n'a pas de fiche : son seul texte.
 */
export function CardSpeciesLink({
  card,
  className,
  children,
}: {
  card: Pick<PokemonCard, 'dexIds'>
  className?: string
  children: ReactNode
}) {
  const [speciesId] = card.dexIds
  return speciesId === undefined ? (
    <span className={className}>{children}</span>
  ) : (
    <Link to={speciesPath(speciesId)} className={className}>
      {children}
    </Link>
  )
}
