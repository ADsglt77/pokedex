/**
 * Les prix Cardmarket appliqués à la collection : prix d'une carte, totaux par statut, coût pour
 * compléter le Pokédex, courbes au fil des jours.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { findCard, tcgdexIdOf } from '@/lib/catalog'
import type { PokedexEntry } from '@/lib/pokedex'
import type {
  CardPrice,
  CardStatus,
  CollectionData,
  PokemonCard,
  PriceFile,
  PriceHistoryFile,
} from '@/types'

/** Le prix du jour d'une carte ; `null` sans prix (ou sans fichier de prix). */
export const priceOf = (prices: PriceFile | null, card: PokemonCard): CardPrice | null =>
  prices?.cards[tcgdexIdOf(card) ?? ''] ?? null

/** L'écart en % entre ce que vaut une carte (ou une collection) et ce qu'elle a coûté. */
export const gainPercent = (value: number, paid: number) =>
  paid > 0 ? Math.round(((value - paid) / paid) * 100) : undefined

/** Une carte suivie : ce qu'elle a coûté, ce qu'elle vaut. */
export interface TrackedCard {
  card: PokemonCard
  status: CardStatus
  paid: number | null
  value: number | null
}

export function trackedCards(collection: CollectionData, prices: PriceFile | null): TrackedCard[] {
  return Object.entries(collection.cards).flatMap(([cardId, ownership]) => {
    const card = findCard(cardId, collection)
    if (!card) return []
    const value = priceOf(prices, card)?.price ?? null
    return [{ card, status: ownership.status, paid: ownership.paidPrice ?? null, value }]
  })
}

export interface Tally {
  count: number
  /** Somme des prix connus. */
  value: number
  /** Cartes sans prix, absentes de `value`. */
  unpriced: number
  /** Somme des prix payés notés. */
  paid: number
  /** Valeur des seules cartes au prix payé noté : le gain est `paidCardsValue - paid`. */
  paidCardsValue: number
}

const emptyTally = (): Tally => ({ count: 0, value: 0, unpriced: 0, paid: 0, paidCardsValue: 0 })

/** Les totaux de chaque statut : possédées, commandées, souhaitées. */
export function tallyByStatus(cards: readonly TrackedCard[]): Record<CardStatus, Tally> {
  const tallies = { owned: emptyTally(), ordered: emptyTally(), wanted: emptyTally() }
  for (const { status, paid, value } of cards) {
    const tally = tallies[status]
    tally.count++
    if (value === null) tally.unpriced++
    else tally.value += value
    if (paid !== null) {
      tally.paid += paid
      tally.paidCardsValue += value ?? paid
    }
  }
  return tallies
}

export interface CompletionCost {
  /** Somme, pour chaque Pokémon, du prix de sa carte la moins chère. */
  value: number
  /** Pokémon chiffrés. */
  priced: number
  /** Pokémon dont aucune carte n'a de prix (ou sans carte). */
  unpriced: number
}

/** Pour chaque Pokémon, les prix de ses cartes (`null` : sans prix) → ce que coûte la moins chère. */
export function cheapestTotal(pricesByPokemon: Iterable<(number | null)[]>): CompletionCost {
  const cost = { value: 0, priced: 0, unpriced: 0 }
  for (const prices of pricesByPokemon) {
    const known = prices.filter((price) => price !== null)
    if (known.length === 0) cost.unpriced++
    else {
      cost.value += Math.min(...known)
      cost.priced++
    }
  }
  return cost
}

/**
 * Ce que coûterait de débloquer les Pokémon qui restent, à la candidate la moins chère. Un
 * Pokémon dont une carte est déjà commandée compte dans les commandes, pas ici.
 */
const completionCost = (entries: readonly PokedexEntry[], prices: PriceFile | null) =>
  cheapestTotal(
    entries
      .filter((entry) => !entry.unlocked && entry.statusCounts.ordered === 0)
      .map((entry) =>
        entry.candidates.map((candidate) => priceOf(prices, candidate.card)?.price ?? null),
      ),
  )

export const completionByGeneration = (
  entries: readonly PokedexEntry[],
  prices: PriceFile | null,
): { generation: Generation; cost: CompletionCost }[] =>
  GENERATIONS.map((generation) => ({
    generation,
    cost: completionCost(
      entries.filter((entry) => entry.species.generation === generation.id),
      prices,
    ),
  }))

export interface PricePoint {
  date: string
  value: number
}

const seriesOf = (history: PriceHistoryFile, card: PokemonCard) =>
  history.cards[tcgdexIdOf(card) ?? ''] ?? []

/** La courbe d'une carte : un point par jour où elle avait un prix. */
export function cardHistory(history: PriceHistoryFile | null, card: PokemonCard): PricePoint[] {
  if (!history) return []
  const series = seriesOf(history, card)
  return history.days.flatMap((date, day) => {
    const value = series[day]
    return value == null ? [] : [{ date, value }]
  })
}

/**
 * Une série sans trou : un jour sans prix prend celui de la veille ; avant le premier prix connu,
 * ce premier prix. Sans aucun prix, des zéros.
 */
function filled(series: readonly (number | null | undefined)[], days: number): number[] {
  let last = series.find((value) => value != null) ?? 0
  return Array.from({ length: days }, (_, day) => (last = series[day] ?? last))
}

/**
 * La valeur, jour par jour, des cartes données (celles possédées aujourd'hui) : la courbe de la
 * collection telle qu'elle est, pas telle qu'elle était. Un jour sans prix pour une carte (carte
 * entrée plus tard dans l'index) compte son prix connu le plus proche : pas de faux creux.
 */
export function collectionHistory(
  history: PriceHistoryFile | null,
  cards: readonly PokemonCard[],
): PricePoint[] {
  if (!history) return []
  const series = cards.map((card) => filled(seriesOf(history, card), history.days.length))
  return history.days.map((date, day) => ({
    date,
    value: series.reduce((sum, values) => sum + values[day]!, 0),
  }))
}
