/**
 * Préparer la prochaine commande : quelles cartes de la liste d'achats prendre avec un budget.
 * Un plan indicatif : les prix sont ceux du marché (Cardmarket), pas des offres de vendeurs.
 *
 * 1. Candidates : les cartes de la liste d'achats, ni possédées ni commandées (`wishlistRows`).
 * 2. Mises à part : celles retirées à la main, et celles sans prix (aucun prix n'est inventé).
 * 3. Ordre : les cartes ajoutées à la main, puis le prix le plus bas.
 * 4. Dans cet ordre, une carte est prise si elle tient dans le budget, port réservé, et, pour une
 *    carte du Pokédex, si aucun de ses Pokémon n'est déjà dans le plan : une case d'extension pas
 *    encore obtenue (`seriesOnly`) n'est pas encore une carte de ses Pokémon, elle est libre de
 *    cette règle (ni bloquée, ni bloquante). Une carte ajoutée à la main est prise même au-delà du
 *    budget, ou si son Pokémon est déjà dans le plan.
 */

import { cents } from '@/lib/orders'
import type { PokemonCard } from '@/types'

/** Ce que le plan lit d'une carte de la liste d'achats (`WishRow` en a davantage). */
export interface PlannableCard {
  card: Pick<PokemonCard, 'id' | 'dexIds' | 'seriesOnly'>
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

/** Une carte avec son prix : celles que le plan prend, laisse ou couvre en ont toutes un. */
type Priced<T> = T & { price: number }

interface Plan<T> {
  picked: Priced<T>[]
  /** Candidates qui ne tiennent pas dans le budget. */
  left: Priced<T>[]
  /** Candidates d'un Pokémon que le plan prend déjà, avec une autre carte. */
  covered: Priced<T>[]
  unpriced: T[]
  skipped: T[]
  /** Prix des cartes prises. */
  cardsTotal: number
  /** Cartes et port réservé (s'il y a au moins une carte). */
  total: number
  overBudget: boolean
}

const isPriced = <T extends PlannableCard>(row: T): row is Priced<T> => row.price !== null

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

  const priced: Priced<T>[] = []
  for (const row of cards) {
    if (options.skipped.has(row.card.id)) plan.skipped.push(row)
    else if (isPriced(row)) priced.push(row)
    else plan.unpriced.push(row)
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
    // Les Pokémon dont c'est une carte : aucun pour une case pas encore obtenue.
    const pokemon = row.card.seriesOnly ? [] : row.card.dexIds
    if (!forced && pokemon.some((id) => covered.has(id))) {
      plan.covered.push(row)
      continue
    }
    if (!forced && cents(plan.cardsTotal + row.price + options.shippingReserve) > options.budget) {
      plan.left.push(row)
      continue
    }
    plan.picked.push(row)
    plan.cardsTotal = cents(plan.cardsTotal + row.price)
    for (const id of pokemon) covered.add(id)
  }

  plan.total = plan.picked.length ? cents(plan.cardsTotal + options.shippingReserve) : 0
  plan.overBudget = plan.total > options.budget
  return plan
}
