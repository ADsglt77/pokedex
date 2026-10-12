/**
 * Le budget, calculé depuis le registre des commandes : chaque commande compte une fois, dans le
 * mois de sa date d'achat, pour ce qu'elle a coûté (port et frais compris, remboursé déduit ;
 * rien si elle est annulée).
 */

import { today } from '@/lib/format'
import { cardCount, cents, orderSpent, supplierLabel } from '@/lib/orders'
import type { BudgetSettings, Order, ShoppingData } from '@/types'

/** `2026-10` */
export const monthOf = (day: string) => day.slice(0, 7)

/** Ce qu'ont coûté des commandes : leur nombre (annulées exclues), leurs cartes, port et frais. */
export function spentOn(orders: readonly Order[]) {
  const spending = { orders: 0, cards: 0, shipping: 0, spent: 0 }
  for (const order of orders.filter((order) => order.state !== 'cancelled')) {
    spending.orders++
    spending.cards += cardCount(order.lines)
    spending.shipping = cents(spending.shipping + order.shipping + order.fees)
    spending.spent = cents(spending.spent + orderSpent(order))
  }
  return spending
}

/** Ce qui a été dépensé dans un mois (`2026-10`). */
export const spentIn = (orders: readonly Order[], month: string) =>
  spentOn(orders.filter((order) => monthOf(order.date) === month))

/** Ce qui a été dépensé ce mois-ci. */
export const spentThisMonth = (orders: readonly Order[]) => spentIn(orders, monthOf(today())).spent

/** Un mois au-delà de son plafond, au-delà du budget habituel, ou dans le budget (`null`). */
export const budgetLevel = (spent: number, budget: BudgetSettings) =>
  spent > budget.ceiling ? 'ceiling' : spent > budget.monthly ? 'monthly' : null

/** Un total par mois, ou par fournisseur… (`key`), sans les commandes annulées. */
function spendingBy(orders: readonly Order[], keyOf: (order: Order) => string) {
  const groups = new Map<string, Order[]>()
  for (const order of orders.filter((order) => order.state !== 'cancelled')) {
    groups.set(keyOf(order), [...(groups.get(keyOf(order)) ?? []), order])
  }
  return [...groups].map(([key, group]) => ({ key, ...spentOn(group) }))
}

/** Un total par mois (`key` : `2026-10`), le plus récent d'abord. */
export const spendingByMonth = (orders: readonly Order[]) =>
  spendingBy(orders, (order) => monthOf(order.date)).sort((a, b) => b.key.localeCompare(a.key))

/** Un total par fournisseur (`key` : son nom), le plus gros d'abord. */
export const spendingBySupplier = (orders: readonly Order[]) =>
  spendingBy(orders, supplierLabel).sort((a, b) => b.spent - a.spent)

/**
 * Le coût moyen d'un Pokémon : tout ce qui a été dépensé, divisé par le nombre de Pokémon
 * différents des cartes achetées (commandes non annulées) ; `null` sans achat.
 */
export function costPerSpecies(orders: readonly Order[], speciesOf: (cardId: string) => number[]) {
  const species = new Set(
    orders
      .filter((order) => order.state !== 'cancelled')
      .flatMap((order) => order.lines.flatMap((line) => speciesOf(line.cardId))),
  )
  const { spent } = spentOn(orders)
  return { species: species.size, average: species.size ? cents(spent / species.size) : null }
}

/** Change le budget du mois, le plafond ou la réserve de port. Inchangé : `data`. */
export function updateBudget(
  data: ShoppingData,
  change: Partial<BudgetSettings>,
  now: string,
): ShoppingData {
  const keys = Object.keys(change) as (keyof BudgetSettings)[]
  if (keys.every((key) => data.budget[key] === change[key])) return data
  return { ...data, budget: { ...data.budget, ...change }, updatedAt: now }
}
