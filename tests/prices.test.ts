/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : jamais celui d'une autre carte ;
 * celui de TCGplayer seulement quand Cardmarket n'en a pas ce jour.
 */

import { describe, expect, test } from 'bun:test'
import { priceOf } from '@/lib/prices'
import type { CardPrice, Prices } from '@/types'

const prices: Prices = {
  cardmarket: { date: '2026-10-12', cards: { '719445': [6.87, 5, 7.2] } },
  tcgplayer: {
    date: '2026-10-12',
    usdPerEur: 1.1188,
    cards: { 'E1 65': [25.17, 26.81], 'SV2A 3': [99, null] },
  },
}

const tcgplayer: CardPrice = { price: 99, low: null, avg30: null, source: 'tcgplayer' }

describe('priceOf', () => {
  test('une carte reliée à Cardmarket : son prix Cardmarket, jamais celui de TCGplayer', () => {
    expect(priceOf(prices, { cardmarket: 719445, reference: 'Florizarre ex (SV2a 003)' })).toEqual({
      price: 6.87,
      low: 5,
      avg30: 7.2,
      source: 'cardmarket',
    })
  })

  test('reliée à Cardmarket mais sans prix ce jour : le prix TCGplayer de sa référence', () => {
    expect(priceOf(prices, { cardmarket: 1, reference: 'Florizarre ex (SV2a 003)' })).toEqual(
      tcgplayer,
    )
  })

  test('sans fichier Cardmarket : le prix TCGplayer de sa référence', () => {
    const reference = 'Florizarre ex (SV2a 003)'
    expect(priceOf({ ...prices, cardmarket: null }, { cardmarket: 719445, reference })).toEqual(
      tcgplayer,
    )
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

  test('sans prix Cardmarket ni code connu : pas de prix', () => {
    expect(priceOf(prices, { reference: 'Florizarre (E1 097)' })).toBeNull()
    expect(priceOf(prices, { reference: 'Florizarre' })).toBeNull()
    expect(priceOf(prices, { cardmarket: 1, reference: 'Florizarre' })).toBeNull()
    expect(priceOf(null, { cardmarket: 719445, reference: 'Florizarre (E1 065)' })).toBeNull()
  })
})
