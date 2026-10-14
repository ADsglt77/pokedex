import { Button } from '@camply/ui'
import { ArrowLeft, ArrowRight } from '@camply/ui/icons'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { pokedexHref } from '@/hooks/usePokedexFilters'
import { formatDexNumber } from '@/lib/format'
import type { PokemonSpecies } from '@/types'
import styles from './SpeciesNav.module.css'

interface SpeciesNavProps {
  previous: PokemonSpecies | null
  next: PokemonSpecies | null
  /** Le prochain Pokémon sans carte, pour en ajouter à la suite ; `null` s'il n'y en a plus. */
  nextWithoutCard: PokemonSpecies | null
}

/**
 * Retour au Pokédex (filtres conservés), Pokémon voisins (aussi au clavier, ← et →) et prochain
 * Pokémon sans carte.
 */
export function SpeciesNav({ previous, next, nextWithoutCard }: SpeciesNavProps) {
  const navigate = useNavigate()

  // ← et → changent de Pokémon, sauf dans un champ ou une fenêtre ouverte, ou quand un réglage s'en
  // est déjà servi (« Achat », « Priorité » : un choix au clavier ne doit pas quitter la page).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const busy =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [role=listbox]')
      if (
        busy ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return
      const target = event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : null
      if (!target || document.querySelector('[role=dialog]')) return
      event.preventDefault()
      navigate(`/pokemon/${target.id}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previous, next, navigate])

  return (
    <nav aria-label="Navigation entre les Pokémon" className={styles.nav}>
      <div className={styles.links}>
        <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft size={16} />}>
          <Link to={pokedexHref()}>Pokédex</Link>
        </Button>
        {nextWithoutCard && (
          <Button asChild variant="soft" size="sm" rightIcon={<ArrowRight size={16} />}>
            <Link to={`/pokemon/${nextWithoutCard.id}`}>
              Suivant sans carte : {nextWithoutCard.names.fr}
            </Link>
          </Button>
        )}
      </div>
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
