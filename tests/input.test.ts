/**
 * Ce que l'utilisateur saisit et qui compte en argent : les montants (lignes de commande, port,
 * frais, remboursé, budget, prix payé), la saisie d'une commande qui les lit (`readDraft`) et l'id
 * Cardmarket d'une carte (d'où son prix). Un montant mal lu fausserait le budget sans rien dire. Et
 * le lien vers Cardmarket : ses offres dans la langue de la carte (japonais, ou français pour une
 * carte française), Near Mint au moins (une autre langue, ce serait une autre carte achetée).
 */

import { describe, expect, test } from 'bun:test'
import { cardmarketPage, readCardmarketId } from '@/lib/cardmarket'
import { parseEuros, parseQuantity } from '@/lib/format'
import { readDraft, toDraft, type Draft } from '@/pages/shopping/orderDraft'
import { collectionWith, line, order } from './fixtures'

describe('parseEuros', () => {
  test('virgule ou point, symbole et espaces des milliers, insécables compris', () => {
    expect(parseEuros('12,50')).toBe(12.5)
    expect(parseEuros('12.5 €')).toBe(12.5)
    expect(parseEuros('€ 12')).toBe(12)
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
    // Le symbole au milieu, au lieu de la virgule : refusé plutôt que lu 1 250 €.
    expect(parseEuros('12€50')).toBeNull()
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

describe('readDraft : la saisie d’une commande', () => {
  const base = order()
  /** La saisie d'une nouvelle commande : une carte, 2 à 12,50 €, et `change`. */
  const read = (change: Partial<Draft> = {}) =>
    readDraft(
      {
        ...toDraft(base),
        lines: [{ cardId: 'a', quantity: '2', unitPrice: '12,50' }],
        ...change,
      },
      base,
      null,
      collectionWith(),
    )

  test('des montants lisibles : lus au centime, sans erreur', () => {
    const { order: typed, errors } = read({ shipping: '4,50', fees: '1.20 €', refunded: ' 3 ' })
    expect(errors).toEqual({})
    expect([typed.shipping, typed.fees, typed.refunded]).toEqual([4.5, 1.2, 3])
    expect(typed.lines).toEqual([{ cardId: 'a', quantity: 2, unitPrice: 12.5, previous: null }])
  })

  test('les champs facultatifs vides : 0 ou rien, sans erreur', () => {
    const { order: typed, errors } = read({
      shipping: '',
      fees: '  ',
      refunded: '',
      supplier: 'other',
      supplierName: ' ',
      reference: ' ',
      link: '',
      note: '',
    })
    expect(errors).toEqual({})
    expect([typed.shipping, typed.fees, typed.refunded]).toEqual([0, 0, 0])
    expect([typed.supplierName, typed.reference, typed.link, typed.note]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  test('une saisie illisible : l’erreur du champ, compté pour 0, jamais un montant approché', () => {
    const { order: typed, errors } = read({
      shipping: '4,505',
      fees: 'abc',
      refunded: '12 50',
      lines: [
        { cardId: 'a', quantity: '1e1', unitPrice: '' },
        { cardId: 'b', quantity: '0', unitPrice: '1.234,50' },
      ],
    })
    expect(Object.keys(errors).sort()).toEqual([
      'fees',
      'price-a',
      'price-b',
      'quantity-a',
      'quantity-b',
      'refunded',
      'shipping',
    ])
    expect([typed.shipping, typed.fees, typed.refunded]).toEqual([0, 0, 0])
    expect(typed.lines.map((each) => [each.quantity, each.unitPrice])).toEqual([
      [0, 0],
      [0, 0],
    ])
  })

  test('le remboursé, pas plus que la commande ; les dates, en quatre chiffres ; une carte au moins', () => {
    expect(read({ refunded: '25' }).errors).toEqual({})
    expect(read({ refunded: '25,01' }).errors).toEqual({
      refunded: 'Pas plus que le total de la commande.',
    })
    // « 05/10/26 » dans le calendrier du navigateur : l'an 26.
    expect(read({ date: '0026-10-05' }).errors.date).toBe(
      'L’année en quatre chiffres, par exemple 05/10/2026.',
    )
    expect(read({ date: '' }).errors.date).toBe('Indiquez la date d’achat.')
    expect(read({ state: 'received', receivedAt: '0026-10-07' }).errors.receivedAt).toBeDefined()
    expect(read({ lines: [] }).errors.lines).toBeDefined()
    expect(read({ link: 'commande 42' }).errors.link).toBeDefined()
  })

  test('une commande relue de sa propre saisie reste la même, au centime', () => {
    const saved = order({
      lines: [line('a', 12.5, { quantity: 2 }), line('b', 0.1)],
      shipping: 4.5,
      refunded: 1.05,
      reference: 'C-42',
      link: 'https://exemple.fr/commande/42',
      note: 'Une carte abîmée',
    })
    const draft = toDraft(saved)
    // Sans frais : un champ vide, pas « 0,00 ».
    expect(draft.fees).toBe('')
    expect(readDraft(draft, saved, saved, collectionWith())).toEqual({ order: saved, errors: {} })
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

  test('une carte française : les offres en français, sur sa page notée comme sur celle de l’id', () => {
    expect(cardmarketPage({ cardmarket: 851072, language: 'fr' })).toBe(
      'https://www.cardmarket.com/fr/Pokemon/Products?idProduct=851072&language=2&minCondition=2',
    )
    expect(cardmarketPage({ page, language: 'fr' })).toBe(`${page}?language=2&minCondition=2`)
  })

  test('une page collée avec ses propres filtres les garde', () => {
    expect(cardmarketPage({ page: `${page}?language=1` })).toBe(`${page}?language=1&minCondition=2`)
    expect(cardmarketPage({ page: `${page}?language=1`, language: 'fr' })).toBe(
      `${page}?language=1&minCondition=2`,
    )
  })
})
