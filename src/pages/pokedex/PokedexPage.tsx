import { Button, EmptyState } from '@camply/ui'
import { SearchX } from '@camply/ui/icons'
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { usePokedex } from '@/hooks/usePokedex'
import { usePokedexFilters } from '@/hooks/usePokedexFilters'
import { activeFilterCount, filterEntries } from '@/lib/filters'
import { pageTitle } from '@/lib/format'
import { PokedexGrid } from './PokedexGrid'
import { PokedexToolbar } from './PokedexToolbar'

export function PokedexPage() {
  const pokedex = usePokedex()
  const [filters, setFilters] = usePokedexFilters()

  // La recherche est tapée ici et écrite dans l'adresse après une courte pause.
  const [query, setQuery] = useState(filters.search)
  const [urlSearch, setUrlSearch] = useState(filters.search)
  if (filters.search !== urlSearch) {
    // L'adresse a changé (lien, retour arrière, réinitialisation) : le champ la suit, sauf
    // quand c'est l'écho de ce qui vient d'être tapé.
    setUrlSearch(filters.search)
    if (filters.search !== query.trim()) setQuery(filters.search)
  }

  const commitSearch = () => {
    if (query.trim() !== filters.search) setFilters({ search: query })
  }
  const onTypingPause = useEffectEvent(commitSearch)
  useEffect(() => {
    const timer = setTimeout(onTypingPause, 200)
    return () => clearTimeout(timer)
  }, [query])

  // La saisie reste fluide : la grille suit dès que le navigateur a le temps.
  const search = useDeferredValue(query)
  const visible = useMemo(
    () => filterEntries(pokedex.entries, { ...filters, search }),
    [pokedex.entries, filters, search],
  )
  const filtering = search.trim() !== '' || activeFilterCount(filters) > 0

  const resetFilters = () => {
    setQuery('')
    setFilters({ search: '', generation: null, possession: 'all', illustration: null })
  }

  // Quand un filtre change alors qu'on lisait plus bas, les résultats repartent du début,
  // juste sous la barre de filtres.
  const toolbar = useRef<HTMLDivElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const previousVisible = useRef(visible)
  useEffect(() => {
    if (previousVisible.current === visible) return
    previousVisible.current = visible
    const resultsTop = results.current?.getBoundingClientRect().top ?? 0
    const toolbarBottom = toolbar.current?.getBoundingClientRect().bottom ?? 0
    if (resultsTop < toolbarBottom) window.scrollBy({ top: resultsTop - toolbarBottom })
  }, [visible])

  return (
    <div className="container">
      <title>{pageTitle('Pokédex')}</title>
      <PageHeader title="Pokédex" />

      <PokedexToolbar
        ref={toolbar}
        filters={filters}
        setFilters={setFilters}
        query={query}
        setQuery={setQuery}
        commitSearch={commitSearch}
        pokedex={pokedex}
        resultCount={filtering ? visible.length : null}
        onReset={resetFilters}
      />

      <div ref={results}>
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
    </div>
  )
}
