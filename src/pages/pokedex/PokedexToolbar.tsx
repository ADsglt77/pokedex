import {
  Badge,
  Button,
  IconButton,
  Input,
  Kbd,
  Popover,
  Select,
  Stack,
  Tag,
  Toggle,
} from '@camply/ui'
import { ArrowDown01, ArrowDown10, Search, SlidersHorizontal, X } from '@camply/ui/icons'
import { useEffect, useRef } from 'react'
import { ProgressRuler } from '@/components/ProgressRuler'
import {
  GENERATION_OPTIONS,
  generationById,
  generationLabel,
  POKEMON_TYPES,
} from '@/config/pokedex'
import { cx } from '@/lib/cx'
import { shortcutBlocked } from '@/lib/focus'
import type { CardFilter, PokedexFilters, PossessionFilter } from '@/lib/filters'
import { formatInteger, plural, toOptions } from '@/lib/format'
import type { GenerationProgress } from '@/lib/pokedex'
import type { GenerationId, PokemonTypeId } from '@/types'
import styles from './PokedexToolbar.module.css'

/** Les filtres rapides, toujours visibles : où en est chaque Pokémon. */
const CHIPS: { value: PossessionFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'owned', label: 'Débloqués' },
  { value: 'missing', label: 'À débloquer' },
  { value: 'ordered', label: 'Carte commandée' },
]

// Les listes de camply n'acceptent que des chaînes : '' veut dire « tout ».
const CARD_LABELS: Record<CardFilter, string> = {
  with: 'Avec carte',
  without: 'Sans carte',
  'no-image': 'Carte sans image',
  'no-cardmarket': 'Carte sans id Cardmarket',
  'no-paid': 'Possédée sans prix payé',
}

const CARD_OPTIONS = [
  { value: '' as const, label: 'Avec ou sans carte' },
  ...toOptions(CARD_LABELS),
]

const TYPE_OPTIONS: { value: PokemonTypeId | ''; label: string }[] = [
  { value: '', label: 'Tous les types' },
  ...Object.entries(POKEMON_TYPES)
    .map(([value, { label }]) => ({ value: value as PokemonTypeId, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
]

interface PokedexToolbarProps {
  filters: PokedexFilters
  setFilters: (patch: Partial<PokedexFilters>) => void
  /** La progression de chaque génération : la réglette. */
  generations: GenerationProgress[]
  /** Le nombre de Pokémon de chaque filtre rapide, les autres filtres appliqués. */
  counts: Record<PossessionFilter, number>
  /** Nombre de résultats, `null` quand rien ne filtre. */
  resultCount: number | null
  onReset: () => void
}

/**
 * La barre du Pokédex, collée en haut : recherche (raccourci « / »), filtres rapides de possession
 * avec leur nombre, les autres filtres dans un panneau (génération, type, carte), l'ordre, la
 * réglette des générations (grand écran), et les filtres actifs, chacun retirable.
 */
export function PokedexToolbar({
  filters,
  setFilters,
  generations,
  counts,
  resultCount,
  onReset,
}: PokedexToolbarProps) {
  const search = useRef<HTMLInputElement>(null)

  // « / » place le curseur dans la recherche, sauf quand on tape déjà dans un champ.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || shortcutBlocked(event)) return
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

  // Les filtres du panneau en cours, chacun retirable d'un clic ; leur nombre, sur son bouton.
  const tags: { key: string; label: string; remove: () => void }[] = []
  const generation = filters.generation && generationById(filters.generation)
  if (generation) {
    tags.push({
      key: 'generation',
      label: generationLabel(generation),
      remove: () => setFilters({ generation: null }),
    })
  }
  if (filters.type) {
    tags.push({
      key: 'type',
      label: `Type ${POKEMON_TYPES[filters.type].label}`,
      remove: () => setFilters({ type: null }),
    })
  }
  if (filters.card) {
    tags.push({
      key: 'card',
      label: CARD_LABELS[filters.card],
      remove: () => setFilters({ card: null }),
    })
  }
  const panelCount = tags.length

  return (
    <div className={styles.toolbar} role="search">
      <div className={styles.row}>
        <Input
          ref={search}
          className={styles.search}
          aria-label="Chercher un Pokémon (raccourci /)"
          placeholder="Nom ou numéro…"
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
              <Kbd size="sm" className="shortcut">
                /
              </Kbd>
            )
          }
        />

        <div className={styles.chips} role="group" aria-label="Possession">
          {CHIPS.map(({ value, label }) => (
            <Toggle
              key={value}
              size="sm"
              pressed={filters.possession === value}
              onChange={() => setFilters({ possession: value })}
              className={styles.chip}
            >
              {label}
              <span className={cx(styles.count, 'numeric')}>{formatInteger(counts[value])}</span>
            </Toggle>
          ))}
        </div>

        <div className={styles.actions}>
          <Popover
            placement="bottom-end"
            trigger={
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<SlidersHorizontal size={15} />}
                aria-label={`Filtres${panelCount ? ` (${plural(panelCount, 'actif', 'actifs')})` : ''}`}
              >
                Filtres
                {panelCount > 0 && (
                  <Badge variant="solid" size="sm" className={styles.badge}>
                    {panelCount}
                  </Badge>
                )}
              </Button>
            }
          >
            <Stack gap={3} className={styles.panel}>
              <Select
                label="Génération"
                size="sm"
                options={GENERATION_OPTIONS}
                value={filters.generation ? String(filters.generation) : ''}
                onChange={(value) =>
                  setFilters({ generation: value ? (Number(value) as GenerationId) : null })
                }
              />
              <Select
                label="Type"
                size="sm"
                options={TYPE_OPTIONS}
                value={filters.type ?? ''}
                onChange={(type) => setFilters({ type: type || null })}
              />
              <Select
                label="Carte"
                size="sm"
                options={CARD_OPTIONS}
                value={filters.card ?? ''}
                onChange={(card) => setFilters({ card: card || null })}
              />
            </Stack>
          </Popover>
          <IconButton
            label="Numéros décroissants"
            size="sm"
            variant={filters.descending ? 'soft' : 'ghost'}
            aria-pressed={filters.descending}
            onClick={() => setFilters({ descending: !filters.descending })}
          >
            {filters.descending ? <ArrowDown10 size={18} /> : <ArrowDown01 size={18} />}
          </IconButton>
        </div>
      </div>

      {/* Sur grand écran, la réglette sert de filtre de génération. */}
      <div className={styles.ruler}>
        <ProgressRuler
          generations={generations}
          selected={filters.generation}
          onSelect={(value) => setFilters({ generation: value })}
        />
      </div>

      <div className={styles.status}>
        <span className={styles.tags}>
          {tags.map((tag) => (
            <Tag key={tag.key} onRemove={tag.remove} removeLabel={`Retirer le filtre ${tag.label}`}>
              {tag.label}
            </Tag>
          ))}
        </span>
        <span className={styles.results}>
          {/* Toujours présente : une région annoncée doit exister avant son premier contenu. */}
          <span aria-live="polite" className="numeric">
            {resultCount !== null && `${formatInteger(resultCount)} Pokémon`}
          </span>
          {resultCount !== null && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Réinitialiser
            </Button>
          )}
        </span>
      </div>
    </div>
  )
}
