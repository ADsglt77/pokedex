/** Prix Cardmarket : prix d'une carte, valeur de la collection, coût pour compléter, historique. */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { indexCard } from '@/lib/catalog'
import type { PokedexEntry } from '@/lib/pokedex'
import { tcgdexIdOf } from '@/lib/rarity'
import type {
  CardPrice,
  CardStatus,
  CollectionData,
  PokemonCard,
  PriceFile,
  PriceHistoryFile,
} from '@/types'

/** Prix du jour d'une carte ; `null` sans fichier de prix, ou pour une carte sans prix. */
export function priceOf(
  prices: PriceFile | null,
  card: Pick<PokemonCard, 'id' | 'source'>,
): CardPrice | null {
  const id = tcgdexIdOf(card)
  return (prices && id && prices.cards[id]) || null
}

/** Une carte suivie, avec ce qu'elle a coûté et ce qu'elle vaut. */
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
  /** Somme des prix payés connus. */
  paid: number
  /** Valeur des seules cartes dont le prix payé est connu : à comparer à `paid`. */
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
 * Pokémon dont une carte est déjà commandée est compté dans les commandes, pas ici.
 */
function completionCost(
  entries: readonly PokedexEntry[],
  prices: PriceFile | null,
): CompletionCost {
  const cost: CompletionCost = { value: 0, priced: 0, unpriced: 0 }
  for (const entry of entries) {
    if (entry.unlocked || entry.statusCounts.ordered > 0) continue
    const cheapest = Math.min(
      ...entry.candidates.map((candidate) => priceOf(prices, candidate.card)?.price ?? Infinity),
    )
    if (Number.isFinite(cheapest)) {
      cost.value += cheapest
      cost.priced++
    } else cost.unpriced++
  }
  return cost
}

export function completionByGeneration(
  entries: readonly PokedexEntry[],
  prices: PriceFile | null,
): { generation: Generation; cost: CompletionCost }[] {
  return GENERATIONS.map((generation) => ({
    generation,
    cost: completionCost(
      entries.filter((entry) => entry.species.generation === generation.id),
      prices,
    ),
  }))
}

export interface PricePoint {
  date: string
  value: number
}

/** La courbe d'une carte : un point par jour où elle avait un prix. */
export function cardHistory(history: PriceHistoryFile | null, card: PokemonCard): PricePoint[] {
  const series = history?.cards[tcgdexIdOf(card) ?? '']
  if (!history || !series) return []
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
  const series = cards
    .map((card) => history.cards[tcgdexIdOf(card) ?? ''])
    .filter((values) => values !== undefined)
  return history.days.map((date, day) => ({
    date,
    value: series.reduce((sum, values) => sum + (values[day] ?? 0), 0),
  }))
}
