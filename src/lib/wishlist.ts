/**
 * La liste d'achats : la carte de chaque Pokémon qui n'est ni possédée ni commandée. Choisir une
 * carte suffit à dire qu'on la veut : ni priorité, ni prix maximum, ni note (une ancienne version
 * en avait, carte par carte ; retirés en octobre 2026, à la demande de l'utilisateur).
 */

import { DEFAULT_BUDGET } from '@/config/shopping'
import { referenceCode } from '@/lib/card-code'
import { cardmarketPage } from '@/lib/cardmarket'
import { cardTitle, speciesOf } from '@/lib/species'
import { searchForm, searchMatcher } from '@/lib/filters'
import { isTaken, type PokedexEntry } from '@/lib/pokedex'
import { isToBuy } from '@/lib/collection'
import { priceChange, priceOf } from '@/lib/prices'
import { csvNumber, toCsv } from '@/lib/transfer'
import type { CardStatus, GenerationId, PokemonCard, PriceFile, ShoppingData } from '@/types'

export const emptyShopping = (): ShoppingData => ({
  schemaVersion: 1,
  updatedAt: null,
  preferences: {},
  orders: [],
  budget: { ...DEFAULT_BUDGET },
})

/** Une carte de la liste d'achats, prête à afficher et à planifier. */
export interface WishRow {
  card: PokemonCard
  /** Ni possédée ni commandée : `null` (le plan le vérifie quand même, `stillWanted`). */
  status: CardStatus | null
  /** Prix indicatif (Cardmarket) ; `null` sans prix. */
  price: number | null
  /** Écart du prix avec sa moyenne sur 30 jours (−0,18 : 18 % en dessous) ; `null` sans les deux. */
  change30: number | null
}

/**
 * La carte de chaque Pokémon, ni possédée ni commandée ; une carte de plusieurs Pokémon (TAG TEAM)
 * une seule fois : on ne l'achète qu'une fois.
 */
export function wishlistRows(entries: readonly PokedexEntry[], prices: PriceFile | null) {
  const rows = new Map<string, WishRow>()
  for (const { card: view } of entries) {
    if (!view || !isToBuy(view) || rows.has(view.card.id)) continue
    const price = priceOf(prices, view.card)
    rows.set(view.card.id, {
      card: view.card,
      status: view.status,
      price: price?.price ?? null,
      change30: price && priceChange(price),
    })
  }
  return [...rows.values()]
}

/** Les Pokémon déjà débloqués ou en route : une carte possédée ou commandée. */
export const takenSpecies = (entries: readonly PokedexEntry[]): Set<number> =>
  new Set(entries.filter(isTaken).map((entry) => entry.species.id))

/** Ce que coûteraient les cartes de la liste ; `unpriced` : celles qui n'ont pas de prix. */
export function wishlistEstimate(rows: readonly WishRow[]) {
  const estimate = { value: 0, unpriced: 0 }
  for (const row of rows) {
    if (row.price === null) estimate.unpriced++
    else estimate.value += row.price
  }
  return estimate
}

export type WishlistSort = 'price' | 'price-desc' | 'drop' | 'dex'

export interface WishlistFilters {
  search: string
  generation: GenerationId | null
  sort: WishlistSort
}

export const DEFAULT_WISHLIST_FILTERS: WishlistFilters = {
  search: '',
  generation: null,
  sort: 'price',
}

/** Du plus petit au plus grand, les valeurs inconnues à la fin. */
const ascending = (a: number | null, b: number | null) =>
  a === null || b === null ? Number(a === null) - Number(b === null) : a - b

const negated = (value: number | null) => (value === null ? null : -value)

const SORTS: Record<WishlistSort, (a: WishRow, b: WishRow) => number> = {
  price: (a, b) => ascending(a.price, b.price),
  'price-desc': (a, b) => ascending(negated(a.price), negated(b.price)),
  drop: (a, b) => ascending(a.change30, b.change30),
  dex: (a, b) => (a.card.dexIds[0] ?? 0) - (b.card.dexIds[0] ?? 0),
}

/** Les cartes qui passent les filtres, dans l'ordre choisi (puis par numéro de Pokédex). */
export function filterWishlist(rows: readonly WishRow[], filters: WishlistFilters): WishRow[] {
  const matches = searchMatcher(filters.search)
  const needle = searchForm(filters.search)
  return rows
    .filter((row) => {
      const species = speciesOf(row.card)
      return (
        (!filters.generation || species.some((one) => one.generation === filters.generation)) &&
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
    'Prix indicatif (€)',
    'Id produit Cardmarket',
    'Page Cardmarket',
  ]
  const lines = rows.map((row) => [
    cardTitle(row.card),
    englishNames(row.card).join(' & '),
    row.card.reference,
    1,
    csvNumber(row.price),
    row.card.cardmarket ?? '',
    cardmarketPage(row.card) ?? '',
  ])
  return toCsv([header, ...lines])
}
