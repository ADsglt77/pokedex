import { Button, IconButton, Input, Kbd, SegmentedControl, Select, Stack } from '@camply/ui'
import { ArrowDown01, ArrowDown10, Search, SlidersHorizontal, X } from '@camply/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { ProgressRuler } from '@/components/ProgressRuler'
import { GENERATION_OPTIONS } from '@/config/pokedex'
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
  { value: '', label: 'Avec ou sans carte' },
  { value: 'card', label: 'Avec carte' },
  { value: 'no-card', label: 'Sans carte' },
]

interface PokedexToolbarProps {
  filters: PokedexFilters
  setFilters: (patch: Partial<PokedexFilters>) => void
  pokedex: Pokedex
  /** Nombre de résultats, `null` quand rien ne filtre. */
  resultCount: number | null
  onReset: () => void
}

/**
 * La barre du Pokédex, collée en haut : recherche (raccourci « / »), filtres (repliés sur
 * téléphone), réglette des générations (grand écran), nombre de résultats.
 */
export function PokedexToolbar({
  filters,
  setFilters,
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
    setFilters({ search: '' })
    search.current?.focus()
  }

  return (
    <Stack gap={3} className={styles.toolbar} role="search">
      <Stack direction="horizontal" align="center" gap={3} wrap>
        <Input
          ref={search}
          className={styles.search}
          aria-label="Chercher un Pokémon (raccourci /)"
          placeholder="Nom ou numéro"
          autoComplete="off"
          enterKeyHint="search"
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value })}
          onKeyDown={(event) => event.key === 'Escape' && clearSearch()}
          leftIcon={<Search size={16} />}
          rightIcon={
            filters.search ? (
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
            aria-label="Carte"
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
