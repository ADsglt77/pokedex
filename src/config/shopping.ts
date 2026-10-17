/**
 * Les achats : le statut d'une carte ajoutée (« Ajouter comme »), le budget par défaut et ses
 * niveaux, les fournisseurs et les états d'une commande.
 */

import type { AddAs, BudgetSettings, OrderState, Supplier } from '@/types'

/** Ajouter une carte « comme » (fenêtre d'ajout, page Catalogue) : un seul choix. */
export const ADD_AS_LABELS: Record<AddAs, string> = {
  none: 'À acheter',
  owned: 'Possédée',
}

/** La fin du message d'ajout : « Carte ajoutée à Pikachu, possédée. » */
export const ADDED_AS: Record<AddAs, string> = {
  none: '',
  owned: ', possédée',
}

/** 100 € par mois d'habitude, 150 € au plus. */
export const DEFAULT_BUDGET: BudgetSettings = { monthly: 100, ceiling: 150, shippingReserve: 5 }

/** Un mois au-delà de son budget ou de son plafond (`budgetLevel`) : sa couleur, son badge. */
export const BUDGET_LEVELS = {
  monthly: { tone: 'warn', label: 'Au-delà du budget' },
  ceiling: { tone: 'danger', label: 'Plafond dépassé' },
} as const

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
