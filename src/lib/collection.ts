/**
 * Les modifications de la collection : chacune rend une nouvelle collection, datée (`updatedAt`).
 * Elles ne modifient jamais l'objet reçu (« Annuler » repose dessus, voir `useCollectionAction`).
 */

import type { CardStatus, CollectionData, PokemonCard } from '@/types'

export const emptyCollection = (): CollectionData => ({
  schemaVersion: 1,
  updatedAt: null,
  entries: {},
  cards: {},
  customCards: {},
})

/** L'illustration choisie pour un Pokémon ; `null` la retire. */
export function setFavorite(
  data: CollectionData,
  speciesId: number,
  card: PokemonCard | null,
  now: string,
): CollectionData {
  const entry = { speciesId, favoriteCardId: card?.id ?? null, updatedAt: now }
  return { ...data, entries: { ...data.entries, [speciesId]: entry }, updatedAt: now }
}

/**
 * Le statut d'une carte ; `null` le retire, prix payé compris. Le prix payé suit la carte de
 * commandée à possédée ; souhaitée, elle n'en a pas. Une carte TAG TEAM possédée débloque chacun
 * de ses Pokémon : le statut appartient à la carte.
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

/** Une carte encore à acheter : ni possédée ni commandée. */
export const isToBuy = ({ status }: { status: CardStatus | null }) =>
  status !== 'owned' && status !== 'ordered'
