import { Breadcrumbs } from '@camply/ui'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { pokedexHref } from '@/hooks/usePokedexFilters'
import { generationById } from '@/config/pokedex'
import { pokedexUrl, speciesPath } from '@/lib/filters'
import { shortcutBlocked } from '@/lib/focus'
import { formatDexNumber } from '@/lib/format'
import type { PokemonSpecies } from '@/types'
import styles from './SpeciesNav.module.css'

interface SpeciesNavProps {
  species: PokemonSpecies
  previous: PokemonSpecies | null
  next: PokemonSpecies | null
}

/**
 * Où l'on est (Pokédex, filtres conservés › région › Pokémon) et les Pokémon voisins
 * (aussi au clavier, ← et →).
 */
export function SpeciesNav({ species, previous, next }: SpeciesNavProps) {
  const navigate = useNavigate()

  // ← et → changent de Pokémon, sauf dans un champ ou une fenêtre ouverte, ou quand un réglage s'en
  // est déjà servi (un choix au clavier ne doit pas quitter la page).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shortcutBlocked(event) || event.shiftKey) return
      const target = event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : null
      if (!target) return
      event.preventDefault()
      navigate(speciesPath(target.id))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previous, next, navigate])

  return (
    <div className={styles.nav}>
      <div className={styles.links}>
        {/* Des liens du routeur dans les libellés : camply ferait des liens qui rechargent la page. */}
        <Breadcrumbs
          className={styles.crumbs}
          items={[
            {
              label: (
                <Link to={pokedexHref()} className="quiet-link">
                  Pokédex
                </Link>
              ),
            },
            {
              label: (
                <Link to={pokedexUrl({ generation: species.generation })} className="quiet-link">
                  {generationById(species.generation)!.region}
                </Link>
              ),
            },
            { label: species.names.fr },
          ]}
        />
      </div>
      <nav aria-label="Pokémon voisins" className={styles.neighbours}>
        <Neighbour species={previous} rel="prev" edge="Début du Pokédex" />
        <Neighbour species={next} rel="next" edge="Fin du Pokédex" />
      </nav>
    </div>
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
      to={speciesPath(species.id)}
      rel={rel}
      className={styles.neighbour}
      aria-label={`${rel === 'prev' ? 'Pokémon précédent' : 'Pokémon suivant'} : ${species.names.fr}, ${formatDexNumber(species.id)}`}
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
