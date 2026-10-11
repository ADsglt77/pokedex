import { Button, IconButton, Input, Kbd, SegmentedControl, Select, Stack } from '@camply/ui'
import { ArrowDown01, ArrowDown10, Search, SlidersHorizontal, X } from '@camply/ui/icons'
import { useEffect, useRef, useState, type Ref } from 'react'
import { ProgressRuler } from '@/components/ProgressRuler'
import { GENERATIONS } from '@/config/pokedex'
import { cx } from '@/lib/cx'
import {
  activeFilterCount,
  type IllustrationFilter,
  type PokedexFilters,
  type PossessionFilter,
} from '@/lib/filters'
import { formatInteger, unlockedOf } from '@/lib/format'
import type { Pokedex } from '@/lib/pokedex'
import type { GenerationId } from '@/types'
import styles from './PokedexToolbar.module.css'

const POSSESSION_OPTIONS: { value: PossessionFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'owned', label: 'Possédés' },
  { value: 'missing', label: 'Manquants' },
]

// Les listes de camply n'acceptent que des chaînes : '' veut dire « tout ».
const ILLUSTRATION_OPTIONS: { value: IllustrationFilter | ''; label: string }[] = [
  { value: '', label: 'Toutes les illustrations' },
  { value: 'card', label: 'Avec carte' },
  { value: 'no-card', label: 'À rechercher' },
]

const GENERATION_OPTIONS = [
  { value: '', label: 'Toutes les générations' },
  ...GENERATIONS.map((generation) => ({
    value: String(generation.id),
    label: `${generation.numeral} – ${generation.region}`,
  })),
]

interface PokedexToolbarProps {
  ref?: Ref<HTMLDivElement>
  filters: PokedexFilters
  setFilters: (patch: Partial<PokedexFilters>) => void
  query: string
  setQuery: (query: string) => void
  commitSearch: () => void
  pokedex: Pokedex
  /** Nombre de résultats, `null` quand rien ne filtre. */
  resultCount: number | null
  onReset: () => void
}

export function PokedexToolbar({
  ref,
  filters,
  setFilters,
  query,
  setQuery,
  commitSearch,
  pokedex,
  resultCount,
  onReset,
}: PokedexToolbarProps) {
  const search = useRef<HTMLInputElement>(null)
  // Sur téléphone, les filtres se replient derrière un bouton ; ouverts d'emblée sur tablette.
  const [filtersOpen, setFiltersOpen] = useState(() => matchMedia('(min-width: 40rem)').matches)
  const count = activeFilterCount(filters)

  // « / » place le curseur dans la recherche, sauf quand on tape déjà dans un champ.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea')
      if (event.key !== '/' || typing || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const clearSearch = () => {
    setQuery('')
    setFilters({ search: '' })
    search.current?.focus()
  }

  return (
    <Stack ref={ref} gap={3} className={styles.toolbar} role="search">
      <Stack direction="horizontal" align="center" gap={3} wrap>
        <Input
          ref={search}
          className={styles.search}
          aria-label="Chercher un Pokémon (raccourci /)"
          placeholder="Nom ou numéro"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={commitSearch}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitSearch()
            if (event.key === 'Escape' && query) clearSearch()
          }}
          leftIcon={<Search size={16} />}
          rightIcon={
            query ? (
              <IconButton
                label="Effacer la recherche"
                size="sm"
                variant="ghost"
                onClick={clearSearch}
              >
                <X size={14} />
              </IconButton>
            ) : (
              <Kbd size="sm" className={styles.shortcut}>
                /
              </Kbd>
            )
          }
        />

        <Button
          className={styles.filtersToggle}
          variant="secondary"
          leftIcon={<SlidersHorizontal size={16} />}
          aria-expanded={filtersOpen}
          aria-controls="pokedex-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filtres{count > 0 && ` (${count})`}
        </Button>

        <Stack
          id="pokedex-filters"
          direction="horizontal"
          align="center"
          gap={2}
          wrap
          className={cx(styles.filters, filtersOpen && styles.open)}
        >
          <SegmentedControl
            aria-label="Possession"
            size="sm"
            options={POSSESSION_OPTIONS}
            value={filters.possession}
            onChange={(possession) => setFilters({ possession })}
          />
          <Select
            aria-label="Illustration"
            size="sm"
            options={ILLUSTRATION_OPTIONS}
            value={filters.illustration ?? ''}
            onChange={(illustration) => setFilters({ illustration: illustration || null })}
          />
          <Select
            className={styles.generationSelect}
            aria-label="Génération"
            size="sm"
            options={GENERATION_OPTIONS}
            value={filters.generation ? String(filters.generation) : ''}
            onChange={(generation) =>
              setFilters({ generation: generation ? (Number(generation) as GenerationId) : null })
            }
          />
          <IconButton
            label="Numéros décroissants"
            size="sm"
            variant={filters.descending ? 'soft' : 'ghost'}
            aria-pressed={filters.descending}
            onClick={() => setFilters({ descending: !filters.descending })}
          >
            {filters.descending ? <ArrowDown10 size={18} /> : <ArrowDown01 size={18} />}
          </IconButton>
        </Stack>
      </Stack>

      {/* Sur grand écran, la réglette sert de filtre de génération. */}
      <div className={styles.ruler}>
        <ProgressRuler
          generations={pokedex.generations}
          selected={filters.generation}
          onSelect={(generation) => setFilters({ generation })}
        />
      </div>

      <div className={styles.status}>
        <span className="numeric">{unlockedOf(pokedex.progress)}</span>
        <span className={styles.results}>
          {/* Toujours présente : une région annoncée doit exister avant son premier contenu. */}
          <span aria-live="polite" className="numeric">
            {resultCount !== null && `${formatInteger(resultCount)} Pokémon`}
          </span>
          {resultCount !== null && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Réinitialiser les filtres
            </Button>
          )}
        </span>
      </div>
    </Stack>
  )
}
