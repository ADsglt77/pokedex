import { Button, Toggle } from '@camply/ui'
import { CARD_TYPES } from '@/config/catalog'
import {
  NO_FILTER,
  passesFilter,
  type CardFilter,
  type CatalogCard,
  type Rarity,
} from '@/lib/card-catalog'
import { formatInteger, plural } from '@/lib/format'
import { RarityIcon, TypeIcon } from './CatalogIcons'
import styles from './CardFilters.module.css'

/** La liste avec `id`, ou sans. */
const toggled = (ids: number[], id: number, on: boolean) =>
  on ? [...ids, id] : ids.filter((other) => other !== id)

/**
 * Les filtres d'une grille de cartes du catalogue (page Catalogue, choix de la carte d'un
 * Pokémon) : leurs raretés et leurs types, chacun avec le nombre de cartes qu'il montrerait parmi
 * celles que garde l'autre filtre. Plusieurs raretés (ou types) s'ajoutent ; les deux filtres se
 * combinent. Un filtre qui n'offrirait qu'un choix n'est pas montré. `cards` : les cartes avant ces
 * filtres.
 */
export function CardFilters({
  cards,
  value,
  onChange,
}: {
  cards: CatalogCard[]
  value: CardFilter
  onChange: (value: CardFilter) => void
}) {
  const rarityCounts = new Map<number, { rarity: Rarity; count: number }>()
  for (const card of cards) {
    if (!card.rarity || !passesFilter(card, { ...value, rarities: [] })) continue
    const entry = rarityCounts.get(card.rarity.id) ?? { rarity: card.rarity, count: 0 }
    rarityCounts.set(card.rarity.id, { ...entry, count: entry.count + 1 })
  }
  const typeCounts = new Map<number, number>()
  for (const card of cards) {
    if (card.type === null || !passesFilter(card, { ...value, types: [] })) continue
    typeCounts.set(card.type, (typeCounts.get(card.type) ?? 0) + 1)
  }
  const rarities = [...rarityCounts.values()].sort((a, b) => a.rarity.rank - b.rarity.rank)
  const types = [...CARD_TYPES.keys()].filter((type) => typeCounts.has(type))
  const filtered = value.rarities.length > 0 || value.types.length > 0
  if (rarities.length < 2 && types.length < 2 && !filtered) return null

  const label = (name: string, count: number) => `${name} : ${plural(count, 'carte', 'cartes')}`
  return (
    <div className={styles.filters}>
      {(rarities.length > 1 || value.rarities.length > 0) && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Rareté</legend>
          {rarities.map(({ rarity, count }) => (
            <Toggle
              key={rarity.id}
              size="sm"
              className={styles.chip}
              pressed={value.rarities.includes(rarity.id)}
              onChange={(on) =>
                onChange({ ...value, rarities: toggled(value.rarities, rarity.id, on) })
              }
              aria-label={label(rarity.name, count)}
              title={label(rarity.name, count)}
            >
              <RarityIcon rarity={rarity} className={styles.rarity} />
              <span className="numeric">{formatInteger(count)}</span>
            </Toggle>
          ))}
        </fieldset>
      )}
      {(types.length > 1 || value.types.length > 0) && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Type</legend>
          {types.map((type) => (
            <Toggle
              key={type}
              size="sm"
              className={styles.chip}
              pressed={value.types.includes(type)}
              onChange={(on) => onChange({ ...value, types: toggled(value.types, type, on) })}
              aria-label={label(CARD_TYPES.get(type)!, typeCounts.get(type)!)}
              title={label(CARD_TYPES.get(type)!, typeCounts.get(type)!)}
            >
              <TypeIcon type={type} />
              <span className="numeric">{formatInteger(typeCounts.get(type)!)}</span>
            </Toggle>
          ))}
        </fieldset>
      )}
      {filtered && (
        <Button variant="ghost" size="sm" onClick={() => onChange(NO_FILTER)}>
          Retirer les filtres
        </Button>
      )}
    </div>
  )
}
