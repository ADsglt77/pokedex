/**
 * Les candidates d'un Pokémon : les cartes qui peuvent l'illustrer, et celle qui le représente.
 */

import { RARITY_CLASSES } from '@/config/rarities'
import { indexCard, indexCardsFor } from '@/lib/catalog'
import { findRarityClass, isEligible } from '@/lib/rarity'
import type { CardStatus, CollectionData, PokemonCard } from '@/types'

/** Une carte et ce que l'utilisateur en a fait : prête à afficher. */
export interface CardView {
  card: PokemonCard
  status: CardStatus | null
  isFavorite: boolean
  /** Date d'obtention, pour une carte possédée. */
  acquiredAt: string | null
}

function describeCard(card: PokemonCard, collection: CollectionData, speciesId: number): CardView {
  const ownership = collection.cards[card.id]
  return {
    card,
    status: ownership?.status ?? null,
    isFavorite: collection.entries[speciesId]?.favoriteCardId === card.id,
    acquiredAt: ownership?.status === 'owned' ? ownership.acquiredAt : null,
  }
}

/**
 * Les candidates d'un Pokémon, la meilleure d'abord : ses cartes de l'index dont la classe est
 * suivie, plus les cartes d'une ancienne version (toujours candidates).
 */
export function buildCandidates(
  speciesId: number,
  collection: CollectionData,
  enabledCodes: readonly string[],
): CardView[] {
  const legacy = Object.values(collection.customCards).filter((card) =>
    card.dexIds.includes(speciesId),
  )
  const indexed = indexCardsFor(speciesId).filter((card) => isEligible(card, enabledCodes))
  // Une carte présente des deux côtés : la version de l'index, plus complète.
  const cards = new Map(
    [...legacy, ...indexed].map((card) => [card.id, indexCard(card.id) ?? card] as const),
  )
  return [...cards.values()]
    .map((card) => describeCard(card, collection, speciesId))
    .sort(compareCandidates)
}

const dateValue = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0)

/** Rang de la classe dans `RARITY_CLASSES` (la préférée d'abord) ; sans classe, en dernier. */
const rarityRank = (card: PokemonCard) => {
  const rarityClass = findRarityClass(card.rarity)
  return rarityClass ? RARITY_CLASSES.indexOf(rarityClass) : RARITY_CLASSES.length
}

/** Avec image d'abord, puis la classe la plus haute, puis l'extension la plus récente, puis l'id. */
function compareCandidates(a: CardView, b: CardView): number {
  return (
    Number(!!b.card.image) - Number(!!a.card.image) ||
    rarityRank(a.card) - rarityRank(b.card) ||
    dateValue(b.card.set?.releaseDate) - dateValue(a.card.set?.releaseDate) ||
    (a.card.id < b.card.id ? -1 : 1)
  )
}

/**
 * La carte qui représente un Pokémon : l'illustration choisie, sinon la dernière carte obtenue,
 * sinon la meilleure candidate ; `null` sans candidate (« illustration à rechercher »).
 */
export function pickRepresentative(candidates: readonly CardView[]): CardView | null {
  const favorite = candidates.find((candidate) => candidate.isFavorite)
  const lastAcquired = candidates
    .filter((candidate) => candidate.status === 'owned')
    .sort((a, b) => dateValue(b.acquiredAt) - dateValue(a.acquiredAt))[0]
  return favorite ?? lastAcquired ?? candidates[0] ?? null
}
