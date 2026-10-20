/**
 * La liste d'achats : la carte de chaque Pokémon qui n'est ni possédée ni commandée. Choisir une
 * carte suffit à dire qu'on la veut : ni priorité, ni prix maximum, ni note (une ancienne version
 * en avait, carte par carte ; retirés en octobre 2026, à la demande de l'utilisateur).
 */

import { speciesOf } from '@/lib/species'
import { searchForm, searchMatcher, type WishlistFilters, type WishlistSort } from '@/lib/filters'
import type { PokedexEntry } from '@/lib/pokedex'
import { isToBuy } from '@/lib/collection'
import { priceChange, priceOf } from '@/lib/prices'
import type { PokemonCard, PriceFile } from '@/types'

/** Une carte de la liste d'achats, ni possédée ni commandée, prête à afficher et à planifier. */
export interface WishRow {
  card: PokemonCard
  /** Prix indicatif (Cardmarket) ; `null` sans prix. */
  price: number | null
  /** Écart avec le prix d'il y a 30 jours (−0,18 : 18 % moins cher) ; `null` sans ce prix. */
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
      price: price?.price ?? null,
      change30: price && priceChange(price),
    })
  }
  return [...rows.values()]
}

/** Ce que coûteraient les cartes de la liste ; `unpriced` : celles qui n'ont pas de prix. */
export function wishlistEstimate(rows: readonly WishRow[]) {
  const estimate = { value: 0, unpriced: 0 }
  for (const row of rows) {
    if (row.price === null) estimate.unpriced++
    else estimate.value += row.price
  }
  return estimate
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
