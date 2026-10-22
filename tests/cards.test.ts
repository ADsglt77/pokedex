/**
 * Retirer la carte d'un Pokémon : une carte TAG TEAM, achetée une fois, reste aux autres. Et les
 * règles de la collection et des commandes ne modifient jamais ce qu'elles reçoivent : « Annuler »
 * remet l'état d'avant, qu'une règle qui le modifierait aurait déjà changé. Enfin, la langue d'une
 * carte (absente : japonaise), qui la suit quand on la détache d'un Pokémon.
 */

import { describe, expect, test } from 'bun:test'
import { cardLanguage, removeCard, saveCard, setCardStatus, setPaidPrice } from '@/lib/collection'
import { applyOrder, isInAnOrder } from '@/lib/orders'
import type { CollectionData } from '@/types'
import { card, collectionWith, line, NOW, order, ownership } from './fixtures'

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

describe('la langue d’une carte', () => {
  test('absente : japonaise ; « fr » : française, y compris détachée d’un de ses Pokémon', () => {
    expect(cardLanguage(card('a', [25]))).toBe('ja')
    const french = card('a', [25, 644], { language: 'fr' })
    expect(cardLanguage(french)).toBe('fr')
    const data = { ...collectionWith(), customCards: { a: french } }
    expect(cardLanguage(removeCard(data, 'a', 25, NOW).customCards.a!)).toBe('fr')
  })
})

describe('les règles ne modifient pas ce qu’elles reçoivent (« Annuler »)', () => {
  test('statut, prix payé, carte enregistrée, retirée, commande reportée', () => {
    const data = withCard([25, 644])
    const before = structuredClone(data)
    setCardStatus(data, data.customCards.a!, null, NOW)
    setPaidPrice(data, data.customCards.a!, 10, NOW)
    saveCard(data, card('b', [1]), NOW)
    removeCard(data, 'a', 25, NOW)
    const placed = order({ lines: [line('a', 12)] })
    const placedBefore = structuredClone(placed)
    applyOrder(data, null, placed, [], NOW)
    expect(data).toEqual(before)
    expect(placed).toEqual(placedBefore)
  })

  test('une carte d’une commande (en cours, reçue ou annulée) : retenue', () => {
    const orders = [order({ lines: [line('a', 12)], state: 'cancelled' })]
    expect(isInAnOrder(orders, 'a')).toBe(true)
    expect(isInAnOrder(orders, 'b')).toBe(false)
  })
})
