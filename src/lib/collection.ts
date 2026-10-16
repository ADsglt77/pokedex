/**
 * Les modifications de la collection : chacune rend une nouvelle collection, datée (`updatedAt`).
 * Elles ne modifient jamais l'objet reçu (« Annuler » repose dessus, voir `useCollectionAction`).
 */

import type { CardStatus, CollectionData, PokemonCard } from '@/types'

/** L'id d'une carte ajoutée par l'utilisateur (son format est celui de la collection enregistrée). */
export const newCardId = () => `manual:${crypto.randomUUID()}`

export const emptyCollection = (): CollectionData => ({
  schemaVersion: 1,
  updatedAt: null,
  cards: {},
  customCards: {},
})

/**
 * Le statut d'une carte ; `null` le retire, prix payé compris. Le prix payé suit la carte de
 * commandée à possédée ; souhaitée, elle n'en a pas.
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
    const paidPrice = status === 'wanted' ? undefined : previous?.paidPrice
    cards[card.id] = { status, updatedAt: now, acquiredAt, paidPrice }
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
 * Les Pokémon qui reçoivent une carte choisie pour `speciesId` : lui, et pour une carte de plusieurs
 * Pokémon (TAG TEAM), ceux d'entre eux qui n'ont pas encore de carte (`hasCard`). Une seule carte,
 * achetée une fois, qui les débloque tous ; un Pokémon qui a déjà la sienne la garde.
 */
export const cardSpecies = (
  cardDexIds: readonly number[],
  speciesId: number,
  hasCard: (id: number) => boolean,
) => [speciesId, ...cardDexIds.filter((id) => id !== speciesId && !hasCard(id))]

/**
 * Ajoute la carte d'un Pokémon, ou la corrige (même id : son statut et ses achats la suivent). Le
 * Pokémon n'en a qu'une : on retire l'ancienne avant d'en ajouter une autre.
 */
export function saveCard(data: CollectionData, card: PokemonCard, now: string): CollectionData {
  return { ...data, customCards: { ...data.customCards, [card.id]: card }, updatedAt: now }
}

/**
 * Retire la carte d'un Pokémon (`speciesId`). Une carte de plusieurs Pokémon reste celle des
 * autres, avec son statut, son prix payé et ses achats ; seule, elle quitte le Pokédex avec eux.
 */
export function removeCard(
  data: CollectionData,
  cardId: string,
  speciesId: number,
  now: string,
): CollectionData {
  const card = data.customCards[cardId]!
  if (card.dexIds.length > 1) {
    const kept = { ...card, dexIds: card.dexIds.filter((id) => id !== speciesId) }
    return { ...data, customCards: { ...data.customCards, [cardId]: kept }, updatedAt: now }
  }
  const customCards = { ...data.customCards }
  const cards = { ...data.cards }
  delete customCards[cardId]
  delete cards[cardId]
  return { ...data, customCards, cards, updatedAt: now }
}

/** Une carte encore à acheter : ni possédée ni commandée. */
export const isToBuy = ({ status }: { status: CardStatus | null }) =>
  status !== 'owned' && status !== 'ordered'

/**
 * Une carte encore à acheter, pour un Pokémon pas encore débloqué ni en route (`taken`) : la seule
 * que comptent le plan de la prochaine commande et l'estimation de la liste d'achats.
 */
export const stillWanted = (
  row: { status: CardStatus | null; card: { dexIds: readonly number[] } },
  taken: ReadonlySet<number>,
) => isToBuy(row) && row.card.dexIds.some((id) => !taken.has(id))
