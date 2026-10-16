/** La prochaine commande : budget, une carte par Pokémon, la moins chère d'abord, ajouts et retraits. */

import { describe, expect, test } from 'bun:test'
import { planPurchase, type PlanOptions } from '@/lib/purchase-planner'
import { wish } from './fixtures'

const options = (extra: Partial<PlanOptions> = {}): PlanOptions => ({
  budget: 100,
  shippingReserve: 5,
  forced: new Set(),
  skipped: new Set(),
  ...extra,
})

const ids = (rows: { card: { id: string } }[]) => rows.map((row) => row.card.id)

describe('prochaine commande', () => {
  test('ne dépasse jamais le budget, port réservé', () => {
    const plan = planPurchase(
      [wish('a', [1], 40), wish('b', [2], 40), wish('c', [3], 30)],
      new Set(),
      options(),
    )
    expect(ids(plan.picked)).toEqual(['c', 'a'])
    expect(plan.total).toBe(75)
    expect(ids(plan.left)).toEqual(['b'])
    expect(plan.overBudget).toBe(false)
  })

  test('une carte qui tient tout juste dans le budget est prise (au centime près)', () => {
    const plan = planPurchase(
      [wish('a', [1], 0.12), wish('b', [2], 19.87)],
      new Set(),
      options({ budget: 20, shippingReserve: 0.01 }),
    )
    expect(ids(plan.picked)).toEqual(['a', 'b'])
  })

  test('une seule carte par Pokémon, la moins chère d’abord (cartes d’une ancienne version)', () => {
    const plan = planPurchase(
      [wish('other', [25], 30), wish('cheap', [25], 10)],
      new Set(),
      options(),
    )
    expect(ids(plan.picked)).toEqual(['cheap'])
    // L'autre reste visible, avec les cartes mises de côté.
    expect(ids(plan.covered)).toEqual(['other'])
  })

  test('une carte TAG TEAM, achetée une fois, prévoit tous ses Pokémon', () => {
    const plan = planPurchase(
      [wish('tag', [25, 644], 15), wish('pikachu', [25], 40), wish('zekrom', [644], 20)],
      new Set(),
      options(),
    )
    expect(ids(plan.picked)).toEqual(['tag'])
    expect(plan.total).toBe(20)
    expect(ids(plan.covered)).toEqual(['zekrom', 'pikachu'])
  })

  test('jamais une carte possédée ou commandée, ni un Pokémon déjà obtenu', () => {
    const plan = planPurchase(
      [
        wish('owned', [1], 5, 'owned'),
        wish('ordered', [2], 5, 'ordered'),
        wish('taken', [3], 5),
        wish('new', [4], 5),
      ],
      new Set([3]),
      options(),
    )
    expect(ids(plan.picked)).toEqual(['new'])
  })

  test('sans prix : à part, jamais chiffrée', () => {
    const plan = planPurchase(
      [wish('unpriced', [1], null), wish('a', [2], 30)],
      new Set(),
      options(),
    )
    expect(ids(plan.picked)).toEqual(['a'])
    expect(ids(plan.unpriced)).toEqual(['unpriced'])
    expect(plan.total).toBe(35)
  })

  test('ajout et retrait à la main', () => {
    const cards = [wish('a', [1], 90), wish('b', [2], 20)]
    const plan = planPurchase(cards, new Set(), options({ forced: new Set(['a']) }))
    expect(ids(plan.picked)).toEqual(['a'])
    expect(ids(plan.left)).toEqual(['b'])
    const both = planPurchase(cards, new Set(), options({ forced: new Set(['a', 'b']) }))
    expect(both.total).toBe(115)
    expect(both.overBudget).toBe(true)
    const skipped = planPurchase(cards, new Set(), options({ skipped: new Set(['b']) }))
    expect(ids(skipped.skipped)).toEqual(['b'])
  })
})
