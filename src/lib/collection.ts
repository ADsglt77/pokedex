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
 * Le statut d'une carte ; `null` le retire, prix payé compris. Le prix payé suit la carte d'un
 * statut à l'autre (commandée, puis possédée). Une carte TAG TEAM possédée débloque chacun de ses
 * Pokémon : le statut appartient à la carte.
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

/** Une carte encore à acheter : ni possédée ni commandée. */
export const isToBuy = ({ status }: { status: CardStatus | null }) =>
  status !== 'owned' && status !== 'ordered'

export interface CollectionSummary {
  owned: number
  ordered: number
  wanted: number
  favorites: number
}

export function summarize(data: CollectionData): CollectionSummary {
  const summary = {
    owned: 0,
    ordered: 0,
    wanted: 0,
    favorites: Object.values(data.entries).filter((entry) => entry.favoriteCardId).length,
  }
  for (const ownership of Object.values(data.cards)) summary[ownership.status]++
  return summary
}

export const isEmptySummary = (summary: CollectionSummary) =>
  Object.values(summary).every((count) => count === 0)
