/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : celui de son id Cardmarket, jamais
 * celui d'une autre carte, et aucun s'il n'y en a pas (aucun prix n'est inventé).
 */

import { describe, expect, test } from 'bun:test'
import { priceOf } from '@/lib/prices'
import type { PriceFile } from '@/types'

const prices: PriceFile = {
  date: '2026-10-12',
  cards: { '719445': [6.87, 5, 7.2], '719446': [99, null, null] },
}

describe('priceOf', () => {
  test('une carte reliée à Cardmarket : le prix de son id', () => {
    expect(priceOf(prices, { cardmarket: 719445 })).toEqual({ price: 6.87, low: 5, avg30: 7.2 })
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
