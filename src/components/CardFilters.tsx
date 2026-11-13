import { Button, Toggle } from '@camply/ui'
import { useRef, type ReactNode, type RefObject } from 'react'
import { CARD_TYPES } from '@/config/catalog'
import {
  NO_FILTER,
  passesFilter,
  type CatalogCard,
  type CatalogFilter,
  type Rarity,
} from '@/lib/card-catalog'
import { focusAfter } from '@/lib/focus'
import { formatInteger, plural } from '@/lib/format'
import type { CardType } from '@/types'
import { TypeLabel } from './TypeLabel'
import styles from './CardFilters.module.css'

/** La liste avec `id`, ou sans. */
const toggled = (ids: string[], id: string, on: boolean) =>
  on ? [...ids, id] : ids.filter((other) => other !== id)

/**
 * Les filtres d'une grille de cartes du catalogue (page Catalogue, choix de la carte d'un
 * Pokémon) : leurs raretés et leurs types, en toutes lettres (le type d'une énergie avec sa
 * pastille, `TypeLabel`), chacun avec le nombre de cartes qu'il montrerait parmi celles que garde
 * l'autre filtre. Plusieurs raretés (ou types) s'ajoutent ; les deux filtres se
 * combinent. Un filtre qui n'offrirait qu'un choix n'est pas montré. `cards` : les cartes avant ces
 * filtres.
 */
export function CardFilters({
  cards,
  value,
  onChange,
}: {
  cards: CatalogCard[]
  value: CatalogFilter
  onChange: (value: CatalogFilter) => void
}) {
  // Le premier choix, où va le focus quand « Retirer les filtres » disparaît avec eux.
  const first = useRef<HTMLButtonElement>(null)
  const rarityCounts = new Map<string, { rarity: Rarity; count: number }>()
  for (const card of cards) {
    if (!card.rarity || !passesFilter(card, { ...value, rarities: [] })) continue
    const entry = rarityCounts.get(card.rarity.id) ?? { rarity: card.rarity, count: 0 }
    rarityCounts.set(card.rarity.id, { ...entry, count: entry.count + 1 })
  }
  const typeCounts = new Map<CardType, number>()
  for (const card of cards) {
    if (card.type === null || !passesFilter(card, { ...value, types: [] })) continue
    typeCounts.set(card.type, (typeCounts.get(card.type) ?? 0) + 1)
  }
  const rarities = [...rarityCounts.values()].sort((a, b) => a.rarity.rank - b.rarity.rank)
  const showRarities = rarities.length > 1 || value.rarities.length > 0
  const types = [...CARD_TYPES.keys()].filter((type) => typeCounts.has(type))
  const filtered = value.rarities.length > 0 || value.types.length > 0
  if (rarities.length < 2 && types.length < 2 && !filtered) return null

  return (
    <div className={styles.filters}>
      {showRarities && (
        <ChipGroup
          legend="Rareté"
          chips={rarities.map(({ rarity, count }) => ({
            id: rarity.id,
            name: rarity.name,
            count,
            label: rarity.name,
          }))}
          selected={value.rarities}
          onSelect={(rarities) => onChange({ ...value, rarities })}
          first={first}
        />
      )}
      {(types.length > 1 || value.types.length > 0) && (
        <ChipGroup
          legend="Type"
          chips={types.map((type) => ({
            id: type,
            name: CARD_TYPES.get(type)!,
            count: typeCounts.get(type)!,
            label: <TypeLabel type={type} />,
          }))}
          selected={value.types}
          onSelect={(types) => onChange({ ...value, types })}
          first={showRarities ? undefined : first}
        />
      )}
      {filtered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => focusAfter(() => onChange(NO_FILTER), first)}
        >
          Retirer les filtres
        </Button>
      )}
    </div>
  )
}

/**
 * Un filtre en pastilles : chacune son nom et son nombre de cartes, `selected` les choisies.
 * `first` va à la première. Au niveau du module : défini dans `CardFilters`, il serait recréé à
 * chaque rendu et ferait perdre le focus à la pastille cliquée.
 */
function ChipGroup({
  legend,
  chips,
  selected,
  onSelect,
  first,
}: {
  legend: string
  chips: { id: string; name: string; count: number; label: ReactNode }[]
  selected: string[]
  onSelect: (selected: string[]) => void
  first?: RefObject<HTMLButtonElement | null>
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      {chips.map(({ id, name, count, label }, index) => (
        <Toggle
          key={id}
          ref={index === 0 ? first : undefined}
          size="sm"
          className={styles.chip}
          pressed={selected.includes(id)}
          onChange={(on) => onSelect(toggled(selected, id, on))}
          aria-label={`${name} : ${plural(count, 'carte', 'cartes')}`}
        >
          {label}
          <span className={styles.count}>{formatInteger(count)}</span>
        </Toggle>
      ))}
    </fieldset>
  )
}
