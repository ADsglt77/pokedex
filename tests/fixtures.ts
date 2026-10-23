/**
 * Des données d'essai : une carte, une collection, des commandes, des cartes de liste d'achats, et
 * les espèces d'un Pokédex.
 */

import { spyOn } from 'bun:test'
import { completeFavorites, emptyCollection } from '@/lib/collection'
import { newOrder } from '@/lib/orders'
import type { PlannableCard } from '@/lib/purchase-planner'
import { loadSpecies } from '@/lib/species'
import type {
  CardOwnership,
  CollectionData,
  Order,
  OrderLine,
  PokemonCard,
  PokemonSpecies,
} from '@/types'

export const NOW = '2026-10-11T10:00:00.000Z'

/** Quatre espèces, comme les donne `/api/species` : de quoi bâtir un Pokédex (`buildPokedex`). */
const TEST_SPECIES: PokemonSpecies[] = [
  {
    id: 1,
    names: { fr: 'Bulbizarre', en: 'Bulbasaur', ja: null },
    types: ['grass'],
    generation: 1,
  },
  { id: 4, names: { fr: 'Salamèche', en: 'Charmander', ja: null }, types: ['fire'], generation: 1 },
  { id: 25, names: { fr: 'Pikachu', en: 'Pikachu', ja: null }, types: ['electric'], generation: 1 },
  { id: 644, names: { fr: 'Zekrom', en: 'Zekrom', ja: null }, types: ['dragon'], generation: 5 },
]

/**
 * Donne ces espèces à l'app (`SPECIES`) sans serveur : le navigateur les demande à `/api/species`.
 * `bun test` charge un module une fois pour tous les fichiers : chaque fichier qui bâtit un Pokédex
 * les donne lui-même (`beforeAll`), sans compter sur un autre.
 */
export async function loadTestSpecies() {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ species: TEST_SPECIES }),
  )
  await loadSpecies()
  fetch.mockRestore()
}

/** Une carte choisie : sa référence, sans image ; `extra` pour le reste (id Cardmarket…). */
export const card = (
  id: string,
  dexIds: number[],
  extra: Partial<PokemonCard> = {},
): PokemonCard => ({
  id,
  dexIds,
  reference: `Carte ${id}`,
  image: null,
  ...extra,
})

export const ownership = (
  status: CardOwnership['status'],
  extra: Partial<CardOwnership> = {},
): CardOwnership => ({ status, updatedAt: '2026-01-01T00:00:00.000Z', acquiredAt: null, ...extra })

export const collectionWith = (cards: CollectionData['cards'] = {}): CollectionData => ({
  ...emptyCollection(),
  cards,
})

/** Ces cartes, dans l'ordre : la première de chaque Pokémon en est la favorite (d'office). */
export const withCards = (data: CollectionData, ...cards: PokemonCard[]): CollectionData => ({
  ...data,
  customCards: Object.fromEntries(cards.map((c) => [c.id, c])),
  favorites: completeFavorites({}, cards),
})

export const line = (cardId: string, unitPrice: number, extra: Partial<OrderLine> = {}) => ({
  cardId,
  quantity: 1,
  unitPrice,
  previous: null,
  ...extra,
})

export const order = (extra: Partial<Order> = {}): Order => ({
  ...newOrder('2026-10-05'),
  updatedAt: NOW,
  ...extra,
})

export const wish = (id: string, dexIds: number[], price: number | null): PlannableCard => ({
  card: { id, dexIds },
  price,
})
