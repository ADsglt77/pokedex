/**
 * Ce que l'utilisateur saisit et qui compte en argent : les montants (lignes de commande, port,
 * frais, remboursé, budget, prix maximum, prix payé) et l'id Cardmarket d'une carte (d'où son
 * prix). Un montant mal lu fausserait le budget sans rien dire.
 */

import { describe, expect, test } from 'bun:test'
import { readCardmarketId } from '@/lib/cardmarket'
import { parseEuros } from '@/lib/format'

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
