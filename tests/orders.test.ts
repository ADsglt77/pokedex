/**
 * Le registre des commandes : ce qu'elles coûtent, leur report sur la collection, les cartes
 * signalées en double (`duplicateReason`) et les commandes en retard (`latePendingOrders`).
 */

import { describe, expect, test } from 'bun:test'
import {
  applyOrder,
  canBePending,
  duplicateReason,
  latePendingOrders,
  orderSpent,
  previousOf,
  unitCosts,
} from '@/lib/orders'
import type { CollectionData, Order } from '@/types'
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

  test('entièrement remboursée : 0 €, pas −0 (« -0,00 € »)', () => {
    const refunded = order({ lines: [line('a', 0.7)], shipping: 0.1, refunded: 0.8 })
    expect(Object.is(orderSpent(refunded), 0)).toBe(true)
    expect(Object.is(unitCosts(refunded)[0], 0)).toBe(true)
  })

  test('sans carte lisible (quantité 0 à la saisie) : des prix finis, pas l’infini', () => {
    const lines = [line('a', 0, { quantity: 0 })]
    expect(unitCosts({ lines, shipping: 3, fees: 0, refunded: 0 })).toEqual([0])
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

  test('les centimes d’arrondi vont à une carte : les prix de revient font la commande', () => {
    const lines = [line('a', 10), line('b', 10), line('c', 10)]
    const costs = unitCosts({ lines, shipping: 1, fees: 0, refunded: 0 })
    expect(costs).toEqual([10.34, 10.33, 10.33])
    expect(Math.round((costs[0]! + costs[1]! + costs[2]!) * 100)).toBe(3100)
    // Arrondis vers le haut (9,666… → 9,67) : le centime de trop est retiré.
    const refunded = unitCosts({ lines, shipping: 0, fees: 0, refunded: 1 })
    expect(refunded).toEqual([9.66, 9.67, 9.67])
    expect(Math.round((refunded[0]! + refunded[1]! + refunded[2]!) * 100)).toBe(2900)
  })

  test('les centimes vont aux cartes seules, pas aux lignes de plusieurs cartes', () => {
    const lines = [line('a', 10, { quantity: 2 }), line('b', 10)]
    const costs = unitCosts({ lines, shipping: 1, fees: 0, refunded: 0 })
    expect(costs).toEqual([10.33, 10.34])
    expect(Math.round((2 * costs[0]! + costs[1]!) * 100)).toBe(3100)
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

  test('possédée avant la réception (marquée à la main) : ni sa date ni son prix ne changent', () => {
    const pending = order({ lines: [line('a', 20)] })
    const ordered = applyOrder(collectionWith(), null, pending, [], NOW)
    const acquiredAt = '2026-10-08T09:00:00.000Z'
    const marked = collectionWith({ a: { ...ordered.cards.a!, status: 'owned', acquiredAt } })
    const received = {
      ...pending,
      state: 'received' as const,
      receivedAt: '2026-10-12',
      lines: [line('a', 20, { previous: previousOf('a', pending, marked) })],
    }
    expect(applyOrder(marked, pending, received, [], NOW).cards.a).toBe(marked.cards.a)
  })

  test('une ligne retirée d’une commande en cours retrouve son état d’avant : aucun statut', () => {
    const pending = order({ lines: [line('a', 20), line('b', 5)] })
    const ordered = applyOrder(collectionWith(), null, pending, [], NOW)
    const edited = { ...pending, lines: [pending.lines[1]!] }
    const collection = applyOrder(ordered, pending, edited, [], NOW)
    expect(collection.cards.a).toBeUndefined()
    expect(collection.cards.b?.status).toBe('ordered')
  })

  test('annulée : chaque carte retrouve son état d’avant, une possédée avant le reste', () => {
    const owned = ownership('owned', { acquiredAt: NOW, paidPrice: 30 })
    const pending = order({ lines: [line('a', 20, { previous: owned }), line('b', 5)] })
    const ordered = applyOrder(collectionWith({ a: owned }), null, pending, [], NOW)
    const cancelled = applyOrder(ordered, pending, { ...pending, state: 'cancelled' }, [], NOW)
    expect(cancelled.cards.a).toBe(owned)
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

  test('possédée par erreur, puis corrigée : à la réception, possédée et au prix de revient', () => {
    const pending = order({ lines: [line('a', 20, { previous: ownership('owned') })] })
    // Corrigée à la main en « commandée » après l'enregistrement de la commande.
    const corrected = collectionWith({ a: ownership('ordered', { paidPrice: 12 }) })
    const previous = previousOf('a', pending, corrected)
    expect(previous).toEqual(ownership('ordered', { paidPrice: 12 }))
    const received = {
      ...pending,
      state: 'received' as const,
      receivedAt: '2026-10-09',
      lines: [line('a', 20, { previous })],
    }
    expect(applyOrder(corrected, pending, received, [], NOW).cards.a).toEqual({
      status: 'owned',
      updatedAt: NOW,
      acquiredAt: new Date('2026-10-09T12:00:00').toISOString(),
      paidPrice: 20,
    })
  })

  test('annulée puis réactivée : une carte achetée ailleurs entre-temps garde date et prix', () => {
    const cancelled = order({
      lines: [line('a', 20, { previous: ownership('ordered', { paidPrice: 12 }) })],
      state: 'cancelled',
    })
    const bought = ownership('owned', { acquiredAt: '2026-10-08T09:00:00.000Z', paidPrice: 30 })
    const start = collectionWith({ a: bought })
    const received = {
      ...cancelled,
      state: 'received' as const,
      receivedAt: '2026-10-09',
      lines: [line('a', 20, { previous: previousOf('a', cancelled, start) })],
    }
    const after = applyOrder(start, cancelled, received, [], NOW)
    expect(after.cards.a).toBe(bought)
    expect(applyOrder(after, received, { ...received, state: 'cancelled' }, [], NOW).cards.a).toBe(
      bought,
    )
  })

  test('tant que la carte porte l’effet de la commande, son état d’avant reste celui noté', () => {
    const earlier = ownership('ordered', { paidPrice: 12 })
    const pending = order({ lines: [line('a', 20, { previous: earlier })] })
    const ordered = applyOrder(collectionWith({ a: earlier }), null, pending, [], NOW)
    expect(previousOf('a', pending, ordered)).toBe(earlier)
    const received = { ...pending, state: 'received' as const, receivedAt: '2026-10-09' }
    const owned = applyOrder(ordered, pending, received, [], NOW)
    expect(previousOf('a', received, owned)).toBe(earlier)
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

describe('prix de revient au centime', () => {
  test('jamais sous 0 € : une carte gratuite ne rend pas le centime de trop', () => {
    const lines = [line('a', 1, { quantity: 3 }), line('b', 0)]
    const costs = unitCosts({ lines, shipping: 0.02, fees: 0, refunded: 0 })
    expect(costs).toEqual([1.01, 0])
    expect(costs.every((cost) => cost >= 0)).toBe(true)
  })

  test('quatre centimes d’arrondi et une seule carte seule : elle les prend tous', () => {
    const lines = [line('a', 1, { quantity: 10 }), line('b', 1)]
    const costs = unitCosts({ lines, shipping: 0.04, fees: 0, refunded: 0 })
    expect(costs).toEqual([1, 1.04])
    expect(Math.round((10 * costs[0]! + costs[1]!) * 100)).toBe(1104)
  })
})

describe('commande reçue modifiée', () => {
  test('une ligne retirée : la carte reste possédée, sans la date ni le prix de la commande', () => {
    const earlier = ownership('ordered', { paidPrice: 12 })
    const received = order({
      lines: [line('a', 20, { previous: earlier }), line('b', 5)],
      state: 'received',
      receivedAt: '2026-10-09',
    })
    const owned = applyOrder(collectionWith({ a: earlier }), null, received, [], NOW)
    expect(owned.cards.a).toMatchObject({ status: 'owned', paidPrice: 20 })
    const edited = { ...received, lines: [received.lines[1]!] }
    const collection = applyOrder(owned, received, edited, [], NOW)
    expect(collection.cards.a).toEqual({ status: 'owned', updatedAt: NOW, acquiredAt: null })
    expect(collection.cards.b).toBe(owned.cards.b)
  })

  test('une carte encore dans une autre commande reçue : la date et le prix de celle-ci', () => {
    const first = order({
      id: 'first',
      lines: [line('a', 20)],
      shipping: 2,
      state: 'received',
      receivedAt: '2026-10-07',
    })
    const second = order({
      id: 'second',
      lines: [line('a', 15)],
      state: 'received',
      receivedAt: '2026-10-09',
    })
    let both = applyOrder(collectionWith(), null, first, [], NOW)
    both = applyOrder(both, null, second, [first], NOW)
    expect(both.cards.a?.paidPrice).toBe(15)
    // La seconde supprimée : la date et le prix de revient de la première.
    expect(applyOrder(both, second, null, [first], NOW).cards.a).toEqual({
      status: 'owned',
      updatedAt: NOW,
      acquiredAt: new Date('2026-10-07T12:00:00').toISOString(),
      paidPrice: 22,
    })
    // La première annulée : ceux de la seconde.
    const cancelled = { ...first, state: 'cancelled' as const }
    expect(applyOrder(both, first, cancelled, [second], NOW).cards.a).toMatchObject({
      status: 'owned',
      acquiredAt: new Date('2026-10-09T12:00:00').toISOString(),
      paidPrice: 15,
    })
  })

  test('reçue, elle ne repasse pas en cours : remboursée puis annulée, sa carte la suit', () => {
    const received = order({ lines: [line('a', 20)], state: 'received', receivedAt: '2026-10-09' })
    // En cours, sa carte resterait possédée (jamais retirée) : au prochain enregistrement, elle
    // passerait pour possédée avant la commande, et garderait son prix et sa date.
    expect(canBePending(received)).toBe(false)
    expect(canBePending(null)).toBe(true)
    expect(canBePending({ ...received, state: 'pending' })).toBe(true)
    expect(canBePending({ ...received, state: 'cancelled' })).toBe(true)

    // Les enregistrements suivants, comme le store : l'état d'avant relu (`previousOf`).
    const resave = (before: Order, change: Partial<Order>, collection: CollectionData) => {
      const after = {
        ...before,
        ...change,
        lines: before.lines.map((known) => ({
          ...known,
          previous: previousOf(known.cardId, before, collection),
        })),
      }
      return { after, collection: applyOrder(collection, before, after, [], NOW) }
    }
    const owned = applyOrder(collectionWith(), null, received, [], NOW)
    const refunded = resave(received, { refunded: 5 }, owned)
    expect(refunded.after.lines[0]?.previous).toBeNull()
    expect(duplicateReason(refunded.after.lines[0]!, [])).toBeNull()
    expect(refunded.collection.cards.a).toEqual({
      status: 'owned',
      updatedAt: NOW,
      acquiredAt: new Date('2026-10-09T12:00:00').toISOString(),
      paidPrice: 15,
    })
    const cancelled = resave(
      refunded.after,
      { state: 'cancelled', receivedAt: undefined },
      refunded.collection,
    )
    expect(cancelled.collection.cards.a).toEqual({
      status: 'owned',
      updatedAt: NOW,
      acquiredAt: null,
    })
  })

  test('une carte possédée avant la commande (doublon) n’est pas touchée', () => {
    const owned = ownership('owned', { acquiredAt: '2025-05-01T00:00:00.000Z', paidPrice: 12 })
    const received = order({
      lines: [line('a', 20, { previous: owned }), line('b', 5)],
      state: 'received',
      receivedAt: '2026-10-09',
    })
    const start = applyOrder(collectionWith({ a: owned }), null, received, [], NOW)
    const edited = { ...received, lines: [received.lines[1]!] }
    expect(applyOrder(start, received, edited, [], NOW).cards.a).toBe(owned)
  })
})

describe('rien ne change', () => {
  test('une commande enregistrée telle quelle rend la même collection, sans rien réécrire', () => {
    const later = '2026-10-12T10:00:00.000Z'
    const pending = order({ lines: [line('a', 20), line('b', 5, { quantity: 2 })], shipping: 3 })
    const ordered = applyOrder(collectionWith(), null, pending, [], NOW)
    expect(applyOrder(ordered, pending, { ...pending }, [], later)).toBe(ordered)
    const received = { ...pending, state: 'received' as const, receivedAt: '2026-10-09' }
    const owned = applyOrder(ordered, pending, received, [], NOW)
    expect(applyOrder(owned, received, { ...received }, [], later)).toBe(owned)
    const empty = collectionWith()
    const cancelled = { ...pending, state: 'cancelled' as const }
    expect(applyOrder(empty, cancelled, { ...cancelled }, [], later)).toBe(empty)
  })
})

describe('doublons et retards', () => {
  test('une carte déjà reçue avec une autre commande est signalée : son prix payé changerait', () => {
    const first = order({ id: 'first', lines: [line('a', 10)], state: 'received' })
    const reason = duplicateReason(line('a', 50, { previous: ownership('ordered') }), [first])
    expect(reason).toStartWith('Déjà reçue avec la commande du')
    expect(duplicateReason(line('b', 50), [first])).toBeNull()
  })

  test('une carte déjà possédée, ou déjà dans une commande en cours, est signalée', () => {
    const owned = line('a', 50, { previous: ownership('owned') })
    expect(duplicateReason(owned, [])).toBe('Déjà possédée avant cette commande')
    const pending = order({ id: 'pending', lines: [line('a', 10)] })
    expect(duplicateReason(line('a', 50), [pending])).toStartWith(
      'Déjà dans la commande en cours du',
    )
  })

  test('en retard : en cours, achetée il y a plus de 28 jours', () => {
    const late = order({ id: 'late', date: '2026-09-14' })
    const orders = [
      late,
      order({ id: 'just', date: '2026-09-15' }),
      order({ id: 'received', date: '2026-08-01', state: 'received' }),
      order({ id: 'cancelled', date: '2026-08-01', state: 'cancelled' }),
    ]
    expect(latePendingOrders(orders, '2026-10-13')).toEqual([late])
  })
})
