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
 * Ajoute la carte d'un Pokémon, ou la corrige (même id : son statut et ses achats la suivent). Le
 * Pokémon n'en a qu'une : on retire l'ancienne avant d'en ajouter une autre.
 */
export function saveCard(data: CollectionData, card: PokemonCard, now: string): CollectionData {
  return { ...data, customCards: { ...data.customCards, [card.id]: card }, updatedAt: now }
}

/** Retire une carte du Pokédex, avec son statut et son prix payé. */
export function removeCard(data: CollectionData, cardId: string, now: string): CollectionData {
  const customCards = { ...data.customCards }
  const cards = { ...data.cards }
  delete customCards[cardId]
  delete cards[cardId]
  return { ...data, customCards, cards, updatedAt: now }
}

/** Une carte encore à acheter : ni possédée ni commandée. */
export const isToBuy = ({ status }: { status: CardStatus | null }) =>
  status !== 'owned' && status !== 'ordered'
