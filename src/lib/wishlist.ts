/**
 * La liste d'achats : chaque carte du compte qui n'est ni possédée ni commandée, celles des
 * Pokémon (favorites ou non) comme les cases des collections d'extensions (dresseurs et énergies
 * compris). Choisir une carte, ou commencer une extension, suffit à dire qu'on la veut : toutes
 * sont voulues autant (`docs/collection-et-achats.md`).
 */

import { speciesOf } from '@/lib/species'
import { searchForm, searchMatcher, type WishlistFilters, type WishlistSort } from '@/lib/filters'
import { isToBuy } from '@/lib/collection'
import { priceChange, priceOf } from '@/lib/prices'
import type { CollectionData, PokemonCard, PriceFile, SeriesCollection } from '@/types'

/** Une carte de la liste d'achats, ni possédée ni commandée, prête à afficher et à planifier. */
export interface WishRow {
  card: PokemonCard
  /** Prix indicatif (Cardmarket) ; `null` sans prix. */
  price: number | null
  /** Écart avec le prix d'il y a 30 jours (−0,18 : 18 % moins cher) ; `null` sans ce prix. */
  change30: number | null
  /** La collection d'extension dont elle est une case (la première, s'il y en a plusieurs). */
  series: SeriesCollection | null
}

/**
 * Toutes les cartes du compte, ni possédées ni commandées : celles d'un Pokémon déjà débloqué par
 * une autre comme les cases d'extensions, chacune une fois (une carte TAG TEAM aussi : on ne
 * l'achète qu'une fois). Pas une carte sans Pokémon ni collection (un dresseur gardé par une
 * commande après la suppression de sa collection) : rien ne la veut, et rien ne la montre plus.
 */
export function wishlistRows(collection: CollectionData, prices: PriceFile | null): WishRow[] {
  // La collection de chaque case, la première qui la compte (`seriesOf`), lue une fois pour toutes
  // les cartes : le compte peut en avoir des milliers.
  const seriesOfCard = new Map<string, SeriesCollection>()
  for (const series of collection.series) {
    for (const id of series.cards) if (!seriesOfCard.has(id)) seriesOfCard.set(id, series)
  }
  return Object.values(collection.customCards).flatMap((card) => {
    if (!isToBuy({ status: collection.cards[card.id]?.status ?? null })) return []
    const series = seriesOfCard.get(card.id) ?? null
    if (card.dexIds.length === 0 && !series) return []
    const price = priceOf(prices, card)
    return { card, price: price?.price ?? null, change30: price && priceChange(price), series }
  })
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
  // Une carte sans Pokémon (un dresseur, une énergie) après les autres.
  dex: (a, b) => ascending(a.card.dexIds[0] ?? null, b.card.dexIds[0] ?? null),
}

/**
 * Les cartes qui passent les filtres, dans l'ordre choisi (puis par numéro de Pokédex). Une carte
 * sans Pokémon n'a pas de génération (un filtre de génération l'écarte) et se cherche par sa
 * référence.
 */
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
