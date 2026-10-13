/** Le registre des commandes : ce qu'elles coûtent, et leur report sur la collection. */

import { describe, expect, test } from 'bun:test'
import { applyOrder, orderSpent, previousOf, unitCosts } from '@/lib/orders'
import { collectionWith, line, NOW, order, ownership } from './fixtures'

describe('ce que coûte une commande', () => {
  test('cartes, port et frais, moins le remboursé', () => {
    const spent = orderSpent(
      order({
        lines: [line('a', 10.1, { quantity: 2 }), line('b', 30)],
        shipping: 4.5,
        fees: 1.2,
        refunded: 10,
      }),
    )
    expect(spent).toBe(45.9)
  })

  test('une commande annulée ne coûte rien', () => {
    expect(orderSpent(order({ lines: [line('a', 20)], shipping: 5, state: 'cancelled' }))).toBe(0)
  })

  test('le port est réparti au prorata du prix', () => {
    const lines = [line('a', 30), line('b', 10, { quantity: 2 })]
    const costs = unitCosts({ lines, shipping: 5, fees: 0, refunded: 0 })
    expect(costs).toEqual([33, 11])
    expect(costs[0]! + 2 * costs[1]!).toBe(30 + 20 + 5)
  })

  test('les frais sont répartis comme le port, et le remboursé est déduit au prorata', () => {
    const lines = [line('a', 30), line('b', 10)]
    expect(unitCosts({ lines, shipping: 3, fees: 1, refunded: 0 })).toEqual([33, 11])
    const costs = unitCosts({ lines, shipping: 4, fees: 0, refunded: 8 })
    expect(costs).toEqual([27, 9])
    expect(costs[0]! + costs[1]!).toBe(orderSpent(order({ lines, shipping: 4, refunded: 8 })))
  })

  test('des cartes gratuites se partagent le port à parts égales', () => {
    const lines = [line('a', 0), line('b', 0, { quantity: 3 })]
    expect(unitCosts({ lines, shipping: 4, fees: 0, refunded: 0 })).toEqual([1, 1])
  })
})

describe('report sur la collection', () => {
  test('une commande en cours passe ses cartes en « commandée », au prix de revient', () => {
    const created = order({ lines: [line('a', 20)], shipping: 5 })
    const collection = applyOrder(collectionWith(), null, created, [], NOW)
    expect(collection.cards.a).toEqual({
      status: 'ordered',
      updatedAt: NOW,
      acquiredAt: null,
      paidPrice: 25,
    })
  })

  test('une carte déjà possédée (doublon) reste telle quelle', () => {
    const owned = ownership('owned', { acquiredAt: '2025-05-01T00:00:00.000Z', paidPrice: 12 })
    const before = collectionWith({ a: owned })
    const created = order({ lines: [line('a', 20, { previous: owned })] })
    expect(applyOrder(before, null, created, [], NOW)).toBe(before)
  })

  test('reçue : possédée, datée du jour de réception', () => {
    const pending = order({ lines: [line('a', 20)] })
    const ordered = applyOrder(collectionWith(), null, pending, [], NOW)
    const received = { ...pending, state: 'received' as const, receivedAt: '2026-10-09' }
    const collection = applyOrder(ordered, pending, received, [], NOW)
    expect(collection.cards.a?.status).toBe('owned')
    expect(collection.cards.a?.acquiredAt).toBe(new Date('2026-10-09T12:00:00').toISOString())
  })

  test('reçue : une date de réception corrigée corrige la date d’obtention', () => {
    const pending = order({ lines: [line('a', 20)] })
    const ordered = applyOrder(collectionWith(), null, pending, [], NOW)
    const received = { ...pending, state: 'received' as const, receivedAt: '2026-10-12' }
    const owned = applyOrder(ordered, pending, received, [], NOW)
    const corrected = { ...received, receivedAt: '2026-10-10' }
    const collection = applyOrder(owned, received, corrected, [], NOW)
    expect(collection.cards.a?.acquiredAt).toBe(new Date('2026-10-10T12:00:00').toISOString())
  })

  test('possédée avant la réception (marquée à la main) : elle garde sa date', () => {
    const pending = order({ lines: [line('a', 20)] })
    const ordered = applyOrder(collectionWith(), null, pending, [], NOW)
    const acquiredAt = '2026-10-08T09:00:00.000Z'
    const marked = collectionWith({ a: { ...ordered.cards.a!, status: 'owned', acquiredAt } })
    const received = { ...pending, state: 'received' as const, receivedAt: '2026-10-12' }
    expect(applyOrder(marked, pending, received, [], NOW).cards.a?.acquiredAt).toBe(acquiredAt)
  })

  test('une ligne retirée d’une commande en cours retrouve son état d’avant', () => {
    const wanted = ownership('wanted')
    const pending = order({ lines: [line('a', 20, { previous: wanted }), line('b', 5)] })
    const ordered = applyOrder(collectionWith({ a: wanted }), null, pending, [], NOW)
    const edited = { ...pending, lines: [pending.lines[1]!] }
    const collection = applyOrder(ordered, pending, edited, [], NOW)
    expect(collection.cards.a).toEqual(wanted)
    expect(collection.cards.b?.status).toBe('ordered')
  })

  test('annulée : chaque carte retrouve son état d’avant', () => {
    const wanted = ownership('wanted')
    const start = collectionWith({ a: wanted })
    const pending = order({ lines: [line('a', 20, { previous: wanted }), line('b', 5)] })
    const ordered = applyOrder(start, null, pending, [], NOW)
    const cancelled = applyOrder(ordered, pending, { ...pending, state: 'cancelled' }, [], NOW)
    expect(cancelled.cards.a).toEqual(wanted)
    expect(cancelled.cards.b).toBeUndefined()
  })

  test('modifier puis annuler une commande : la carte retrouve son état d’avant', () => {
    const created = order({ lines: [line('a', 20)] })
    const ordered = applyOrder(collectionWith(), null, created, [], NOW)
    // La modification relit l'état d'avant : aucun statut, pas « commandée ».
    const edited = {
      ...created,
      lines: [line('a', 25, { previous: previousOf('a', created, ordered) })],
    }
    const collection = applyOrder(ordered, created, edited, [], NOW)
    const cancelled = applyOrder(collection, edited, { ...edited, state: 'cancelled' }, [], NOW)
    expect(cancelled.cards.a).toBeUndefined()
  })

  test('annuler une commande reçue ne retire pas la possession', () => {
    const received = order({ lines: [line('a', 20)], state: 'received', receivedAt: '2026-10-09' })
    const owned = applyOrder(collectionWith(), null, received, [], NOW)
    const cancelled = applyOrder(owned, received, { ...received, state: 'cancelled' }, [], NOW)
    expect(cancelled.cards.a?.status).toBe('owned')
  })

  test('supprimer une commande reçue ne retire pas la possession', () => {
    const received = order({ lines: [line('a', 20)], state: 'received', receivedAt: '2026-10-09' })
    const owned = applyOrder(collectionWith(), null, received, [], NOW)
    const after = applyOrder(owned, received, null, [], NOW)
    expect(after.cards.a?.status).toBe('owned')
  })

  test('une carte de deux commandes supprimées perd son statut « commandée »', () => {
    const first = order({ id: 'first', lines: [line('a', 20)] })
    let collection = applyOrder(collectionWith(), null, first, [], NOW)
    // La seconde commande voit la carte « commandée » par la première.
    const second = order({ id: 'second', lines: [line('a', 18, { previous: collection.cards.a })] })
    collection = applyOrder(collection, null, second, [first], NOW)
    collection = applyOrder(collection, first, null, [second], NOW)
    collection = applyOrder(collection, second, null, [], NOW)
    expect(collection.cards.a).toBeUndefined()
  })

  test('une carte encore dans une autre commande en cours reste commandée', () => {
    const first = order({ id: 'first', lines: [line('a', 20)] })
    const second = order({ id: 'second', lines: [line('a', 18)] })
    let collection = applyOrder(collectionWith(), null, first, [], NOW)
    collection = applyOrder(collection, null, second, [first], NOW)
    collection = applyOrder(collection, first, null, [second], NOW)
    expect(collection.cards.a?.status).toBe('ordered')
  })

  test('annuler l’une de deux commandes en cours : la carte prend le prix de l’autre', () => {
    const first = order({ id: 'first', lines: [line('a', 20)] })
    const second = order({ id: 'second', lines: [line('a', 15)], shipping: 2 })
    let collection = applyOrder(collectionWith(), null, first, [], NOW)
    collection = applyOrder(collection, null, second, [first], NOW)
    expect(collection.cards.a?.paidPrice).toBe(17)
    const cancelled = { ...second, state: 'cancelled' as const }
    collection = applyOrder(collection, second, cancelled, [first], NOW)
    expect(collection.cards.a).toMatchObject({ status: 'ordered', paidPrice: 20 })
  })
})
