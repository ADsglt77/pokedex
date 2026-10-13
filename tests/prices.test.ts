/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : jamais celui d'une autre carte, ni
 * celui de TCGplayer pour une carte reliée à Cardmarket.
 */

import { describe, expect, test } from 'bun:test'
import { priceOf } from '@/lib/prices'
import type { Prices } from '@/types'

const prices: Prices = {
  cardmarket: { date: '2026-10-12', cards: { '719445': [6.87, 5, 7.2] } },
  tcgplayer: {
    date: '2026-10-12',
    usdPerEur: 1.1188,
    cards: { 'E1 65': [25.17, 26.81], 'SV2A 3': [99, null] },
  },
}

describe('priceOf', () => {
  test('une carte reliée à Cardmarket : son prix Cardmarket', () => {
    expect(priceOf(prices, { cardmarket: 719445, reference: 'Florizarre ex (SV2a 003)' })).toEqual({
      price: 6.87,
      low: 5,
      avg30: 7.2,
      source: 'cardmarket',
    })
  })

  test('reliée à Cardmarket mais sans prix ce jour : pas de prix TCGplayer à la place', () => {
    expect(priceOf(prices, { cardmarket: 1, reference: 'Florizarre ex (SV2a 003)' })).toBeNull()
  })

  test('sans id Cardmarket : le prix TCGplayer du code de sa référence, écrit comme on veut', () => {
    for (const reference of ['Florizarre (E1 065)', 'Florizarre (e1 65)', 'Florizarre E1 065']) {
      expect(priceOf(prices, { reference })).toEqual({
        price: 25.17,
        low: 26.81,
        avg30: null,
        source: 'tcgplayer',
      })
    }
  })

  test('sans id ni code connu : pas de prix', () => {
    expect(priceOf(prices, { reference: 'Florizarre (E1 097)' })).toBeNull()
    expect(priceOf(prices, { reference: 'Florizarre' })).toBeNull()
    expect(priceOf(null, { reference: 'Florizarre (E1 065)' })).toBeNull()
  })
})
