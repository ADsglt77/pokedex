/** Des données d'essai : une collection, des commandes, des cartes de liste d'achats. */

import { newOrder } from '@/lib/orders'
import type { PlannableCard } from '@/lib/purchase-planner'
import type { CardOwnership, CollectionData, Order, OrderLine, Priority } from '@/types'

export const NOW = '2026-10-11T10:00:00.000Z'

export const ownership = (
  status: CardOwnership['status'],
  extra: Partial<CardOwnership> = {},
): CardOwnership => ({ status, updatedAt: '2026-01-01T00:00:00.000Z', acquiredAt: null, ...extra })

export const collectionWith = (cards: CollectionData['cards'] = {}): CollectionData => ({
  schemaVersion: 1,
  updatedAt: null,
  entries: {},
  cards,
  customCards: {},
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

export const wish = (
  id: string,
  dexIds: number[],
  price: number | null,
  extra: { priority?: Priority; maxPrice?: number; isFavorite?: boolean } & Partial<
    Pick<PlannableCard, 'status'>
  > = {},
): PlannableCard => ({
  card: { id, dexIds },
  preference: { priority: extra.priority ?? 'normal', maxPrice: extra.maxPrice },
  status: extra.status ?? null,
  isFavorite: extra.isFavorite ?? false,
  price,
})
