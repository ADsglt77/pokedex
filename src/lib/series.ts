/**
 * Les collections d'extensions : toutes les cartes d'une extension dans une langue, une case par
 * carte, dans l'ordre de l'extension (`CollectionData.series`). Chaque case est une carte du compte
 * (`customCards`) : une carte déjà là, la même (`sameCard` : même langue, même code ou même id
 * Cardmarket), est reprise ; les autres sont ajoutées comme cases pas encore obtenues
 * (`seriesOnly`), qui ne remplissent pas le Pokédex. Possédée une fois, une case devient pour de
 * bon une carte de ses Pokémon (`obtain`). La collection d'une carte (`seriesOf`) ; leur
 * progression : cases possédées, valeur, coût pour compléter.
 */

import { isCardOf, referenceCode, sameCard } from '@/lib/card-code'
import { cardLanguage, isToBuy, obtain } from '@/lib/collection'
import { isInAnOrder } from '@/lib/orders'
import { marketPrice } from '@/lib/prices'
import type {
  CardLanguage,
  CollectionData,
  Order,
  PokemonCard,
  PriceFile,
  SeriesCollection,
} from '@/types'

/** La collection de cette extension dans cette langue ; `null` si elle n'est pas commencée. */
export const findSeries = (data: CollectionData, set: string, language: CardLanguage) =>
  data.series.find((series) => series.set === set && cardLanguage(series) === language) ?? null

/**
 * La collection dont cette carte est une case : la première, pour une carte obtenue qui l'est de
 * plusieurs ; `null` si elle n'est dans aucune.
 */
export const seriesOf = (data: CollectionData, cardId: string) =>
  data.series.find((series) => series.cards.includes(cardId)) ?? null

/**
 * Commence la collection d'une extension, à la fin des autres, avec ses cases (`slots` : une
 * nouvelle carte `seriesOnly` par carte de l'extension, dans son ordre). Une carte du compte qui
 * est la même qu'une case (`sameCard`) la prend, telle quelle (son statut, ses achats et sa place
 * au Pokédex ne changent pas) : une case chacune, celle de son code d'abord, sinon celle de son id
 * Cardmarket ; sinon la case est ajoutée. Une case pas encore obtenue d'une autre collection n'est
 * jamais reprise. Le Pokédex et les favorites n'en changent pas.
 */
export function startSeries(
  data: CollectionData,
  { set, language, name }: { set: string; language: CardLanguage; name: string },
  slots: PokemonCard[],
  now: string,
): CollectionData {
  // Les cartes du compte qui peuvent encore prendre une case : la première qui convient la prend.
  // Pas une case pas encore obtenue d'une autre collection : supprimer celle-ci la retirerait.
  const free = Object.values(data.customCards).filter((card) => !card.seriesOnly)
  const take = (fits: (card: PokemonCard) => boolean) => {
    const index = free.findIndex(fits)
    return index === -1 ? undefined : free.splice(index, 1)[0]
  }
  // Chaque carte va d'abord à la case de son code : deux cases peuvent avoir le même id Cardmarket.
  const byCode = slots.map((slot) => {
    const code = referenceCode(slot.reference)
    return take((card) => isCardOf(card, cardLanguage(slot), code, undefined))
  })
  const customCards = { ...data.customCards }
  const cards = slots.map((slot, index) => {
    const card = byCode[index] ?? take((known) => sameCard(known, slot))
    if (card) return card.id
    customCards[slot.id] = slot
    return slot.id
  })
  const series: SeriesCollection = {
    set,
    ...(language === 'fr' && { language }),
    name,
    startedAt: now,
    cards,
  }
  return { ...data, customCards, series: [...data.series, series], updatedAt: now }
}

/**
 * Supprime la collection de cette extension dans cette langue. Ses cartes possédées restent (et
 * donc au Pokédex), comme une carte du compte reprise comme case ; une case commandée, ou dans une
 * commande (`orders`, quel que soit son état : le registre ne perd rien), reste comme carte seule
 * de ses Pokémon (`obtain`, favorite de ceux qui n'en ont pas) ; les autres cases disparaissent.
 */
export function removeSeries(
  data: CollectionData,
  set: string,
  language: CardLanguage,
  orders: readonly Order[],
  now: string,
): CollectionData {
  const removed = findSeries(data, set, language)!
  const customCards = { ...data.customCards }
  const kept: string[] = []
  for (const id of removed.cards) {
    if (!data.customCards[id]!.seriesOnly) continue
    if (data.cards[id] || isInAnOrder(orders, id)) kept.push(id)
    else delete customCards[id]
  }
  const series = data.series.filter((known) => known !== removed)
  return obtain({ ...data, customCards, series, updatedAt: now }, kept)
}

/** Où en est une collection d'extension. */
interface SeriesProgress {
  /** Ses cases possédées. */
  owned: number
  /** Toutes ses cases. */
  total: number
  /** Le prix du marché de ses cases possédées. */
  value: number
  /** Le prix du marché de ses cases ni possédées ni commandées : le coût pour la compléter. */
  toComplete: number
  /** Celles de ces cases à acheter qui n'ont pas de prix, absentes de `toComplete`. */
  unpriced: number
}

/** La progression d'une collection : chaque case une fois, même une carte de plusieurs Pokémon. */
export function seriesProgress(
  data: CollectionData,
  series: SeriesCollection,
  prices: PriceFile | null,
): SeriesProgress {
  const progress = { owned: 0, total: series.cards.length, value: 0, toComplete: 0, unpriced: 0 }
  for (const id of series.cards) {
    const status = data.cards[id]?.status ?? null
    const price = marketPrice(prices, data.customCards[id]!)
    if (status === 'owned') {
      progress.owned++
      progress.value += price ?? 0
    } else if (isToBuy({ status })) {
      if (price === null) progress.unpriced++
      else progress.toComplete += price
    }
  }
  return progress
}
