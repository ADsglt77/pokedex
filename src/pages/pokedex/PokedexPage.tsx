import { Button, EmptyState } from '@camply/ui'
import { Layers, SearchX } from '@camply/ui/icons'
import { useDeferredValue, useMemo, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { usePokedex } from '@/hooks/usePokedex'
import { usePokedexFilters } from '@/hooks/usePokedexFilters'
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filterEntries,
  POSSESSIONS,
  type PossessionFilter,
} from '@/lib/filters'
import { formatInteger, pageTitle, plural } from '@/lib/format'
import { PokedexGrid } from '@/components/PokedexGrid'
import { PokedexToolbar } from './PokedexToolbar'

/**
 * Le classeur : les 1 025 Pokémon, filtrés par la barre d'outils (filtres dans l'adresse). Chaque
 * filtre rapide dit combien de Pokémon il montrerait, les autres filtres appliqués.
 */
export function PokedexPage() {
  const pokedex = usePokedex()
  const [filters, setFilters] = usePokedexFilters()
  // La grille suit la saisie dès que le navigateur a le temps : la frappe reste fluide.
  const shownFilters = useDeferredValue(filters)
  const visible = useMemo(
    () => filterEntries(pokedex.entries, shownFilters),
    [pokedex.entries, shownFilters],
  )
  const counts = useMemo(
    () =>
      Object.fromEntries(
        POSSESSIONS.map((possession) => [
          possession,
          filterEntries(pokedex.entries, { ...shownFilters, possession }).length,
        ]),
      ) as Record<PossessionFilter, number>,
    [pokedex.entries, shownFilters],
  )
  const filtering = filters.search.trim() !== '' || activeFilterCount(filters) > 0
  const resetFilters = () => setFilters(DEFAULT_FILTERS)
  const navigate = useNavigate()

  // Les pochettes sont de simples liens (`PokedexTile`) : un clic ordinaire sur l'une d'elles
  // (Entrée au clavier en est un) passe par le routeur, sans recharger la page ; avec Ctrl, ⌘, Maj
  // ou Alt, le navigateur fait comme pour tout lien (nouvel onglet…).
  const followTile = (event: MouseEvent) => {
    const link = (event.target as Element).closest('a')
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      link.hasAttribute('download')
    ) {
      return
    }
    event.preventDefault()
    navigate(link.getAttribute('href')!)
  }

  return (
    <div className="container">
      <title>{pageTitle('Pokédex')}</title>
      <PageHeader
        title="Pokédex"
        actions={
          <Button asChild variant="secondary" leftIcon={<Layers size={16} />}>
            <Link to="/catalogue">Choisir par extension</Link>
          </Button>
        }
      >
        Les {formatInteger(pokedex.progress.total)} Pokémon et leur carte :{' '}
        {plural(pokedex.progress.unlocked, 'débloqué', 'débloqués')}. Ouvrez-en un pour lui choisir
        sa carte.
      </PageHeader>

      <PokedexToolbar
        filters={filters}
        setFilters={setFilters}
        generations={pokedex.generations}
        counts={counts}
        resultCount={filtering ? visible.length : null}
        onReset={resetFilters}
      />

      {visible.length > 0 ? (
        // Le clic se lit ici, une fois pour toute la grille (pas un gestionnaire par pochette).
        <div onClick={followTile}>
          <PokedexGrid entries={visible} generations={pokedex.generations} />
        </div>
      ) : (
        <EmptyState
          headingLevel={2}
          icon={<SearchX size={22} />}
          title="Aucun Pokémon ne correspond à ces filtres"
          description="Essayez une autre recherche, ou élargissez les filtres."
          actions={<Button onClick={resetFilters}>Réinitialiser les filtres</Button>}
        />
      )}
    </div>
  )
}
