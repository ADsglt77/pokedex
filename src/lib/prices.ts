/**
 * Les prix du jour appliqués à la collection : prix d'une carte, totaux par statut, coût pour
 * compléter le Pokédex, courbes au fil des jours, plus fortes hausses et baisses. Les prix de
 * Cardmarket, par l'id Cardmarket de chaque carte. Et les paquets d'ids de leurs demandes à l'API
 * des données, qui en refuse plus de 1 025 à la fois (le navigateur comme le serveur), et les
 * demandes de paquets l'une après l'autre (`loadInBatches`).
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { details, formatEuro, formatInteger, plural } from '@/lib/format'
import { cardsWithStatus, type PokedexEntry } from '@/lib/pokedex'
import type { PricePoint } from '@/lib/chart'
import { addDays, daysBetween } from '@/lib/time'
import type {
  CardPrice,
  CardPriceHistory,
  CardStatus,
  CollectionData,
  PokemonCard,
  PriceFile,
} from '@/types'

/**
 * Ces ids, chacun une fois, dans leur ordre, en paquets de `size` au plus : 1 000 par défaut, sous
 * les 1 025 que l'API des données accepte par demande (les historiques, les prix du Pokédex
 * public). Tout tient dans un paquet : une seule demande.
 */
export function idBatches(ids: readonly number[], size = 1000): number[][] {
  const unique = [...new Set(ids)]
  return Array.from({ length: Math.ceil(unique.length / size) }, (_, index) =>
    unique.slice(index * size, (index + 1) * size),
  )
}

/**
 * Les réponses de l'API des données pour ces ids (`load` : la demande d'un paquet, une clé par
 * id), par paquets de 1 000 (`idBatches`) demandés l'un après l'autre (le Worker du site n'accepte
 * que 30 de ces demandes par 10 s, `worker/limits.ts` : les historiques, les lignes de la liste de
 * souhaits), réunies ; `null` dès qu'un paquet manque, sans demander les suivants (une réponse
 * partielle serait fausse). Aucun id : aucune demande.
 */
export async function loadInBatches<T>(
  ids: readonly number[],
  load: (batch: number[]) => Promise<Record<string, T> | null>,
): Promise<Record<string, T> | null> {
  const found: Record<string, T> = {}
  for (const batch of idBatches(ids)) {
    const answer = await load(batch)
    if (!answer) return null
    Object.assign(found, answer)
  }
  return found
}

/**
 * Les paquets de prix du jour que le navigateur demande pour les cartes `ids` (`/api/prices`) :
 * des paquets fixes de 200 (une adresse courte), coupés dans la liste triée de toutes ces cartes,
 * d'après elle seule. Fixes : une réponse arrivée pour d'autres cartes ne décale aucun paquet ;
 * chacun garde son adresse, et une demande en cours ou en panne n'est pas refaite (`getJson`).
 * Seuls ceux dont une carte n'a pas encore sa réponse sont demandés (`store/prices.ts`).
 */
export const priceBatches = (ids: readonly number[]) =>
  idBatches(
    [...ids].sort((a, b) => a - b),
    200,
  )

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
  return row ? { price: row[0], low: row[1], monthAgo: row[2] } : null
}

/** Le prix du marché d'une carte ; `null` sans prix. */
export const marketPrice = (prices: PriceFile | null, card: Priced) =>
  priceOf(prices, card)?.price ?? null

/** « 12,40 € » ou « Sans prix ». */
export const priceLabel = (price: number | null) =>
  price === null ? 'Sans prix' : formatEuro(price)

/**
 * Le prix du jour d'une carte, écrit pour une tuile du catalogue : « 12,40 € », « Sans prix » ;
 * « — » quand les prix manquent (`missing`) ; `null` tant qu'ils arrivent.
 */
export const priceText = (prices: PriceFile | null, missing: boolean, card: Priced) =>
  prices ? priceLabel(marketPrice(prices, card)) : missing ? '—' : null

/**
 * L'évolution du prix sur 30 jours : 0,12 pour +12 %, −0,2 pour −20 % ; `null` sans prix d'il y a
 * 30 jours.
 */
export const priceChange = ({ price, monthAgo }: CardPrice) =>
  monthAgo ? (price - monthAgo) / monthAgo : null

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
  cardsWithStatus(collection).map(({ card, ownership }) => ({
    card,
    status: ownership.status,
    paid: ownership.paidPrice ?? null,
    value: marketPrice(prices, card),
  }))

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

/** Les totaux de chaque statut : possédées, commandées. */
export function tallyByStatus(cards: readonly TrackedCard[]): Record<CardStatus, Tally> {
  const tallies = { owned: emptyTally(), ordered: emptyTally() }
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

/**
 * « 3 cartes · payées 120,00 € · 1 sans prix ». `priced` : les prix sont là ; sans eux (pas encore
 * arrivés, ou indisponibles), chaque carte compterait « sans prix ».
 */
export const tallyHint = (tally: Tally, priced: boolean) =>
  details(
    plural(tally.count, 'carte', 'cartes'),
    tally.paid > 0 && `payées ${formatEuro(tally.paid)}`,
    priced && tally.unpriced > 0 && `${formatInteger(tally.unpriced)} sans prix`,
  )

/** Une carte dont le prix a bougé : son prix du jour, celui d'il y a 30 jours, l'évolution. */
interface PriceMove {
  card: PokemonCard
  price: number
  monthAgo: number
  /** L'évolution du prix sur 30 jours : 0,12 pour +12 %, −0,2 pour −20 %. */
  change: number
}

/**
 * Les cartes possédées dont le prix a le plus bougé en 30 jours, les `limit` plus fortes hausses
 * et les `limit` plus fortes baisses, en %.
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
    if (!price?.monthAgo || !change || seen.has(card.cardmarket!)) return []
    seen.add(card.cardmarket!)
    return Math.abs(change) < 0.05 || Math.abs(price.price - price.monthAgo) < 0.5
      ? []
      : [{ card, price: price.price, monthAgo: price.monthAgo, change }]
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
  /** Pokémon dont la favorite a un prix. */
  priced: number
  /** Pokémon dont la favorite n'a pas de prix Cardmarket ce jour. */
  unpriced: number
  /** Pokémon sans carte. */
  noCard: number
}

/**
 * Ce que coûterait de débloquer les Pokémon qui restent, au prix de leur favorite : on ne chiffre
 * que celle-là, pas les autres cartes d'un Pokémon. Un Pokémon déjà débloqué (par n'importe laquelle
 * de ses cartes) ou dont une carte est commandée compte dans la collection ou les commandes, pas
 * ici. Une carte de plusieurs Pokémon (TAG TEAM) n'est comptée qu'une fois : on ne l'achète qu'une
 * fois.
 */
export function completionCost(
  entries: readonly PokedexEntry[],
  prices: PriceFile | null,
): CompletionCost {
  const cost = { value: 0, priced: 0, unpriced: 0, noCard: 0 }
  const counted = new Set<string>()
  for (const { card, status } of entries) {
    if (!card) {
      cost.noCard++
      continue
    }
    // Obtenu ou en route : une de ses cartes est possédée ou commandée.
    if (status) continue
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

/** La courbe d'une carte : un point par jour où elle avait un prix. */
export function cardHistory(history: CardPriceHistory | null): PricePoint[] {
  if (!history) return []
  return history.prices.flatMap((value, day) =>
    value === null ? [] : [{ date: addDays(history.from, day), value }],
  )
}

/**
 * Les historiques des cartes `ids`, dans leur ordre, d'après ceux reçus du serveur, gardés par id
 * (`/api/histories`, `null` : pas d'historique) : un id qui revient (la même carte Cardmarket
 * possédée pour deux Pokémon) compte autant de fois, comme dans la valeur du jour. Un id sans
 * historique ne compte pas.
 */
export const historiesOf = (
  histories: ReadonlyMap<number, CardPriceHistory | null>,
  ids: readonly number[],
) => ids.flatMap((id) => histories.get(id) ?? [])

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
