/**
 * Les prix Cardmarket appliqués à la collection : prix d'une carte, totaux par statut, coût pour
 * compléter le Pokédex, courbes au fil des jours.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { findCard } from '@/lib/catalog'
import { isTaken, type PokedexEntry } from '@/lib/pokedex'
import type {
  CardPrice,
  CardPriceHistory,
  CardStatus,
  CollectionData,
  PokemonCard,
  PriceFile,
} from '@/types'

/** Le prix du jour d'une carte, par son id Cardmarket ; `null` sans id, sans prix ou sans fichier. */
export function priceOf(
  prices: PriceFile | null,
  card: Pick<PokemonCard, 'cardmarket'>,
): CardPrice | null {
  const row = card.cardmarket === undefined ? undefined : prices?.cards[card.cardmarket]
  return row ? { price: row[0], low: row[1], avg30: row[2] } : null
}

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
  /** Somme des prix des cartes chiffrées. */
  value: number
  /** Pokémon dont la carte a un prix. */
  priced: number
  /** Pokémon dont la carte n'a pas de prix (pas d'id Cardmarket, ou pas de prix ce jour). */
  unpriced: number
  /** Pokémon sans carte. */
  noCard: number
}

/**
 * Ce que coûterait de débloquer les Pokémon qui restent, au prix de leur carte. Un Pokémon dont la
 * carte est déjà commandée compte dans les commandes, pas ici. Une carte de plusieurs Pokémon
 * (TAG TEAM d'une ancienne version) n'est comptée qu'une fois.
 */
export function completionCost(
  entries: readonly PokedexEntry[],
  prices: PriceFile | null,
): CompletionCost {
  const cost = { value: 0, priced: 0, unpriced: 0, noCard: 0 }
  const counted = new Set<string>()
  for (const { card } of entries.filter((entry) => !isTaken(entry))) {
    if (!card) {
      cost.noCard++
      continue
    }
    const price = priceOf(prices, card.card)?.price
    if (price === undefined) {
      cost.unpriced++
      continue
    }
    cost.priced++
    if (!counted.has(card.card.id)) cost.value += price
    counted.add(card.card.id)
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

const DAY = 86_400_000

/** Le jour (YYYY-MM-DD) `day` jours après `from`. */
const dayAfter = (from: string, day: number) =>
  new Date(Date.parse(from) + day * DAY).toISOString().slice(0, 10)

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY)

/** La courbe d'une carte : un point par jour où elle avait un prix. */
export function cardHistory(history: CardPriceHistory | null): PricePoint[] {
  if (!history) return []
  return history.prices.flatMap((value, day) =>
    value === null ? [] : [{ date: dayAfter(history.from, day), value }],
  )
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
 * La valeur, jour par jour, des cartes données (celles possédées aujourd'hui), d'après leurs
 * historiques : la courbe de la collection telle qu'elle est, pas telle qu'elle était. Un jour
 * sans prix pour une carte (avant son premier prix connu) compte son prix connu le plus proche :
 * pas de faux creux.
 */
export function collectionHistory(histories: readonly CardPriceHistory[]): PricePoint[] {
  if (histories.length === 0) return []
  const first = histories.map((history) => history.from).sort()[0]!
  const days = Math.max(
    ...histories.map((history) => daysBetween(first, history.from) + history.prices.length),
  )
  const series = histories.map((history) => {
    const offset = daysBetween(first, history.from)
    return filled(
      Array.from({ length: days }, (_, day) => history.prices[day - offset]),
      days,
    )
  })
  return Array.from({ length: days }, (_, day) => ({
    date: dayAfter(first, day),
    value: series.reduce((sum, values) => sum + values[day]!, 0),
  }))
}
