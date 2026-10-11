/**
 * Mises à jour de la collection. Chaque fonction rend une nouvelle collection (avec `updatedAt`
 * à jour) ou la même quand rien ne change.
 */

import type { CardStatus, CollectionData, PokemonCard } from '@/types'

export const CARD_STATUSES: readonly CardStatus[] = ['owned', 'ordered', 'wanted']

export function emptyCollection(): CollectionData {
  return {
    schemaVersion: 1,
    updatedAt: null,
    entries: {},
    cards: {},
    customCards: {},
    imageOverrides: {},
  }
}

/** Un favori n'est jamais une possession. Retiré, il reste une entrée `null`. */
export function setFavorite(
  data: CollectionData,
  speciesId: number,
  card: PokemonCard | null,
  now: string,
): CollectionData {
  const key = String(speciesId)
  if ((data.entries[key]?.favoriteCardId ?? null) === (card?.id ?? null)) return data
  const entry = { speciesId, favoriteCardId: card?.id ?? null, updatedAt: now }
  return { ...data, entries: { ...data.entries, [key]: entry }, updatedAt: now }
}

/**
 * Un seul statut par carte, `null` le retire (prix payé compris). `acquiredAt` est posé au passage
 * à « possédée » ; le prix payé suit la carte d'un statut à l'autre (commandée, puis possédée).
 * Le statut appartient à la carte : une carte TAG TEAM possédée débloque chacune de ses espèces.
 */
export function setCardStatus(
  data: CollectionData,
  card: PokemonCard,
  status: CardStatus | null,
  now: string,
): CollectionData {
  const previous = data.cards[card.id]
  if ((previous?.status ?? null) === status) return data
  const { [card.id]: _previous, ...cards } = data.cards
  if (status !== null) {
    cards[card.id] = {
      status,
      updatedAt: now,
      acquiredAt: status === 'owned' ? now : null,
      ...(previous?.paidPrice !== undefined && { paidPrice: previous.paidPrice }),
    }
  }
  return { ...data, cards, updatedAt: now }
}

/** Le prix payé d'une carte suivie (possédée ou commandée) ; `null` l'efface. */
export function setPaidPrice(
  data: CollectionData,
  card: PokemonCard,
  paidPrice: number | null,
  now: string,
): CollectionData {
  const ownership = data.cards[card.id]
  if (!ownership || (ownership.paidPrice ?? null) === paidPrice) return data
  const { paidPrice: _previous, ...rest } = ownership
  const next = paidPrice === null ? rest : { ...rest, paidPrice }
  return {
    ...data,
    cards: { ...data.cards, [card.id]: { ...next, updatedAt: now } },
    updatedAt: now,
  }
}

export interface CollectionSummary {
  owned: number
  ordered: number
  wanted: number
  favorites: number
}

export function summarize(data: CollectionData): CollectionSummary {
  const summary: CollectionSummary = {
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
