/**
 * Le Pokédex tel que l'utilisateur le voit : pour chaque espèce, ses cartes (plusieurs au besoin),
 * sa favorite, qu'il montre, et où il en est ; la progression, en tout et par génération.
 */

import { GENERATIONS, type Generation } from '@/config/pokedex'
import { findCard } from '@/lib/collection'
import { localDayOf } from '@/lib/format'
import type { PricePoint } from '@/lib/chart'
import { SPECIES } from '@/lib/species'
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
  /** Sa favorite, la carte que montre le Pokédex ; `null` tant qu'il n'a pas de carte. */
  card: CardView | null
  /** Toutes ses cartes, dans l'ordre d'ajout, la favorite comprise. */
  cards: CardView[]
  /** Où il en est : `owned` si une de ses cartes est possédée, sinon `ordered` si une est commandée. */
  status: CardStatus | null
  /** Débloqué : une de ses cartes est possédée (`status === 'owned'`), quelle qu'elle soit. */
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

/**
 * La part débloquée, en pour cent au dixième : jamais 0 % dès un Pokémon, ni 100 % avant le dernier
 * (le Pokédex public la montre aussi, `server/vitrine.ts`).
 */
export function progressPercent(unlocked: number, total: number) {
  const tenths = Math.round((unlocked * 1000) / total)
  const shown = unlocked === 0 || unlocked === total ? tenths : Math.min(Math.max(tenths, 1), 999)
  return shown / 10
}

function progressOf(entries: readonly PokedexEntry[]): Progress {
  const total = entries.length
  const unlocked = entries.filter((entry) => entry.unlocked).length
  return { total, unlocked, missing: total - unlocked, percent: progressPercent(unlocked, total) }
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

/** La même carte, au même statut (une carte relue du serveur est un autre objet). */
const sameView = (a: CardView, b: CardView) =>
  a === b ||
  (a.status === b.status &&
    a.acquiredAt === b.acquiredAt &&
    a.paidPrice === b.paidPrice &&
    (a.card === b.card || JSON.stringify(a.card) === JSON.stringify(b.card)))

/** Les mêmes cartes, dans le même ordre, aux mêmes statuts. */
const sameViews = (a: readonly CardView[], b: readonly CardView[]) =>
  a.length === b.length && a.every((view, index) => sameView(view, b[index]!))

/**
 * Le Pokémon resterait débloqué sans cette carte (qui quitte « possédée », ou qu'on lui retire) :
 * une autre de ses cartes est possédée.
 */
export const unlockedWithout = (entry: PokedexEntry, cardId: string) =>
  entry.cards.some(({ card, status }) => card.id !== cardId && status === 'owned')

/** Où en est un Pokémon d'après ses cartes : possédée avant commandée, sinon rien. */
const statusOf = (views: readonly CardView[]) =>
  (['owned', 'ordered'] as const).find((status) => views.some((view) => view.status === status)) ??
  null

/**
 * Le Pokédex d'une collection. `previous` : celui d'avant ; une entrée inchangée (la même favorite,
 * les mêmes cartes aux mêmes statuts) en est reprise telle quelle, et les pochettes mémoïsées ne se
 * redessinent pas.
 */
export function buildPokedex(collection: CollectionData, previous?: Pokedex): Pokedex {
  // Les cartes de chaque Pokémon, dans l'ordre d'ajout ; une case d'extension pas encore obtenue
  // n'en est pas encore une.
  const cardsBySpecies = new Map<number, PokemonCard[]>()
  for (const card of Object.values(collection.customCards)) {
    if (card.seriesOnly) continue
    for (const id of card.dexIds) {
      const cards = cardsBySpecies.get(id)
      if (cards) cards.push(card)
      else cardsBySpecies.set(id, [card])
    }
  }
  const entries = SPECIES.map((species, index): PokedexEntry => {
    const cards = (cardsBySpecies.get(species.id) ?? []).map((card) =>
      describeCard(card, collection),
    )
    const favorite = cards.find(({ card }) => card.id === collection.favorites[species.id]) ?? null
    const before = previous?.entries[index]
    if (
      before?.species === species &&
      before.card?.card.id === favorite?.card.id &&
      sameViews(before.cards, cards)
    ) {
      return before
    }
    const status = statusOf(cards)
    return { species, card: favorite, cards, status, unlocked: status === 'owned' }
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
}

/** Ce que contient la collection. */
export function summarize(data: CollectionData): CollectionSummary {
  const summary = { cards: Object.keys(data.customCards).length, owned: 0, ordered: 0 }
  for (const { ownership } of cardsWithStatus(data)) summary[ownership.status]++
  return summary
}

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
 * Les Pokémon débloqués, un évènement chacun (à cumuler, `runningTotal`) : le jour local de sa
 * première carte obtenue. Une carte possédée sans date compte avant tout (jour « »), pour que la
 * courbe finisse sur la progression.
 */
export function unlockEvents(collection: CollectionData): PricePoint[] {
  const first = new Map<number, string>()
  // Des plus récentes aux plus anciennes (sans date en dernier) : le jour noté en dernier est le
  // premier.
  for (const { card, acquiredAt } of acquisitions(collection)) {
    for (const id of card.dexIds) first.set(id, acquiredAt ? localDayOf(acquiredAt) : '')
  }
  return [...first.values()].map((date) => ({ date, value: 1 }))
}
