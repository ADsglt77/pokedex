/**
 * La liste d'achats : les cartes acceptées à l'achat (ou exclues), avec leur priorité et leur prix
 * maximum. Une préférence ne touche jamais au statut de la carte (souhaitée, commandée, possédée) :
 * on peut accepter plusieurs illustrations d'un même Pokémon et n'en acheter qu'une.
 */

import { DEFAULT_BUDGET, PRIORITY_LABELS, PRIORITY_RANK } from '@/config/shopping'
import { cardTitle, findCard, speciesOf } from '@/lib/catalog'
import { searchForm, searchMatcher } from '@/lib/filters'
import { parseLink } from '@/lib/format'
import { isTaken, type PokedexEntry } from '@/lib/pokedex'
import { isToBuy } from '@/lib/collection'
import { cheapestTotal, priceOf, type PricedCard } from '@/lib/prices'
import { priceVerdict } from '@/lib/purchase-planner'
import type {
  CardStatus,
  CollectionData,
  GenerationId,
  PokemonCard,
  PriceFile,
  Priority,
  PurchasePreference,
  ShoppingData,
} from '@/types'

export const emptyShopping = (): ShoppingData => ({
  schemaVersion: 1,
  updatedAt: null,
  preferences: {},
  orders: [],
  budget: { ...DEFAULT_BUDGET },
})

export type Decision = PurchasePreference['decision']

/** Accepter ou exclure une carte (priorité et prix maximum sont gardés) ; `null` l'oublie. */
export function setDecision(
  data: ShoppingData,
  cardId: string,
  decision: Decision | null,
  now: string,
): ShoppingData {
  const { [cardId]: previous, ...preferences } = data.preferences
  if (decision) preferences[cardId] = { priority: 'normal', ...previous, decision, updatedAt: now }
  return { ...data, preferences, updatedAt: now }
}

export type PreferenceChange = Partial<
  Pick<PurchasePreference, 'priority' | 'maxPrice' | 'note' | 'link'>
>

/** Change la priorité, le prix maximum, la note ou le lien ; `undefined` efface. Inchangé : `data`. */
export function updatePreference(
  data: ShoppingData,
  cardId: string,
  change: PreferenceChange,
  now: string,
): ShoppingData {
  const preference = data.preferences[cardId]!
  const keys = Object.keys(change) as (keyof PreferenceChange)[]
  if (keys.every((key) => preference[key] === change[key])) return data
  const updated = { ...preference, ...change, updatedAt: now }
  return { ...data, preferences: { ...data.preferences, [cardId]: updated }, updatedAt: now }
}

/**
 * Un lien collé vers une page de Cardmarket ; `null` s'il ne mène pas à www.cardmarket.com.
 * L'app ne fabrique aucun lien Cardmarket : leur format n'a pas pu être vérifié.
 */
export function parseCardmarketLink(text: string): string | null {
  const url = parseLink(text)
  return url?.protocol === 'https:' && url.hostname === 'www.cardmarket.com' ? url.href : null
}

/** Le nombre de cartes de la liste d'achats. */
export const acceptedCount = (data: ShoppingData) =>
  Object.values(data.preferences).filter((preference) => preference.decision === 'accepted').length

/** Une carte de la liste d'achats, prête à afficher et à planifier. */
export interface WishRow {
  card: PokemonCard
  preference: PurchasePreference
  status: CardStatus | null
  /** L'illustration choisie d'un de ses Pokémon. */
  isFavorite: boolean
  /** Prix indicatif Cardmarket ; `null` sans prix. */
  price: number | null
}

/** Les cartes acceptées à l'achat. */
export function wishlistRows(
  preferences: ShoppingData['preferences'],
  collection: CollectionData,
  prices: PriceFile | null,
): WishRow[] {
  return Object.entries(preferences).flatMap(([cardId, preference]) => {
    const card = findCard(cardId, collection)
    if (preference.decision !== 'accepted' || !card) return []
    return [
      {
        card,
        preference,
        status: collection.cards[cardId]?.status ?? null,
        isFavorite: card.dexIds.some((id) => collection.entries[id]?.favoriteCardId === cardId),
        price: priceOf(prices, card)?.price ?? null,
      },
    ]
  })
}

/** Les Pokémon déjà obtenus ou en route : une carte possédée ou commandée. */
export const takenSpecies = (entries: readonly PokedexEntry[]): Set<number> =>
  new Set(entries.filter(isTaken).map((entry) => entry.species.id))

/**
 * Ce que coûteraient les Pokémon de la liste qui manquent encore, chacun à sa carte acceptée la
 * moins chère ; `unpriced` : ceux dont aucune carte acceptée n'a de prix.
 */
export function wishlistEstimate(rows: readonly WishRow[], taken: ReadonlySet<number>) {
  const cardsByPokemon = new Map<number, PricedCard[]>()
  for (const row of rows.filter(isToBuy)) {
    for (const id of row.card.dexIds.filter((id) => !taken.has(id))) {
      const card = { cardId: row.card.id, price: row.price }
      cardsByPokemon.set(id, [...(cardsByPokemon.get(id) ?? []), card])
    }
  }
  return cheapestTotal(cardsByPokemon.values())
}

export type WishlistSort = 'priority' | 'price' | 'price-desc' | 'gap' | 'dex' | 'recent'

export interface WishlistFilters {
  search: string
  generation: GenerationId | null
  priority: Priority | null
  /** Code de rareté. */
  rarity: string | null
  favorites: boolean
  /** Seulement les cartes dont le prix du marché est sous le prix maximum. */
  underMax: boolean
  /** Aussi les cartes possédées ou commandées. */
  all: boolean
  sort: WishlistSort
}

export const DEFAULT_WISHLIST_FILTERS: WishlistFilters = {
  search: '',
  generation: null,
  priority: null,
  rarity: null,
  favorites: false,
  underMax: false,
  all: false,
  sort: 'priority',
}

const isUnderMax = (row: WishRow) => priceVerdict(row.price, row.preference.maxPrice) === 'under'

/** Écart entre le prix du marché et le prix maximum ; `null` sans l'un des deux. */
const gapOf = ({ price, preference }: WishRow) =>
  price === null || preference.maxPrice === undefined ? null : price - preference.maxPrice

/** Du plus petit au plus grand, les valeurs inconnues à la fin. */
const ascending = (a: number | null, b: number | null) =>
  a === null || b === null ? Number(a === null) - Number(b === null) : a - b

const negated = (value: number | null) => (value === null ? null : -value)

const SORTS: Record<WishlistSort, (a: WishRow, b: WishRow) => number> = {
  priority: (a, b) =>
    PRIORITY_RANK[a.preference.priority] - PRIORITY_RANK[b.preference.priority] ||
    ascending(a.price, b.price),
  price: (a, b) => ascending(a.price, b.price),
  'price-desc': (a, b) => ascending(negated(a.price), negated(b.price)),
  gap: (a, b) => ascending(gapOf(a), gapOf(b)),
  dex: (a, b) => (a.card.dexIds[0] ?? 0) - (b.card.dexIds[0] ?? 0),
  recent: (a, b) => b.preference.updatedAt.localeCompare(a.preference.updatedAt),
}

/** Les cartes qui passent les filtres, dans l'ordre choisi (puis par numéro de Pokédex). */
export function filterWishlist(rows: readonly WishRow[], filters: WishlistFilters): WishRow[] {
  const matches = searchMatcher(filters.search)
  const needle = searchForm(filters.search)
  return rows
    .filter((row) => {
      const species = speciesOf(row.card)
      return (
        (filters.all || isToBuy(row)) &&
        (!filters.generation || species.some((one) => one.generation === filters.generation)) &&
        (!filters.priority || row.preference.priority === filters.priority) &&
        (!filters.rarity || row.card.rarity === filters.rarity) &&
        (!filters.favorites || row.isFavorite) &&
        (!filters.underMax || isUnderMax(row)) &&
        (species.some(matches) || searchForm(row.card.reference).includes(needle))
      )
    })
    .sort((a, b) => SORTS[filters.sort](a, b) || SORTS.dex(a, b))
}

const englishNames = (card: PokemonCard) => speciesOf(card).map((species) => species.names.en)

/** Ce qu'on tape dans la recherche de Cardmarket : le nom anglais et la référence. */
export const searchText = (card: PokemonCard) => [...englishNames(card), card.reference].join(' ')

const csvNumber = (value: number | null | undefined) =>
  value == null ? '' : value.toFixed(2).replace('.', ',')

const csvCell = (value: string | number) => {
  const text = String(value)
  return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Un CSV pour un tableur (séparateur `;`, décimales à virgule) : une ligne par carte. */
export function wishlistCsv(rows: readonly WishRow[]): string {
  const header = [
    'Pokémon',
    'Nom anglais',
    'Extension',
    'Référence',
    'Numéro',
    'Quantité',
    'Prix max (€)',
    'Prix indicatif (€)',
    'Priorité',
    'Id produit Cardmarket',
    'Lien',
    'Note',
  ]
  const lines = rows.map((row) => [
    cardTitle(row.card),
    englishNames(row.card).join(' & '),
    row.card.set?.name ?? '',
    row.card.reference,
    row.card.reference.split(' ').at(-1)!,
    1,
    csvNumber(row.preference.maxPrice),
    csvNumber(row.price),
    PRIORITY_LABELS[row.preference.priority],
    row.card.cardmarket ?? '',
    row.preference.link ?? '',
    row.preference.note ?? '',
  ])
  return [header, ...lines].map((line) => line.map(csvCell).join(';')).join('\r\n')
}
