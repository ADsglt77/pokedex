/**
 * Les prix Cardmarket appliqués à la collection : prix d'une carte, totaux par statut, coût pour
 * compléter le Pokédex, courbes au fil des jours.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { indexCard, tcgdexIdOf } from '@/lib/catalog'
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

/** Une carte suivie : ce qu'elle a coûté, ce qu'elle vaut. */
export interface TrackedCard {
  card: PokemonCard
  status: CardStatus
  paid: number | null
  value: number | null
}

export function trackedCards(collection: CollectionData, prices: PriceFile | null): TrackedCard[] {
  return Object.entries(collection.cards).flatMap(([cardId, ownership]) => {
    const card = indexCard(cardId) ?? collection.customCards[cardId]
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
  /** Somme, pour chaque Pokémon à débloquer, de sa candidate la moins chère. */
  value: number
  /** Pokémon chiffrés. */
  priced: number
  /** Pokémon à débloquer dont aucune candidate n'a de prix (ou sans candidate). */
  unpriced: number
}

/**
 * Ce que coûterait de débloquer les Pokémon qui restent, à la candidate la moins chère. Un
 * Pokémon dont une carte est déjà commandée compte dans les commandes, pas ici.
 */
function completionCost(entries: readonly PokedexEntry[], prices: PriceFile | null) {
  const cost: CompletionCost = { value: 0, priced: 0, unpriced: 0 }
  for (const entry of entries) {
    if (entry.unlocked || entry.statusCounts.ordered > 0) continue
    const cheapest = Math.min(
      ...entry.candidates.map((candidate) => priceOf(prices, candidate.card)?.price ?? Infinity),
    )
    if (cheapest === Infinity) cost.unpriced++
    else {
      cost.value += cheapest
      cost.priced++
    }
  }
  return cost
}

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
 * La valeur, jour par jour, des cartes données (celles possédées aujourd'hui) : la courbe de la
 * collection telle qu'elle est, pas telle qu'elle était.
 */
export function collectionHistory(
  history: PriceHistoryFile | null,
  cards: readonly PokemonCard[],
): PricePoint[] {
  if (!history) return []
  const series = cards.map((card) => seriesOf(history, card))
  return history.days.map((date, day) => ({
    date,
    value: series.reduce((sum, values) => sum + (values[day] ?? 0), 0),
  }))
}
