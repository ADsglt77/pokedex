/** Le budget : chaque commande compte une fois, au mois de son achat. */

import { describe, expect, test } from 'bun:test'
import { costPerSpecies, spendingByMonth, spentIn } from '@/lib/budget'
import { line, order } from './fixtures'

const orders = [
  order({ date: '2026-10-02', lines: [line('a', 40)], shipping: 5 }),
  order({ date: '2026-10-20', lines: [line('b', 30)], shipping: 4, refunded: 30 }),
  order({ date: '2026-10-21', lines: [line('c', 90)], shipping: 6, state: 'cancelled' }),
  order({ date: '2026-09-30', lines: [line('d', 25)], shipping: 3, state: 'received' }),
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
})
