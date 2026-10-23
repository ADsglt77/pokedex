/**
 * Les modifications de la collection : chacune rend une nouvelle collection, datée (`updatedAt`).
 * Elles ne modifient jamais l'objet reçu (« Annuler » repose dessus, voir `useCollectionAction`).
 */

import type { CardLanguage, CardStatus, CollectionData, PokemonCard } from '@/types'

/** L'id d'une carte ajoutée par l'utilisateur (son format est celui de la collection enregistrée). */
export const newCardId = () => `manual:${crypto.randomUUID()}`

/**
 * La langue d'une carte (ou d'une collection d'extension) : française si elle le dit, sinon
 * japonaise (les cartes d'avant).
 */
export const cardLanguage = (card: Pick<PokemonCard, 'language'>): CardLanguage =>
  card.language ?? 'ja'

/** Une carte ajoutée par l'utilisateur ; `null` si elle n'existe pas (ou plus). */
export const findCard = (id: string, collection: CollectionData): PokemonCard | null =>
  collection.customCards[id] ?? null

export const emptyCollection = (): CollectionData => ({
  schemaVersion: 1,
  updatedAt: null,
  cards: {},
  customCards: {},
  favorites: {},
  series: [],
})

/**
 * Le statut d'une carte ; `null` le retire, prix payé compris. Le prix payé suit la carte de
 * commandée à possédée. Possédée, une case d'extension devient une carte de ses Pokémon (`obtain`).
 */
export function setCardStatus(
  data: CollectionData,
  card: PokemonCard,
  status: CardStatus | null,
  now: string,
): CollectionData {
  const { [card.id]: previous, ...cards } = data.cards
  if (status) {
    const acquiredAt = status === 'owned' ? now : null
    cards[card.id] = { status, updatedAt: now, acquiredAt, paidPrice: previous?.paidPrice }
  }
  const updated = { ...data, cards, updatedAt: now }
  return status === 'owned' ? obtain(updated, [card.id]) : updated
}

/**
 * Des cartes obtenues (possédées) : celles qui sont des cases d'extension (`seriesOnly`) le
 * perdent pour de bon et deviennent des cartes de leurs Pokémon, favorites de ceux qui n'en ont
 * pas. Les autres, et un id sans carte, ne changent rien. `updatedAt` est celui de l'appelant ;
 * sans case obtenue, la même collection.
 */
export function obtain(data: CollectionData, cardIds: Iterable<string>): CollectionData {
  const obtained = [...cardIds].flatMap((id) => {
    const card = data.customCards[id]
    if (!card?.seriesOnly) return []
    const { seriesOnly, ...kept } = card
    return [kept]
  })
  if (obtained.length === 0) return data
  return {
    ...data,
    customCards: { ...data.customCards, ...Object.fromEntries(obtained.map((c) => [c.id, c])) },
    favorites: completeFavorites(data.favorites, obtained),
  }
}

/**
 * Une case d'extension pas encore obtenue, ajoutée seule (« Ajouter à la collection » du
 * Catalogue, la fenêtre d'ajout d'une fiche) : une carte n'existe qu'une fois, la case devient une
 * carte de ses Pokémon (`obtain` : favorite de ceux qui n'en ont pas), avec son statut, et reste une
 * case de sa collection.
 */
export const adopt = (data: CollectionData, cardId: string, now: string): CollectionData => ({
  ...obtain(data, [cardId]),
  updatedAt: now,
})

/** Le prix payé d'une carte suivie ; `undefined` l'efface. Inchangé : la même collection. */
export function setPaidPrice(
  data: CollectionData,
  card: PokemonCard,
  paidPrice: number | undefined,
  now: string,
): CollectionData {
  const ownership = data.cards[card.id]!
  if (ownership.paidPrice === paidPrice) return data
  const updated = { ...ownership, paidPrice, updatedAt: now }
  return { ...data, cards: { ...data.cards, [card.id]: updated }, updatedAt: now }
}

/**
 * Les favorites, complétées : chaque Pokémon de ces cartes qui n'a pas de favorite reçoit la
 * première d'entre elles qui le porte ; celles qui existent ne changent pas. Une case d'extension
 * pas encore obtenue (`seriesOnly`) n'est pas encore une carte de ses Pokémon : elle n'en donne
 * pas. Une nouvelle table.
 */
export function completeFavorites(
  favorites: Record<number, string>,
  cards: Iterable<PokemonCard>,
): Record<number, string> {
  const completed = { ...favorites }
  for (const { id, dexIds, seriesOnly } of cards) {
    if (seriesOnly) continue
    for (const dexId of dexIds) completed[dexId] ??= id
  }
  return completed
}

/**
 * Ajoute une carte, ou la corrige (même id : son statut et ses achats la suivent). Un Pokémon peut
 * avoir plusieurs cartes ; sa première devient sa favorite d'office, les favorites déjà là restent.
 */
export function saveCard(data: CollectionData, card: PokemonCard, now: string): CollectionData {
  return {
    ...data,
    customCards: { ...data.customCards, [card.id]: card },
    favorites: completeFavorites(data.favorites, [card]),
    updatedAt: now,
  }
}

/** La carte favorite d'un Pokémon, celle qu'on montre pour lui ; les autres n'y changent rien. */
export function setFavorite(
  data: CollectionData,
  speciesId: number,
  cardId: string,
  now: string,
): CollectionData {
  return { ...data, favorites: { ...data.favorites, [speciesId]: cardId }, updatedAt: now }
}

/**
 * Retire une carte d'un Pokémon (`speciesId`). Une carte de plusieurs Pokémon reste celle des
 * autres, avec son statut, son prix payé, ses achats et sa place de favorite ; seule, elle quitte
 * le Pokédex avec eux. Si c'était la favorite de ce Pokémon, `favorite` (l'une de ses autres
 * cartes, que l'appelant donne quand il en garde) la remplace ; sans autre carte, il n'a plus de
 * favorite.
 */
export function removeCard(
  data: CollectionData,
  cardId: string,
  speciesId: number,
  now: string,
  favorite?: string,
): CollectionData {
  const favorites = { ...data.favorites }
  if (favorites[speciesId] === cardId) {
    if (favorite) favorites[speciesId] = favorite
    else delete favorites[speciesId]
  }
  const card = data.customCards[cardId]!
  if (card.dexIds.length > 1) {
    const kept = { ...card, dexIds: card.dexIds.filter((id) => id !== speciesId) }
    return {
      ...data,
      customCards: { ...data.customCards, [cardId]: kept },
      favorites,
      updatedAt: now,
    }
  }
  const customCards = { ...data.customCards }
  const cards = { ...data.cards }
  delete customCards[cardId]
  delete cards[cardId]
  return { ...data, customCards, cards, favorites, updatedAt: now }
}

/** Une carte encore à acheter : ni possédée ni commandée. */
export const isToBuy = ({ status }: { status: CardStatus | null }) =>
  status !== 'owned' && status !== 'ordered'
