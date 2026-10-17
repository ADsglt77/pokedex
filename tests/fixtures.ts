/** Des données d'essai : une carte, une collection, des commandes, des cartes de liste d'achats. */

import { emptyCollection } from '@/lib/collection'
import { newOrder } from '@/lib/orders'
import type { PlannableCard } from '@/lib/purchase-planner'
import type { CardOwnership, CollectionData, Order, OrderLine, PokemonCard } from '@/types'

export const NOW = '2026-10-11T10:00:00.000Z'

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
