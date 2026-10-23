import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cardPath } from '@/lib/filters'
import type { PokemonCard, SeriesCollection } from '@/types'

/**
 * Le lien d'une carte vers sa page (`cardPath`) : la fiche de son Pokémon, ou la page de sa
 * collection d'extension (`series`), sa fenêtre ouverte, pour une case pas encore obtenue ou une
 * carte sans Pokémon ; une carte sans Pokémon ni collection n'a pas de page : son seul texte.
 */
export function CardPageLink({
  card,
  series,
  className,
  children,
}: {
  card: PokemonCard
  series: SeriesCollection | null
  className?: string
  children: ReactNode
}) {
  const path = cardPath(card, series)
  return path === null ? (
    <span className={className}>{children}</span>
  ) : (
    <Link to={path} className={className}>
      {children}
    </Link>
  )
}
