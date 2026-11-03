import { Button } from '@camply/ui'
import { Layers } from '@camply/ui/icons'
import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigationType } from 'react-router'
import { NoMatch } from '@/components/NoMatch'
import { PageHeader } from '@/components/PageHeader'
import { useFollowLinks } from '@/hooks/useFollowLinks'
import { usePokedex } from '@/hooks/usePokedex'
import { usePokedexFilters } from '@/hooks/usePokedexFilters'
import { usePokedexGrid } from '@/hooks/usePokedexGrid'
import { DEFAULT_FILTERS, filterEntries, POSSESSIONS, type PossessionFilter } from '@/lib/filters'
import { formatInteger, pageTitle, plural } from '@/lib/format'
import { PokedexGrid } from '@/components/PokedexGrid'
import { PokedexToolbar } from './PokedexToolbar'

/** Où le routeur garde les positions de défilement (sa clé par défaut). */
const SCROLL_POSITIONS = 'react-router-scroll-positions'

/**
 * Le classeur a-t-il déjà été affiché dans ce document ? Le routeur dit `POP` au premier chargement
 * aussi (nouvel onglet, favori) : seul un retour dans la même visite a une position en mémoire.
 */
let mounted = false

/**
 * Le routeur garde-t-il une position de défilement pour cette adresse (`ScrollRestoration`, la
 * coquille : sous l'adresse du Pokédex et ses filtres, dans le stockage de la session) ?
 */
function hasScrollPosition() {
  try {
    const positions = JSON.parse(sessionStorage.getItem(SCROLL_POSITIONS) ?? '{}') as object
    return Object.hasOwn(positions, location.pathname + location.search)
  } catch {
    return false
  }
}

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
  // Au premier affichage, même la page ouverte directement, les pochettes d'un écran d'abord
  // (`usePokedexGrid` ; la coquille garde ensuite la page en vie). Pas en revenant en arrière dans
  // la même visite (`mounted`), ni quand une position est gardée pour cette adresse (après un
  // rechargement) : le défilement retrouvé a besoin de toute la hauteur.
  const navigationType = useNavigationType()
  const grid = usePokedexGrid(
    ordered,
    visible,
    () => (navigationType === 'POP' && mounted) || hasScrollPosition(),
  )
  // Posé après l'affichage, pas pendant le rendu : un rendu que React abandonne ne compte pas.
  useEffect(() => {
    mounted = true
  }, [])
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
  const filtering =
    filters.search.trim() !== '' ||
    filters.possession !== 'all' ||
    filters.generation !== null ||
    filters.card !== null ||
    filters.type !== null
  const search = useRef<HTMLInputElement>(null)
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
        Les {formatInteger(pokedex.progress.total)} Pokémon et leur carte favorite :{' '}
        {plural(pokedex.progress.unlocked, 'débloqué', 'débloqués')}. Ouvrez-en un pour lui choisir
        ses cartes.
      </PageHeader>

      <PokedexToolbar
        filters={filters}
        setFilters={setFilters}
        generations={pokedex.generations}
        counts={counts}
        resultCount={filtering ? visible.length : null}
        onReset={resetFilters}
        search={search}
      />

      {/* Le clic se lit ici, une fois pour toute la grille (pas un gestionnaire par pochette). */}
      <div onClick={followTile} hidden={visible.length === 0}>
        <PokedexGrid {...grid} generations={pokedex.generations} />
      </div>
      {visible.length === 0 && (
        <NoMatch
          title="Aucun Pokémon ne correspond à ces filtres"
          onReset={resetFilters}
          search={search}
        />
      )}
    </div>
  )
}
