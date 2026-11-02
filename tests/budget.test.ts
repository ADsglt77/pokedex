/**
 * Le budget : chaque commande compte une fois, au mois de son achat ; le coût moyen par Pokémon,
 * sans les commandes annulées (`costPerSpecies`) ; l'alerte au-delà du budget, puis du plafond
 * (`budgetLevel`) ; la question du plafond avant d'enregistrer une commande (`askBeforeSaving`) ;
 * le budget par défaut de la prochaine commande (`defaultPlanBudget`).
 */

import { describe, expect, test } from 'bun:test'
import {
  askBeforeSaving,
  budgetLevel,
  costPerSpecies,
  defaultPlanBudget,
  spendingByMonth,
  spentIn,
} from '@/lib/budget'
import { line, order } from './fixtures'

const orders = [
  order({ date: '2026-10-02', lines: [line('a', 40)], shipping: 5 }),
  order({ date: '2026-10-20', lines: [line('b', 30)], shipping: 4, refunded: 30 }),
  order({ date: '2026-10-21', lines: [line('c', 90)], shipping: 6, state: 'cancelled' }),
  // Achetée en septembre, reçue en octobre : elle compte en septembre.
  order({
    date: '2026-09-30',
    lines: [line('d', 25)],
    shipping: 3,
    state: 'received',
    receivedAt: '2026-10-02',
  }),
]

describe('budget du mois', () => {
  test('compte chaque commande une fois, au mois de son achat, port compris', () => {
    expect(spentIn(orders, '2026-10')).toEqual({ orders: 2, cards: 2, shipping: 9, spent: 49 })
    expect(spentIn(orders, '2026-09').spent).toBe(28)
    expect(spentIn(orders, '2026-08').spent).toBe(0)
  })

  test('un total par mois, le plus récent d’abord', () => {
    expect(spendingByMonth(orders).map(({ key, spent }) => [key, spent])).toEqual([
      ['2026-10', 49],
      ['2026-09', 28],
    ])
  })

  test('un mois sans autre commande qu’annulée n’a pas de ligne', () => {
    const cancelled = order({ date: '2026-08-02', lines: [line('e', 10)], state: 'cancelled' })
    expect(spendingByMonth([...orders, cancelled]).map(({ key }) => key)).toEqual([
      '2026-10',
      '2026-09',
    ])
  })

  test('coût moyen par Pokémon : les commandes annulées n’en ajoutent pas', () => {
    const speciesOf = (cardId: string) => ({ a: [1], b: [1], c: [3], d: [4] })[cardId] ?? []
    expect(costPerSpecies(orders, speciesOf)).toEqual({ species: 2, average: 38.5 })
  })

  test('au-delà du budget, puis du plafond ; le budget tout juste atteint n’alerte pas', () => {
    const budget = { monthly: 100, ceiling: 150, shippingReserve: 5 }
    expect(budgetLevel(100, budget)).toBeNull()
    expect(budgetLevel(100.01, budget)).toBe('monthly')
    expect(budgetLevel(150, budget)).toBe('monthly')
    expect(budgetLevel(150.01, budget)).toBe('ceiling')
  })
})

describe('question du plafond', () => {
  // Octobre est déjà au-delà : 49 € pour un plafond de 30 €.
  const budget = { monthly: 20, ceiling: 30, shippingReserve: 5 }

  test('une commande modifiée qui ne fait pas monter le mois ne pose pas de question', () => {
    const first = orders[0]!
    expect(askBeforeSaving(orders, first, budget)).toEqual({
      month: '2026-10',
      total: 49,
      ask: false,
    })
    const cheaper = { ...first, lines: [line('a', 30)] }
    expect(askBeforeSaving(orders, cheaper, budget)).toEqual({
      month: '2026-10',
      total: 39,
      ask: false,
    })
  })

  test('une commande déplacée vers un mois déjà dépassé en pose une', () => {
    const moved = { ...orders[3]!, date: '2026-10-25' }
    expect(askBeforeSaving(orders, moved, budget)).toEqual({
      month: '2026-10',
      total: 77,
      ask: true,
    })
  })

  test('une commande qui fait monter le mois jusqu’au plafond tout juste n’en pose pas', () => {
    // Septembre passe de 28 € à 30 € : le plafond tout juste atteint.
    const added = order({ date: '2026-09-10', lines: [line('e', 2)] })
    expect(askBeforeSaving(orders, added, budget)).toEqual({
      month: '2026-09',
      total: 30,
      ask: false,
    })
  })
})

describe('budget par défaut de la prochaine commande', () => {
  const budget = { monthly: 100, ceiling: 150, shippingReserve: 5 }

  test('vaut 0 quand le mois est dépassé', () => {
    expect(defaultPlanBudget(budget, 100, 5)).toBe(0)
    expect(defaultPlanBudget(budget, 120, 5)).toBe(0)
  })

  test('borné au plafond, arrondi vers le bas au pas du curseur', () => {
    expect(defaultPlanBudget({ ...budget, monthly: 200 }, 20, 5)).toBe(150)
    expect(defaultPlanBudget(budget, 32.5, 5)).toBe(65)
    expect(defaultPlanBudget(budget, 31, 5)).toBe(65)
  })
})
