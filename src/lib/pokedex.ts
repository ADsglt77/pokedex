import { GENERATIONS, TOTAL_SPECIES, type Generation } from '@/config/pokedex'
import { buildCandidates, describeCard, pickRepresentative, type CardView } from '@/lib/candidates'
import { getSpecies, indexCard, SPECIES } from '@/lib/catalog'
import type { CardImage, CardStatus, CollectionData, PokemonSpecies } from '@/types'

type StatusCounts = Record<CardStatus, number>

export interface PokedexEntry {
  species: PokemonSpecies
  candidates: CardView[]
  /** `null` sans candidate : « illustration à rechercher ». */
  representative: CardView | null
  image: CardImage | null
  /** Débloqué : au moins une candidate possédée. Souhaitée, commandée ou favorite ne suffit pas. */
  unlocked: boolean
  statusCounts: StatusCounts
}

export interface Progress {
  total: number
  unlocked: number
  missing: number
  /** Une décimale, jamais 100 avant la fin ni 0 dès qu'un Pokémon est débloqué. */
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

function computeProgress(unlocked: number, total: number): Progress {
  let tenths = Math.round((unlocked * 1000) / total)
  if (unlocked < total) tenths = Math.min(tenths, 999)
  if (unlocked > 0) tenths = Math.max(tenths, 1)
  return { total, unlocked, missing: total - unlocked, percent: tenths / 10 }
}

/** L'entrée d'une espèce : ses candidates, sa représentante et ce que l'utilisateur en possède. */
function buildEntry(
  species: PokemonSpecies,
  collection: CollectionData,
  enabledCodes: readonly string[],
): PokedexEntry {
  const candidates = buildCandidates(species.id, collection, enabledCodes)
  const representative = pickRepresentative(candidates)
  const statusCounts: StatusCounts = { owned: 0, ordered: 0, wanted: 0 }
  for (const candidate of candidates) {
    if (candidate.status) statusCounts[candidate.status]++
  }
  return {
    species,
    candidates,
    representative,
    image: representative?.image ?? null,
    unlocked: statusCounts.owned > 0,
    statusCounts,
  }
}

/** Statut affiché pour une espèce : possédée, sinon la carte suivie la plus avancée. */
export function speciesStatus(entry: PokedexEntry): CardStatus | null {
  if (entry.unlocked) return 'owned'
  if (entry.statusCounts.ordered > 0) return 'ordered'
  if (entry.statusCounts.wanted > 0) return 'wanted'
  return null
}

/** Le Pokédex tel que l'utilisateur le voit, dérivé de l'index, de la collection et des réglages. */
export function buildPokedex(collection: CollectionData, enabledCodes: readonly string[]): Pokedex {
  const entries = SPECIES.map((species) => buildEntry(species, collection, enabledCodes))
  const entryById = new Map(entries.map((entry) => [entry.species.id, entry]))
  const isUnlocked = (id: number) => entryById.get(id)?.unlocked ?? false

  return {
    entries,
    entryById,
    progress: computeProgress(entries.filter((entry) => entry.unlocked).length, TOTAL_SPECIES),
    generations: GENERATIONS.map((generation) => {
      let unlocked = 0
      for (let id = generation.first; id <= generation.last; id++) if (isUnlocked(id)) unlocked++
      return { generation, ...computeProgress(unlocked, generation.last - generation.first + 1) }
    }),
  }
}

export interface RecentCard extends CardView {
  species: PokemonSpecies[]
  acquiredAt: string
}

/** Les dernières cartes obtenues, la plus récente d'abord. */
export function recentAcquisitions(collection: CollectionData, limit: number): RecentCard[] {
  return Object.entries(collection.cards)
    .filter(([, ownership]) => ownership.status === 'owned' && ownership.acquiredAt)
    .sort(
      ([idA, a], [idB, b]) =>
        Date.parse(b.acquiredAt ?? '') - Date.parse(a.acquiredAt ?? '') || (idA < idB ? -1 : 1),
    )
    .flatMap(([cardId, ownership]) => {
      // La version de l'index est plus complète que la copie d'une collection ancienne.
      const card = indexCard(cardId) ?? collection.customCards[cardId] ?? null
      if (card === null) return []
      const species = card.dexIds.flatMap((id) => getSpecies(id) ?? [])
      const firstSpecies = species[0]?.id ?? 0
      return [
        {
          ...describeCard(card, collection, firstSpecies),
          species,
          acquiredAt: ownership.acquiredAt ?? '',
        },
      ]
    })
    .slice(0, limit)
}
