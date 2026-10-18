import { Button, EmptyState } from '@camply/ui'
import { Layers, SearchX } from '@camply/ui/icons'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigationType } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { useFollowLinks } from '@/hooks/useFollowLinks'
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

/** Les pochettes du premier affichage : plus qu'un grand écran n'en montre. */
const FIRST_TILES = 60

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
  // Toutes les pochettes, dans l'ordre choisi ; les filtres masquent les autres (`PokedexGrid`).
  const ordered = useMemo(
    () => (shownFilters.descending ? [...pokedex.entries].reverse() : pokedex.entries),
    [pokedex.entries, shownFilters.descending],
  )
  const shown = useMemo(() => new Set(visible.map((entry) => entry.species.id)), [visible])
  // Au premier affichage, les pochettes d'un écran d'abord, toutes les autres juste après, en
  // arrière-plan : la page paraît sans attendre les 1 025 (la coquille la garde ensuite en vie). Pas
  // en revenant en arrière : le défilement retrouvé a besoin de toute la hauteur.
  const navigationType = useNavigationType()
  const [firstEntries] = useState(() =>
    navigationType === 'POP' ? ordered : ordered.slice(0, FIRST_TILES),
  )
  const gridEntries = useDeferredValue(ordered, firstEntries)
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
  // Les pochettes sont de simples liens (`PokedexTile`), suivis par le routeur.
  const followTile = useFollowLinks()

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

      {/* Le clic se lit ici, une fois pour toute la grille (pas un gestionnaire par pochette). */}
      <div onClick={followTile} hidden={visible.length === 0}>
        <PokedexGrid entries={gridEntries} shown={shown} generations={pokedex.generations} />
      </div>
      {visible.length === 0 && (
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
