/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : celui de son id Cardmarket, jamais
 * celui d'une autre carte, et aucun s'il n'y en a pas (aucun prix n'est inventé). Et les
 * historiques de la collection, lus en une demande, que la courbe de sa valeur additionne. Les prix
 * et leur historique eux-mêmes : l'API des données (ses propres tests).
 */

import { describe, expect, test } from 'bun:test'
import { collectionHistory, historiesOf, priceOf } from '@/lib/prices'
import type { CardPriceHistory, PriceFile, PriceHistories } from '@/types'

const prices: PriceFile = {
  date: '2026-10-12',
  cards: { '719445': [6.87, 5, 7.2], '719446': [99, null, null] },
}

describe('priceOf', () => {
  test('une carte reliée à Cardmarket : le prix de son id', () => {
    expect(priceOf(prices, { cardmarket: 719445 })).toEqual({
      price: 6.87,
      low: 5,
      monthAgo: 7.2,
    })
  })

  test('un id sans prix ce jour : pas de prix, jamais celui d’une autre carte', () => {
    expect(priceOf(prices, { cardmarket: 1 })).toBeNull()
  })

  test('sans id Cardmarket : pas de prix', () => {
    expect(priceOf(prices, {})).toBeNull()
  })

  test('sans fichier de prix : pas de prix', () => {
    expect(priceOf(null, { cardmarket: 719445 })).toBeNull()
  })
})

describe('historiesOf', () => {
  const history = (from: string, prices: (number | null)[]): CardPriceHistory => ({
    name: null,
    from,
    prices,
  })
  const a = history('2026-10-14', [10, 11])
  const b = history('2026-10-15', [5])
  const response: PriceHistories = { '719621': a, '719446': b, '719445': null }

  test('dans l’ordre des cartes, chaque id avec son historique', () => {
    expect(historiesOf(response, [719446, 719621])).toEqual([b, a])
  })

  test('la même carte possédée pour deux Pokémon compte deux fois, comme au prix du jour', () => {
    expect(historiesOf(response, [719446, 719446, 719621])).toEqual([b, b, a])
    expect(collectionHistory(historiesOf(response, [719446, 719446, 719621]))).toEqual([
      { date: '2026-10-14', value: 20 },
      { date: '2026-10-15', value: 21 },
    ])
  })

  test('sans historique, ou absente de la réponse : ne compte pas', () => {
    expect(historiesOf(response, [719445, 1, 719621])).toEqual([a])
    expect(historiesOf({}, [719621])).toEqual([])
  })
})
