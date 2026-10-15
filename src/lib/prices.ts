/**
 * Les prix du jour appliqués à la collection : prix d'une carte, totaux par statut, coût pour
 * compléter le Pokédex, courbes au fil des jours, plus fortes hausses et baisses. Les prix de
 * Cardmarket, par l'id Cardmarket de chaque carte.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { formatEuro } from '@/lib/format'
import { cardsWithStatus, isTaken, type PokedexEntry } from '@/lib/pokedex'
import { addDays, daysBetween } from '@/lib/time'
import type {
  CardPrice,
  CardPriceHistory,
  CardStatus,
  CollectionData,
  PokemonCard,
  PriceFile,
} from '@/types'

/** Ce qu'il faut d'une carte pour son prix : son id Cardmarket. */
interface Priced {
  cardmarket?: number
}

/**
 * Le prix du jour d'une carte chez Cardmarket, par son id ; `null` sans id, sans prix pour cet id
 * ce jour, ou sans fichier.
 */
export function priceOf(prices: PriceFile | null, card: Priced): CardPrice | null {
  const row = card.cardmarket && prices?.cards[card.cardmarket]
  return row ? { price: row[0], low: row[1], avg30: row[2] } : null
}

/** Le prix du marché d'une carte ; `null` sans prix. */
export const marketPrice = (prices: PriceFile | null, card: Priced) =>
  priceOf(prices, card)?.price ?? null

/** « 12,40 € » ou « Sans prix ». */
export const priceLabel = (price: number | null) =>
  price === null ? 'Sans prix' : formatEuro(price)

/**
 * L'écart du prix du jour à la moyenne sur 30 jours : 0,12 pour +12 %, −0,2 pour −20 % ; `null`
 * sans moyenne.
 */
export const priceChange = ({ price, avg30 }: CardPrice) => (avg30 ? (price - avg30) / avg30 : null)

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

export const trackedCards = (collection: CollectionData, prices: PriceFile | null): TrackedCard[] =>
  cardsWithStatus(collection).map(({ card, ownership }) => {
    return {
      card,
      status: ownership.status,
      paid: ownership.paidPrice ?? null,
      value: marketPrice(prices, card),
    }
  })

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

/** Une carte dont le prix a bougé : son prix du jour, sa moyenne sur 30 jours, l'écart. */
interface PriceMove {
  card: PokemonCard
  price: number
  avg30: number
  /** L'écart du prix du jour à la moyenne sur 30 jours : 0,12 pour +12 %, −0,2 pour −20 %. */
  change: number
}

/**
 * Les cartes possédées dont le prix a le plus bougé : l'écart du prix du jour à la moyenne sur 30
 * jours de Cardmarket, les `limit` plus fortes hausses et les `limit` plus fortes baisses, en %.
 * Un écart de moins de 5 % ou de moins de 0,50 € n'est que le bruit du marché : il n'y est pas.
 * Une carte possédée pour deux Pokémon n'y est qu'une fois.
 */
export function priceMovers(
  cards: readonly TrackedCard[],
  prices: PriceFile | null,
  limit: number,
): { risers: PriceMove[]; fallers: PriceMove[] } {
  const seen = new Set<number>()
  const moves = cards.flatMap(({ card, status }): PriceMove[] => {
    const price = status === 'owned' ? priceOf(prices, card) : null
    const change = price && priceChange(price)
    if (!price?.avg30 || !change || seen.has(card.cardmarket!)) return []
    seen.add(card.cardmarket!)
    return Math.abs(change) < 0.05 || Math.abs(price.price - price.avg30) < 0.5
      ? []
      : [{ card, price: price.price, avg30: price.avg30, change }]
  })
  moves.sort((a, b) => b.change - a.change)
  return {
    risers: moves.filter((move) => move.change > 0).slice(0, limit),
    fallers: moves
      .filter((move) => move.change < 0)
      .reverse()
      .slice(0, limit),
  }
}

export interface CompletionCost {
  /** Somme des prix des cartes chiffrées. */
  value: number
  /** Pokémon dont la carte a un prix. */
  priced: number
  /** Pokémon dont la carte n'a pas de prix Cardmarket ce jour. */
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
    const price = marketPrice(prices, card.card)
    if (price === null) {
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

/** La courbe d'une carte : un point par jour où elle avait un prix. */
export function cardHistory(history: CardPriceHistory | null): PricePoint[] {
  if (!history) return []
  return history.prices.flatMap((value, day) =>
    value === null ? [] : [{ date: addDays(history.from, day), value }],
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
    date: addDays(first, day),
    value: series.reduce((sum, values) => sum + values[day]!, 0),
  }))
}
