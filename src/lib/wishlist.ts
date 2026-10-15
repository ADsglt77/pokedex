/**
 * La liste d'achats : les cartes acceptées à l'achat, avec leur priorité et leur prix maximum. Une
 * préférence ne touche jamais au statut de la carte (souhaitée, commandée, possédée).
 */

import { DEFAULT_BUDGET, PRIORITY_LABELS, PRIORITY_RANK } from '@/config/shopping'
import { referenceCode } from '@/lib/card-code'
import { cardmarketPage } from '@/lib/cardmarket'
import { cardTitle, findCard, speciesOf } from '@/lib/species'
import { searchForm, searchMatcher } from '@/lib/filters'
import { isTaken, type PokedexEntry } from '@/lib/pokedex'
import { isToBuy, stillWanted } from '@/lib/collection'
import { priceChange, priceOf } from '@/lib/prices'
import { priceVerdict } from '@/lib/purchase-planner'
import { csvNumber, toCsv } from '@/lib/transfer'
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

/**
 * Met une carte dans la liste d'achats (priorité et prix maximum d'avant gardés), ou l'en retire
 * avec ses réglages. Seul `accepted` s'écrit : `excluded`, d'une ancienne version, n'est que lu.
 * Déjà dans la liste, ou retirée sans y être : `data`, inchangé (rien à synchroniser ni annuler).
 */
export function setAccepted(
  data: ShoppingData,
  cardId: string,
  accepted: boolean,
  now: string,
): ShoppingData {
  const { [cardId]: previous, ...preferences } = data.preferences
  if (accepted ? previous?.decision === 'accepted' : !previous) return data
  if (accepted) {
    preferences[cardId] = { priority: 'normal', ...previous, decision: 'accepted', updatedAt: now }
  }
  return { ...data, preferences, updatedAt: now }
}

/** Met d'un coup dans la liste d'achats les cartes `cardIds` (priorité normale). */
export function acceptCards(data: ShoppingData, cardIds: readonly string[], now: string) {
  return cardIds.reduce((shopping, cardId) => setAccepted(shopping, cardId, true, now), data)
}

/**
 * Les cartes du Pokédex qui pourraient entrer dans la liste d'achats : ni dans la liste, ni
 * possédées, ni commandées.
 */
export const cardsToList = (preferences: ShoppingData['preferences'], collection: CollectionData) =>
  Object.values(collection.customCards).filter(
    (card) =>
      preferences[card.id]?.decision !== 'accepted' &&
      isToBuy({ status: collection.cards[card.id]?.status ?? null }),
  )

export type PreferenceChange = Partial<Pick<PurchasePreference, 'priority' | 'maxPrice' | 'note'>>

/** Change la priorité, le prix maximum ou la note ; `undefined` efface. Inchangé : `data`. */
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

/** Une carte de la liste d'achats, prête à afficher et à planifier. */
export interface WishRow {
  card: PokemonCard
  preference: PurchasePreference
  status: CardStatus | null
  /** Prix indicatif (Cardmarket) ; `null` sans prix. */
  price: number | null
  /** Écart du prix avec sa moyenne sur 30 jours (−0,18 : 18 % en dessous) ; `null` sans les deux. */
  change30: number | null
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
    const price = priceOf(prices, card)
    return [
      {
        card,
        preference,
        status: collection.cards[cardId]?.status ?? null,
        price: price?.price ?? null,
        change30: price && priceChange(price),
      },
    ]
  })
}

/** Le nombre de cartes de la liste d'achats, parmi celles de `collection`. */
export const acceptedCount = (data: ShoppingData, collection: CollectionData) =>
  wishlistRows(data.preferences, collection, null).length

/** Les Pokémon déjà débloqués ou en route : une carte possédée ou commandée. */
export const takenSpecies = (entries: readonly PokedexEntry[]): Set<number> =>
  new Set(entries.filter(isTaken).map((entry) => entry.species.id))

/**
 * Ce que coûteraient les cartes de la liste encore à acheter, d'un Pokémon qui manque encore ;
 * `unpriced` : celles qui n'ont pas de prix.
 */
export function wishlistEstimate(rows: readonly WishRow[], taken: ReadonlySet<number>) {
  const estimate = { value: 0, unpriced: 0 }
  for (const row of rows.filter((row) => stillWanted(row, taken))) {
    if (row.price === null) estimate.unpriced++
    else estimate.value += row.price
  }
  return estimate
}

export type WishlistSort = 'priority' | 'price' | 'price-desc' | 'gap' | 'drop' | 'dex' | 'recent'

export interface WishlistFilters {
  search: string
  generation: GenerationId | null
  priority: Priority | null
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
  underMax: false,
  all: false,
  sort: 'priority',
}

/** Le prix du marché est sous le prix maximum. */
const isUnderMax = (row: WishRow) => priceVerdict(row.price, row.preference.maxPrice) === 'under'

/** Les cartes encore à acheter dont le prix du marché est passé sous le prix maximum. */
export const underMaxCount = (rows: readonly WishRow[]) =>
  rows.filter((row) => isToBuy(row) && isUnderMax(row)).length

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
  drop: (a, b) => ascending(a.change30, b.change30),
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
        (!filters.underMax || isUnderMax(row)) &&
        (species.some(matches) || searchForm(row.card.reference).includes(needle))
      )
    })
    .sort((a, b) => SORTS[filters.sort](a, b) || SORTS.dex(a, b))
}

const englishNames = (card: PokemonCard) => speciesOf(card).map((species) => species.names.en)

/**
 * Ce qu'on tape dans la recherche de Cardmarket : le nom anglais et le numéro (« Pikachu 764 »),
 * comme dans une recherche vérifiée par l'utilisateur (« Pikachu ex 764 »).
 */
export const searchText = (card: PokemonCard) =>
  [...englishNames(card), referenceCode(card.reference)?.number ?? ''].join(' ').trim()

/** Un CSV pour un tableur : une ligne par carte. */
export function wishlistCsv(rows: readonly WishRow[]): string {
  const header = [
    'Pokémon',
    'Nom anglais',
    'Référence',
    'Quantité',
    'Prix max (€)',
    'Prix indicatif (€)',
    'Priorité',
    'Id produit Cardmarket',
    'Page Cardmarket',
    'Note',
  ]
  const lines = rows.map((row) => [
    cardTitle(row.card),
    englishNames(row.card).join(' & '),
    row.card.reference,
    1,
    csvNumber(row.preference.maxPrice),
    csvNumber(row.price),
    PRIORITY_LABELS[row.preference.priority],
    row.card.cardmarket ?? '',
    cardmarketPage(row.card) ?? '',
    row.preference.note ?? '',
  ])
  return toCsv([header, ...lines])
}
