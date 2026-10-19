/**
 * Ce que l'utilisateur saisit et qui compte en argent : les montants (lignes de commande, port,
 * frais, remboursé, budget, prix payé) et l'id Cardmarket d'une carte (d'où son prix). Un montant
 * mal lu fausserait le budget sans rien dire. Et le lien vers Cardmarket : ses offres en japonais,
 * Near Mint au moins (une autre langue, ce serait une autre carte achetée).
 */

import { describe, expect, test } from 'bun:test'
import { cardmarketPage, readCardmarketId } from '@/lib/cardmarket'
import { parseEuros, parseQuantity } from '@/lib/format'

describe('parseEuros', () => {
  test('virgule ou point, symbole et espaces des milliers, insécables compris', () => {
    expect(parseEuros('12,50')).toBe(12.5)
    expect(parseEuros('12.5 €')).toBe(12.5)
    expect(parseEuros('0,5')).toBe(0.5)
    expect(parseEuros(' 7 ')).toBe(7)
    expect(parseEuros('1 234,50')).toBe(1234.5)
    expect(parseEuros('1 234,50')).toBe(1234.5)
    expect(parseEuros('1 234,50')).toBe(1234.5)
  })

  test('illisible : null, jamais un montant approché', () => {
    // Un séparateur des milliers en point se lirait 1,234 : refusé plutôt que deviné.
    expect(parseEuros('1.234,50')).toBeNull()
    expect(parseEuros('12,505')).toBeNull()
    expect(parseEuros('-5')).toBeNull()
    expect(parseEuros('5.')).toBeNull()
    expect(parseEuros('1e3')).toBeNull()
    expect(parseEuros('abc')).toBeNull()
    expect(parseEuros('')).toBeNull()
  })

  test('une espace ailleurs qu’entre les milliers : null (« 12 50 » ne vaut pas 1 250 €)', () => {
    expect(parseEuros('12 50')).toBeNull()
    expect(parseEuros('1 2 3')).toBeNull()
    expect(parseEuros('1 23,50')).toBeNull()
    expect(parseEuros('12 345 678')).toBe(12345678)
  })
})

describe('parseQuantity', () => {
  test('des chiffres seulement : « 1e1 » ne vaut pas 10', () => {
    expect(parseQuantity('3')).toBe(3)
    expect(parseQuantity(' 2 ')).toBe(2)
    for (const text of ['1e1', '0x2', '1.5', '-1', '', 'deux'])
      expect(parseQuantity(text)).toBeNull()
  })
})

describe('readCardmarketId', () => {
  test('un nombre, zéros de tête et espaces autour ignorés', () => {
    expect(readCardmarketId('719603')).toBe(719603)
    expect(readCardmarketId(' 42 ')).toBe(42)
    expect(readCardmarketId('0012')).toBe(12)
  })

  test('vide : aucun id ; autre chose qu’un nombre, ou 0 : refusé', () => {
    expect(readCardmarketId('')).toBeNull()
    expect(readCardmarketId('12 345')).toBeUndefined()
    expect(readCardmarketId('1.5')).toBeUndefined()
    expect(readCardmarketId('-3')).toBeUndefined()
    expect(readCardmarketId('0')).toBeUndefined()
  })
})

describe('cardmarketPage', () => {
  const page =
    'https://www.cardmarket.com/fr/Pokemon/Products/Singles/Pokemon-Card-151/Bulbasaur-V2-sv2a166'

  test('les offres en japonais, Near Mint au moins : page notée ou page de l’id', () => {
    expect(cardmarketPage({ page })).toBe(`${page}?language=7&minCondition=2`)
    expect(cardmarketPage({ cardmarket: 719442 })).toBe(
      'https://www.cardmarket.com/fr/Pokemon/Products?idProduct=719442&language=7&minCondition=2',
    )
    expect(cardmarketPage({})).toBeNull()
  })

  test('une page collée avec ses propres filtres les garde', () => {
    expect(cardmarketPage({ page: `${page}?language=1` })).toBe(`${page}?language=1&minCondition=2`)
  })
})
