import { RARITY_CLASSES, type RarityClass } from '@/config/rarities'
import { indexCard, indexCardsFor } from '@/lib/catalog'
import { classifyCard, isEligible } from '@/lib/rarity'
import type { CardStatus, CollectionData, PokemonCard } from '@/types'

/** Une carte jointe aux données de l'utilisateur (statut, favori), prête à afficher. */
export interface CardView {
  card: PokemonCard
  image: PokemonCard['image']
  rarityClass: RarityClass | null
  rarityDeduced: boolean
  status: CardStatus | null
  isFavorite: boolean
  acquiredAt: string | null
}

/** Joint n'importe quelle carte aux données de l'utilisateur. */
export function describeCard(
  card: PokemonCard,
  collection: CollectionData,
  speciesId: number,
): CardView {
  const ownership = collection.cards[card.id]
  const override = collection.imageOverrides[card.id]
  const { rarityClass, deduced } = classifyCard(card)
  return {
    card,
    image: override ? { small: override, large: override } : card.image,
    rarityClass,
    rarityDeduced: deduced,
    status: ownership?.status ?? null,
    isFavorite: collection.entries[speciesId]?.favoriteCardId === card.id,
    acquiredAt: ownership?.status === 'owned' ? ownership.acquiredAt : null,
  }
}

/**
 * Candidates d'une espèce, la meilleure d'abord : les cartes de l'index dont la classe est
 * suivie, et les cartes personnelles d'une collection ancienne (toujours candidates).
 */
export function buildCandidates(
  speciesId: number,
  collection: CollectionData,
  enabledCodes: readonly string[],
): CardView[] {
  const cards = new Map<string, PokemonCard>()
  for (const card of Object.values(collection.customCards)) {
    // La version de l'index est plus complète (classe déduite, image).
    if (card.dexIds.includes(speciesId)) cards.set(card.id, indexCard(card.id) ?? card)
  }
  for (const card of indexCardsFor(speciesId)) {
    if (isEligible(card, enabledCodes)) cards.set(card.id, card)
  }
  return [...cards.values()]
    .map((card) => describeCard(card, collection, speciesId))
    .sort(compareCandidates)
}

const dateValue = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0)

const rarityRank = (rarityClass: RarityClass | null) => {
  const rank = RARITY_CLASSES.findIndex((candidate) => candidate.code === rarityClass?.code)
  return rank === -1 ? RARITY_CLASSES.length : rank
}

/**
 * Avec image d'abord, puis classe la plus haute (non classée à la fin), puis extension la plus
 * récente, puis id (comparé par unité de code : l'ordre ne dépend pas du navigateur).
 */
function compareCandidates(a: CardView, b: CardView): number {
  return (
    Number(b.image !== null) - Number(a.image !== null) ||
    rarityRank(a.rarityClass) - rarityRank(b.rarityClass) ||
    dateValue(b.card.set?.releaseDate) - dateValue(a.card.set?.releaseDate) ||
    (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0)
  )
}

/**
 * La carte qui représente une espèce : le favori s'il est encore candidat, sinon la dernière
 * carte obtenue, sinon la mieux classée ; `null` sans candidate (« illustration à rechercher »).
 */
export function pickRepresentative(candidates: readonly CardView[]): CardView | null {
  const favorite = candidates.find((candidate) => candidate.isFavorite)
  if (favorite) return favorite

  const owned = candidates.filter((candidate) => candidate.status === 'owned')
  const lastAcquired = owned.sort(
    (a, b) => dateValue(b.acquiredAt) - dateValue(a.acquiredAt) || compareCandidates(a, b),
  )[0]
  // `candidates` est déjà trié : la première est la mieux classée.
  return lastAcquired ?? candidates[0] ?? null
}
