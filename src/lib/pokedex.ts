/**
 * Le Pokédex tel que l'utilisateur le voit : pour chaque espèce, ses candidates, la carte qui la
 * représente et ce qu'il en possède ; la progression, en tout et par génération.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { buildCandidates, pickRepresentative, type CardView } from '@/lib/candidates'
import { findCard, SPECIES } from '@/lib/catalog'
import type { CardStatus, CollectionData, PokemonCard, PokemonSpecies } from '@/types'

export interface PokedexEntry {
  species: PokemonSpecies
  candidates: CardView[]
  /** `null` sans candidate : « illustration à rechercher ». */
  representative: CardView | null
  /** Débloqué : au moins une candidate possédée. Souhaitée ou commandée ne suffit pas. */
  unlocked: boolean
  /** Combien de candidates ont chaque statut. */
  statusCounts: Record<CardStatus, number>
}

export interface Progress {
  total: number
  unlocked: number
  missing: number
  /** Une décimale : 0 % et 100 % seulement quand c'est vrai. */
  percent: number
}

export interface GenerationProgress extends Progress {
  generation: Generation
}

export interface Pokedex {
  entries: PokedexEntry[]
  entryById: Map<number, PokedexEntry>
  progress: Progress
  generations: GenerationProgress[]
}

function progressOf(entries: readonly PokedexEntry[]): Progress {
  const total = entries.length
  const unlocked = entries.filter((entry) => entry.unlocked).length
  const tenths = Math.round((unlocked * 1000) / total)
  const shown = unlocked === 0 || unlocked === total ? tenths : Math.min(Math.max(tenths, 1), 999)
  return { total, unlocked, missing: total - unlocked, percent: shown / 10 }
}

function buildEntry(
  species: PokemonSpecies,
  collection: CollectionData,
  enabledCodes: readonly string[],
): PokedexEntry {
  const candidates = buildCandidates(species.id, collection, enabledCodes)
  const statusCounts = { owned: 0, ordered: 0, wanted: 0 }
  for (const { status } of candidates) if (status) statusCounts[status]++
  return {
    species,
    candidates,
    representative: pickRepresentative(candidates),
    unlocked: statusCounts.owned > 0,
    statusCounts,
  }
}

/** Un Pokémon obtenu ou en route : une de ses candidates est possédée ou commandée. */
export const isTaken = (entry: PokedexEntry) => entry.unlocked || entry.statusCounts.ordered > 0

/** Le statut affiché pour une espèce : possédée, sinon commandée, sinon souhaitée. */
export function speciesStatus({ statusCounts }: PokedexEntry): CardStatus | null {
  if (statusCounts.owned) return 'owned'
  if (statusCounts.ordered) return 'ordered'
  if (statusCounts.wanted) return 'wanted'
  return null
}

export function buildPokedex(collection: CollectionData, enabledCodes: readonly string[]): Pokedex {
  const entries = SPECIES.map((species) => buildEntry(species, collection, enabledCodes))
  return {
    entries,
    entryById: new Map(entries.map((entry) => [entry.species.id, entry])),
    progress: progressOf(entries),
    generations: GENERATIONS.map((generation) => ({
      generation,
      ...progressOf(entries.filter((entry) => entry.species.generation === generation.id)),
    })),
  }
}

export interface CollectionSummary {
  owned: number
  ordered: number
  wanted: number
  favorites: number
}

/**
 * Ce que contient la collection. Une carte sortie de l'index n'y compte plus, comme partout
 * ailleurs dans l'app : ce que l'utilisateur en avait noté reste enregistré, sans s'afficher.
 */
export function summarize(data: CollectionData): CollectionSummary {
  const known = (cardId: string | null) => cardId !== null && findCard(cardId, data) !== null
  const summary = {
    owned: 0,
    ordered: 0,
    wanted: 0,
    favorites: Object.values(data.entries).filter((entry) => known(entry.favoriteCardId)).length,
  }
  for (const [cardId, ownership] of Object.entries(data.cards)) {
    if (known(cardId)) summary[ownership.status]++
  }
  return summary
}

export const isEmptySummary = (summary: CollectionSummary) =>
  Object.values(summary).every((count) => count === 0)

export interface RecentCard {
  card: PokemonCard
  acquiredAt: string | null
}

/** Les dernières cartes obtenues, la plus récente d'abord. */
export function recentAcquisitions(collection: CollectionData, limit: number): RecentCard[] {
  return Object.entries(collection.cards)
    .flatMap(([cardId, { status, acquiredAt }]) => {
      const card = status === 'owned' && findCard(cardId, collection)
      return card ? [{ card, acquiredAt }] : []
    })
    .sort((a, b) => (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? ''))
    .slice(0, limit)
}
