/**
 * Préparer la prochaine commande : quelles cartes de la liste d'achats prendre avec un budget.
 * Un plan indicatif : les prix sont ceux du marché (Cardmarket), pas des offres de vendeurs.
 *
 * 1. Candidates : les cartes acceptées, ni possédées ni commandées, d'une priorité retenue, d'un
 *    Pokémon pas encore débloqué ni commandé.
 * 2. Mises à part : les cartes sans prix (aucun prix n'est inventé) et celles dont le prix
 *    dépasse le prix maximum fixé.
 * 3. Ordre : les cartes choisies à la main, puis la priorité, puis le prix le plus bas.
 * 4. Dans cet ordre, une carte est prise si aucun de ses Pokémon n'est déjà dans le plan et si
 *    elle tient dans le budget, port réservé. Une carte choisie à la main est prise même au-delà
 *    du budget ou de son prix maximum, ou si son Pokémon est déjà dans le plan ; mais seulement
 *    si elle est candidate (étape 1), a un prix, et n'a pas été retirée à la main.
 */

import { PRIORITY_RANK } from '@/config/shopping'
import { stillWanted } from '@/lib/collection'
import { cents } from '@/lib/orders'
import type { CardStatus, Priority } from '@/types'

/** Ce que le plan lit d'une carte de la liste d'achats (`WishRow` en a davantage). */
export interface PlannableCard {
  card: { id: string; dexIds: number[] }
  preference: { priority: Priority; maxPrice?: number }
  status: CardStatus | null
  price: number | null
}

/**
 * Le prix du marché face au prix maximum : dessous (ou égal), dessus, ou rien à comparer. Ici, dans
 * un module léger (les tests le chargent sans les données), pour le plan comme pour l'affichage.
 */
export const priceVerdict = (price: number | null, maxPrice: number | undefined) =>
  price === null || maxPrice === undefined ? null : price <= maxPrice ? 'under' : 'over'

export interface PlanOptions {
  /** Port compris. */
  budget: number
  shippingReserve: number
  priorities: readonly Priority[]
  /** Ajoutées à la main : prises en premier, même au-delà du budget. */
  forced: ReadonlySet<string>
  /** Retirées à la main. */
  skipped: ReadonlySet<string>
}

interface Plan<T> {
  picked: T[]
  /** Candidates qui ne tiennent pas dans le budget. */
  left: T[]
  /** Candidates d'un Pokémon que le plan prend déjà, avec une autre carte. */
  covered: T[]
  unpriced: T[]
  aboveMax: T[]
  skipped: T[]
  /** Prix des cartes prises. */
  cardsTotal: number
  /** Cartes et port réservé (s'il y a au moins une carte). */
  total: number
  overBudget: boolean
}

export function planPurchase<T extends PlannableCard>(
  cards: readonly T[],
  /** Pokémon déjà débloqués ou commandés. */
  taken: ReadonlySet<number>,
  options: PlanOptions,
): Plan<T> {
  const plan: Plan<T> = {
    picked: [],
    left: [],
    covered: [],
    unpriced: [],
    aboveMax: [],
    skipped: [],
    cardsTotal: 0,
    total: 0,
    overBudget: false,
  }

  const candidates = cards.filter(
    (row) => stillWanted(row, taken) && options.priorities.includes(row.preference.priority),
  )

  const priced: (T & { price: number })[] = []
  for (const row of candidates) {
    const verdict = priceVerdict(row.price, row.preference.maxPrice)
    if (options.skipped.has(row.card.id)) plan.skipped.push(row)
    else if (row.price === null) plan.unpriced.push(row)
    else if (verdict === 'over' && !options.forced.has(row.card.id)) plan.aboveMax.push(row)
    else priced.push(row as T & { price: number })
  }

  priced.sort(
    (a, b) =>
      Number(options.forced.has(b.card.id)) - Number(options.forced.has(a.card.id)) ||
      PRIORITY_RANK[a.preference.priority] - PRIORITY_RANK[b.preference.priority] ||
      a.price - b.price ||
      (a.card.id < b.card.id ? -1 : 1),
  )

  const covered = new Set<number>()
  const isCovered = (row: T) => row.card.dexIds.some((id) => covered.has(id))
  for (const row of priced) {
    const forced = options.forced.has(row.card.id)
    if (!forced && isCovered(row)) {
      plan.covered.push(row)
      continue
    }
    if (!forced && cents(plan.cardsTotal + row.price + options.shippingReserve) > options.budget) {
      plan.left.push(row)
      continue
    }
    plan.picked.push(row)
    plan.cardsTotal = cents(plan.cardsTotal + row.price)
    for (const id of row.card.dexIds) covered.add(id)
  }

  plan.total = plan.picked.length ? cents(plan.cardsTotal + options.shippingReserve) : 0
  plan.overBudget = plan.total > options.budget
  // Une carte hors budget dont le Pokémon est finalement dans le plan n'est plus hors budget.
  plan.covered.push(...plan.left.filter(isCovered))
  plan.left = plan.left.filter((row) => !isCovered(row))
  return plan
}
