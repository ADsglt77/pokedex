/** Retirer la carte d'un Pokémon : une carte TAG TEAM, achetée une fois, reste aux autres. */

import { describe, expect, test } from 'bun:test'
import { removeCard } from '@/lib/collection'
import type { CollectionData } from '@/types'
import { card, collectionWith, NOW, ownership } from './fixtures'

const withCard = (dexIds: number[]): CollectionData => ({
  ...collectionWith({ a: ownership('owned', { paidPrice: 42.5 }) }),
  customCards: { a: card('a', dexIds) },
})

describe('retirer une carte', () => {
  test('partagée, elle reste aux autres Pokémon avec son statut et son prix payé', () => {
    const data = removeCard(withCard([25, 644]), 'a', 25, NOW)
    expect(data.customCards.a?.dexIds).toEqual([644])
    expect(data.cards.a).toEqual(ownership('owned', { paidPrice: 42.5 }))
    expect(data.updatedAt).toBe(NOW)
  })

  test('celle d’un seul Pokémon part avec son statut et son prix payé', () => {
    const data = removeCard(withCard([25]), 'a', 25, NOW)
    expect(data.customCards.a).toBeUndefined()
    expect(data.cards.a).toBeUndefined()
  })
})
