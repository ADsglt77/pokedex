/**
 * Les collections d'extensions : toutes les cartes d'une extension dans une langue, une case par
 * carte, dans l'ordre de l'extension (`CollectionData.series`). Chaque case est une carte du compte
 * (`customCards`) : une carte déjà là, la même (même langue, même code ou même id Cardmarket :
 * `cardCodeKey`, `cardmarketKey`), est reprise ; les autres sont ajoutées comme cases pas encore obtenues
 * (`seriesOnly`), qui ne remplissent pas le Pokédex. Possédée une fois, une case devient pour de
 * bon une carte de ses Pokémon (`obtain`). Ce qui distingue une collection (`seriesId`) ; la
 * collection d'une carte (`seriesOf`) ; ce que la suppression d'une collection fait de ses cases
 * (`seriesRemoval`) ; leur progression : cases possédées, valeur, coût pour compléter.
 */

import { cardCodeKey, cardmarketKey } from '@/lib/card-code'
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

/**
 * Ce qui distingue une collection des autres : sa langue et son extension (« fr MEG »), un même
 * code existant dans les deux langues. Sa clé dans une liste ; au journal du serveur, ce qui la
 * retrouve d'une version du document à l'autre.
 */
export const seriesId = (series: Pick<SeriesCollection, 'set' | 'language'>) =>
  `${cardLanguage(series)} ${series.set}`

/** La collection de cette extension dans cette langue ; `null` si elle n'est pas commencée. */
export const findSeries = (data: CollectionData, set: string, language: CardLanguage) =>
  data.series.find((series) => series.set === set && cardLanguage(series) === language) ?? null

/**
 * La collection dont cette carte est une case : la première, pour une carte obtenue qui l'est de
 * plusieurs ; `null` si elle n'est dans aucune.
 */
export const seriesOf = (data: CollectionData, cardId: string) =>
  data.series.find((series) => series.cards.includes(cardId)) ?? null

/** Les cartes de chaque clé (`key`), dans leur ordre ; une carte sans clé n'y est pas. */
function byKey(cards: readonly PokemonCard[], key: (card: PokemonCard) => string | null) {
  const index = new Map<string, PokemonCard[]>()
  for (const card of cards) {
    const value = key(card)
    if (value === null) continue
    const known = index.get(value)
    if (known) known.push(card)
    else index.set(value, [card])
  }
  return index
}

/**
 * Commence la collection d'une extension, à la fin des autres, avec ses cases (`slots` : une
 * nouvelle carte `seriesOnly` par carte de l'extension, dans son ordre). Une carte du compte qui
 * est la même qu'une case (même clé de code, sinon même clé Cardmarket : `lib/card-code.ts`) la
 * prend, telle quelle (son statut, ses achats et sa place au Pokédex ne changent pas) : une case
 * chacune, celle de son code d'abord, sinon celle de son id Cardmarket ; sinon la case est
 * ajoutée. Une case pas encore obtenue d'une autre collection n'est jamais reprise. Le Pokédex et
 * les favorites n'en changent pas.
 */
export function startSeries(
  data: CollectionData,
  { set, language, name }: { set: string; language: CardLanguage; name: string },
  slots: PokemonCard[],
  now: string,
): CollectionData {
  // Les cartes du compte qui peuvent encore prendre une case, rangées par clé, chacune lue une
  // fois : le compte peut en avoir des milliers, et le clic attend. Pas une case pas encore obtenue
  // d'une autre collection : supprimer celle-ci la retirerait.
  const free = Object.values(data.customCards).filter((card) => !card.seriesOnly)
  const byCode = byKey(free, cardCodeKey)
  const byCardmarket = byKey(free, cardmarketKey)
  const taken = new Set<PokemonCard>()
  // La première carte libre de cette clé prend la case, et n'en prend pas d'autre.
  const take = (index: Map<string, PokemonCard[]>, key: string | null) => {
    const cards = key === null ? [] : (index.get(key) ?? [])
    let card = cards.shift()
    while (card && taken.has(card)) card = cards.shift()
    if (card) taken.add(card)
    return card
  }
  // Chaque carte va d'abord à la case de son code : deux cases peuvent avoir le même id Cardmarket.
  const ofCode = slots.map((slot) => take(byCode, cardCodeKey(slot)))
  const customCards = { ...data.customCards }
  const cards = slots.map((slot, index) => {
    const card = ofCode[index] ?? take(byCardmarket, cardmarketKey(slot))
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

/** Ce que deviennent les cases d'une collection qu'on supprime (`removeSeries`) : leurs ids. */
interface SeriesRemoval {
  /** Possédées : elles restent dans le compte (et au Pokédex pour celles d'un Pokémon). */
  owned: string[]
  /** Des cartes ajoutées seules (pas `seriesOnly`), pas possédées : elles restent telles quelles. */
  alone: string[]
  /** Pas encore obtenues, commandées ou dans une commande : elles restent comme cartes seules. */
  kept: string[]
  /**
   * Pas encore obtenues, ni commandées ni dans une commande ; et un dresseur ou une énergie qui
   * n'est ni possédé, ni dans une commande, ni case d'une autre collection : elles partent, avec
   * leur statut.
   */
  dropped: string[]
}

/**
 * Ce que la suppression d'une collection fait de chacune de ses cases (`orders` : toutes les
 * commandes, quel que soit leur état, le registre ne perd rien) : ce que dit sa confirmation, ce
 * que fait `removeSeries`. Une carte sans Pokémon (un dresseur, une énergie) n'a pas d'autre page
 * que ses collections : sans elles, rien ne la montrerait plus, ni ne pourrait la changer ou la
 * retirer ; elle ne reste que possédée, dans une commande ou case d'une autre collection
 * (commandée à la main, sans commande, elle part).
 */
export function seriesRemoval(
  data: CollectionData,
  series: SeriesCollection,
  orders: readonly Order[],
): SeriesRemoval {
  const removal: SeriesRemoval = { owned: [], alone: [], kept: [], dropped: [] }
  // Les cases des autres collections : une carte obtenue peut l'être de plusieurs.
  const elsewhere = new Set(data.series.flatMap((other) => (other === series ? [] : other.cards)))
  for (const id of series.cards) {
    const card = data.customCards[id]!
    const status = data.cards[id]?.status
    const ordered = isInAnOrder(orders, id)
    if (card.dexIds.length === 0 && !elsewhere.has(id) && status !== 'owned' && !ordered) {
      removal.dropped.push(id)
    } else if (!card.seriesOnly) removal[status === 'owned' ? 'owned' : 'alone'].push(id)
    else if (status || ordered) removal.kept.push(id)
    else removal.dropped.push(id)
  }
  return removal
}

/**
 * Supprime la collection de cette extension dans cette langue (`seriesRemoval`). Ses cartes
 * possédées restent (et au Pokédex pour celles d'un Pokémon), comme une carte du compte reprise
 * comme case ; une case commandée, ou dans une commande, reste comme carte seule de ses Pokémon
 * (`obtain`, favorite de ceux qui n'en ont pas) ; les autres cases disparaissent, avec leur statut.
 */
export function removeSeries(
  data: CollectionData,
  set: string,
  language: CardLanguage,
  orders: readonly Order[],
  now: string,
): CollectionData {
  const removed = findSeries(data, set, language)!
  const { kept, dropped } = seriesRemoval(data, removed, orders)
  const customCards = { ...data.customCards }
  const cards = { ...data.cards }
  for (const id of dropped) {
    delete customCards[id]
    delete cards[id]
  }
  const series = data.series.filter((known) => known !== removed)
  return obtain({ ...data, cards, customCards, series, updatedAt: now }, kept)
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
