import { Button, EmptyState } from '@camply/ui'
import { SearchX } from '@camply/ui/icons'
import { useDeferredValue, useMemo } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { usePokedex } from '@/hooks/usePokedex'
import { usePokedexFilters } from '@/hooks/usePokedexFilters'
import { activeFilterCount, DEFAULT_FILTERS, filterEntries } from '@/lib/filters'
import { pageTitle } from '@/lib/format'
import { PokedexGrid } from './PokedexGrid'
import { PokedexToolbar } from './PokedexToolbar'

/** Le classeur : les 1 025 Pokémon, filtrés par la barre d'outils (filtres dans l'adresse). */
export function PokedexPage() {
  const pokedex = usePokedex()
  const [filters, setFilters] = usePokedexFilters()
  // La grille suit la saisie dès que le navigateur a le temps : la frappe reste fluide.
  const shownFilters = useDeferredValue(filters)
  const visible = useMemo(
    () => filterEntries(pokedex.entries, shownFilters),
    [pokedex.entries, shownFilters],
  )
  const filtering = filters.search.trim() !== '' || activeFilterCount(filters) > 0
  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  return (
    <div className="container">
      <title>{pageTitle('Pokédex')}</title>
      <PageHeader title="Pokédex">
        Les 1 025 Pokémon et leur carte. Pour en choisir plusieurs d’un coup, parcourez le{' '}
        <Link to="/catalogue">catalogue par extension</Link>.
      </PageHeader>

      <PokedexToolbar
        filters={filters}
        setFilters={setFilters}
        pokedex={pokedex}
        resultCount={filtering ? visible.length : null}
        onReset={resetFilters}
      />

      {visible.length > 0 ? (
        <PokedexGrid entries={visible} generations={pokedex.generations} />
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
