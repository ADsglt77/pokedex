/**
 * Le Pokédex tel que l'utilisateur le voit : pour chaque espèce, la carte qu'il y a ajoutée et ce
 * qu'il en a fait ; la progression, en tout et par génération.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { isToBuy } from '@/lib/collection'
import { monthRange } from '@/lib/format'
import { findCard, SPECIES } from '@/lib/species'
import type { CardStatus, CollectionData, PokemonCard, PokemonSpecies } from '@/types'

/** Une carte et ce que l'utilisateur en a fait : prête à afficher. */
export interface CardView {
  card: PokemonCard
  status: CardStatus | null
  /** Date d'obtention, pour une carte possédée. */
  acquiredAt: string | null
  /** Prix payé, s'il est noté. */
  paidPrice: number | null
}

export interface PokedexEntry {
  species: PokemonSpecies
  /** La carte du Pokémon ; `null` tant que l'utilisateur n'en a pas ajouté. */
  card: CardView | null
  /** Débloqué : sa carte est possédée. Souhaitée ou commandée ne suffit pas. */
  unlocked: boolean
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

function describeCard(card: PokemonCard, collection: CollectionData): CardView {
  const ownership = collection.cards[card.id]
  return {
    card,
    status: ownership?.status ?? null,
    acquiredAt: ownership?.status === 'owned' ? ownership.acquiredAt : null,
    paidPrice: ownership?.paidPrice ?? null,
  }
}

/** Un Pokémon obtenu ou en route : sa carte est possédée ou commandée. */
export const isTaken = (entry: PokedexEntry) => entry.card !== null && !isToBuy(entry.card)

export function buildPokedex(collection: CollectionData): Pokedex {
  // Une carte par Pokémon : la première ajoutée, si une ancienne version en a gardé plusieurs.
  const cardBySpecies = new Map<number, PokemonCard>()
  for (const card of Object.values(collection.customCards)) {
    for (const id of card.dexIds) if (!cardBySpecies.has(id)) cardBySpecies.set(id, card)
  }
  const entries = SPECIES.map((species): PokedexEntry => {
    const card = cardBySpecies.get(species.id)
    const view = card ? describeCard(card, collection) : null
    return { species, card: view, unlocked: view?.status === 'owned' }
  })
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

/**
 * Les cartes qui ont un statut. Un statut dont la carte n'existe plus (retirée, ancien index)
 * reste enregistré, mais ne compte nulle part : toute l'app passe par ici.
 */
export const cardsWithStatus = (collection: CollectionData) =>
  Object.entries(collection.cards).flatMap(([cardId, ownership]) => {
    const card = findCard(cardId, collection)
    return card ? [{ card, ownership }] : []
  })

export interface CollectionSummary {
  /** Les cartes ajoutées au Pokédex. */
  cards: number
  owned: number
  ordered: number
  wanted: number
}

/** Ce que contient la collection. */
export function summarize(data: CollectionData): CollectionSummary {
  const summary = { cards: Object.keys(data.customCards).length, owned: 0, ordered: 0, wanted: 0 }
  for (const { ownership } of cardsWithStatus(data)) summary[ownership.status]++
  return summary
}

export const isEmptySummary = (summary: CollectionSummary) =>
  Object.values(summary).every((count) => count === 0)

export interface RecentCard {
  card: PokemonCard
  acquiredAt: string | null
}

/** Les cartes obtenues, la plus récente d'abord. */
export const acquisitions = (collection: CollectionData): RecentCard[] =>
  cardsWithStatus(collection)
    .filter(({ ownership }) => ownership.status === 'owned')
    .map(({ card, ownership }) => ({ card, acquiredAt: ownership.acquiredAt }))
    .sort((a, b) => (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? ''))

/**
 * Les Pokémon débloqués au fil des mois : à chaque mois (`YYYY-MM-01`), le total débloqué à sa
 * fin, du mois de la première carte obtenue à `month` (`YYYY-MM`, le mois en cours).
 */
export function unlockedByMonth(collection: CollectionData, month: string) {
  const firstMonth = new Map<number, string>()
  // Des plus récentes aux plus anciennes : le mois noté en dernier est le premier.
  for (const { card, acquiredAt } of acquisitions(collection)) {
    if (!acquiredAt) continue
    for (const id of card.dexIds) firstMonth.set(id, acquiredAt.slice(0, 7))
  }
  const months = [...firstMonth.values()].sort()
  if (months.length === 0) return []
  return monthRange(months[0]!, month).map((current) => ({
    date: `${current}-01`,
    value: months.filter((first) => first <= current).length,
  }))
}
