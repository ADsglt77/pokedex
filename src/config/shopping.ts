/** Les achats : budget par défaut, priorités, fournisseurs et états d'une commande. */

import type { BudgetSettings, OrderState, Priority, Supplier } from '@/types'

/** 100 € par mois d'habitude, 150 € au plus. */
export const DEFAULT_BUDGET: BudgetSettings = { monthly: 100, ceiling: 150, shippingReserve: 5 }

/** Dans l'ordre d'affichage, la plus haute d'abord. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Haute',
  normal: 'Normale',
  low: 'Basse',
}

/** 0 pour la plus haute : l'ordre de `PRIORITY_LABELS`. */
export const PRIORITY_RANK = Object.fromEntries(
  Object.keys(PRIORITY_LABELS).map((priority, rank) => [priority, rank]),
) as Record<Priority, number>

export const SUPPLIER_LABELS: Record<Supplier, string> = {
  cardmarket: 'Cardmarket',
  myutsu: 'Myutsu',
  hikaru: 'Hikaru',
  other: 'Autre',
}

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  pending: 'En cours',
  received: 'Reçue',
  cancelled: 'Annulée',
}
