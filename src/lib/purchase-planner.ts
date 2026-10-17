/**
 * Préparer la prochaine commande : quelles cartes de la liste d'achats prendre avec un budget.
 * Un plan indicatif : les prix sont ceux du marché (Cardmarket), pas des offres de vendeurs.
 *
 * 1. Candidates : les cartes de la liste d'achats, ni possédées ni commandées (`wishlistRows`).
 * 2. Mises à part : celles retirées à la main, et celles sans prix (aucun prix n'est inventé).
 * 3. Ordre : les cartes ajoutées à la main, puis le prix le plus bas.
 * 4. Dans cet ordre, une carte est prise si aucun de ses Pokémon n'est déjà dans le plan et si
 *    elle tient dans le budget, port réservé. Une carte ajoutée à la main est prise même au-delà
 *    du budget, ou si son Pokémon est déjà dans le plan.
 */

import { cents } from '@/lib/orders'

/** Ce que le plan lit d'une carte de la liste d'achats (`WishRow` en a davantage). */
export interface PlannableCard {
  card: { id: string; dexIds: number[] }
  price: number | null
}

export interface PlanOptions {
  /** Port compris. */
  budget: number
  shippingReserve: number
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
  skipped: T[]
  /** Prix des cartes prises. */
  cardsTotal: number
  /** Cartes et port réservé (s'il y a au moins une carte). */
  total: number
  overBudget: boolean
}

export function planPurchase<T extends PlannableCard>(
  cards: readonly T[],
  options: PlanOptions,
): Plan<T> {
  const plan: Plan<T> = {
    picked: [],
    left: [],
    covered: [],
    unpriced: [],
    skipped: [],
    cardsTotal: 0,
    total: 0,
    overBudget: false,
  }

  const priced: (T & { price: number })[] = []
  for (const row of cards) {
    if (options.skipped.has(row.card.id)) plan.skipped.push(row)
    else if (row.price === null) plan.unpriced.push(row)
    else priced.push(row as T & { price: number })
  }

  priced.sort(
    (a, b) =>
      Number(options.forced.has(b.card.id)) - Number(options.forced.has(a.card.id)) ||
      a.price - b.price ||
      (a.card.id < b.card.id ? -1 : 1),
  )

  // Les moins chères d'abord : une carte hors budget ne laisse passer aucune autre du même
  // Pokémon, qui coûterait autant ou plus.
  const covered = new Set<number>()
  for (const row of priced) {
    const forced = options.forced.has(row.card.id)
    if (!forced && row.card.dexIds.some((id) => covered.has(id))) {
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
  return plan
}
