/**
 * Les modifications de la collection : chacune rend une nouvelle collection, datée (`updatedAt`).
 * Elles ne modifient jamais l'objet reçu (« Annuler » repose dessus, voir `useCollectionAction`).
 */

import type { CardLanguage, CardStatus, CollectionData, PokemonCard } from '@/types'

/** L'id d'une carte ajoutée par l'utilisateur (son format est celui de la collection enregistrée). */
export const newCardId = () => `manual:${crypto.randomUUID()}`

/** La langue d'une carte : française si elle le dit, sinon japonaise (les cartes d'avant). */
export const cardLanguage = (card: PokemonCard): CardLanguage => card.language ?? 'ja'

/** Une carte ajoutée par l'utilisateur ; `null` si elle n'existe pas (ou plus). */
export const findCard = (id: string, collection: CollectionData): PokemonCard | null =>
  collection.customCards[id] ?? null

export const emptyCollection = (): CollectionData => ({
  schemaVersion: 1,
  updatedAt: null,
  cards: {},
  customCards: {},
  favorites: {},
})

/**
 * Le statut d'une carte ; `null` le retire, prix payé compris. Le prix payé suit la carte de
 * commandée à possédée.
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
  return { ...data, cards, updatedAt: now }
}

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
 * première d'entre elles qui le porte ; celles qui existent ne changent pas. Une nouvelle table.
 */
export function completeFavorites(
  favorites: Record<number, string>,
  cards: Iterable<PokemonCard>,
): Record<number, string> {
  const completed = { ...favorites }
  for (const { id, dexIds } of cards) {
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
