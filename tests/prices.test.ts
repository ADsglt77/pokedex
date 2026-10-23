/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : celui de son id Cardmarket, jamais
 * celui d'une autre carte, et aucun s'il n'y en a pas (aucun prix n'est inventé). Et les
 * historiques de la collection, que la courbe de sa valeur additionne. Et les demandes par paquets
 * (l'API des données refuse plus de 1 025 ids ; des paquets de prix qui se décaleraient seraient
 * redemandés sans fin, et nginx en refuserait l'excès : plus aucun prix). Et le
 * coût pour compléter le Pokédex : la favorite de chaque Pokémon à débloquer, une carte comptée
 * une fois, rien pour un Pokémon déjà débloqué (par n'importe quelle de ses cartes) ou dont une
 * carte est commandée. Les prix et leur historique eux-mêmes : l'API des données (ses propres
 * tests).
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { buildPokedex } from '@/lib/pokedex'
import {
  collectionHistory,
  completionCost,
  historiesOf,
  idBatches,
  priceBatches,
  priceOf,
} from '@/lib/prices'
import type { CardPriceHistory, PriceFile, PriceHistories } from '@/types'
import { card, collectionWith, loadTestSpecies, ownership, withCards } from './fixtures'

beforeAll(loadTestSpecies)

const prices: PriceFile = {
  date: '2026-10-12',
  cards: { '719445': [6.87, 5, 7.2], '719446': [99, null, null] },
}

describe('priceOf', () => {
  test('une carte reliée à Cardmarket : le prix de son id', () => {
    expect(priceOf(prices, { cardmarket: 719445 })).toEqual({
      price: 6.87,
      low: 5,
      monthAgo: 7.2,
    })
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

describe('historiesOf', () => {
  const history = (from: string, prices: (number | null)[]): CardPriceHistory => ({
    name: null,
    from,
    prices,
  })
  const a = history('2026-10-14', [10, 11])
  const b = history('2026-10-15', [5])
  const response: PriceHistories = { '719621': a, '719446': b, '719445': null }

  test('dans l’ordre des cartes, chaque id avec son historique', () => {
    expect(historiesOf(response, [719446, 719621])).toEqual([b, a])
  })

  test('la même carte possédée pour deux Pokémon compte deux fois, comme au prix du jour', () => {
    expect(historiesOf(response, [719446, 719446, 719621])).toEqual([b, b, a])
    expect(collectionHistory(historiesOf(response, [719446, 719446, 719621]))).toEqual([
      { date: '2026-10-14', value: 20 },
      { date: '2026-10-15', value: 21 },
    ])
  })

  test('sans historique, ou absente de la réponse : ne compte pas', () => {
    expect(historiesOf(response, [719445, 1, 719621])).toEqual([a])
    expect(historiesOf({}, [719621])).toEqual([])
  })
})

describe('les demandes par paquets', () => {
  /** Les ids de `from` à `to`, compris. */
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index)
  const sizes = (batches: number[][]) => batches.map((batch) => batch.length)

  test('une collection de plus de 1 000 cartes : des paquets de 1 000 au plus, chaque id une fois', () => {
    const ids = [...range(1, 2001), 5, 2001]
    const batches = idBatches(ids)
    expect(sizes(batches)).toEqual([1000, 1000, 1])
    expect(batches.flat()).toEqual(range(1, 2001))
    // Tout tient dans un paquet : une seule demande, ses ids dans leur ordre.
    expect(idBatches([3, 1, 3, 2])).toEqual([[3, 1, 2]])
    expect(idBatches([])).toEqual([])
  })

  test('les prix : des paquets fixes de 200, que les réponses d’autres cartes ne décalent pas', () => {
    // Dans le désordre, avec un doublon : coupés dans la liste triée.
    const ids = [...range(201, 450), ...range(1, 200), 7]
    const all = priceBatches(ids, new Set())
    expect(sizes(all)).toEqual([200, 200, 50])
    expect(all.flat()).toEqual(range(1, 450))
    // Des prix arrivés pour quelques cartes d'un paquet en cours (une autre liste) : les mêmes
    // paquets, donc les mêmes adresses, rien de redemandé en double.
    expect(priceBatches(ids, new Set([3, 250, 449]))).toEqual(all)
    // Un paquet entièrement connu n'est plus demandé ; les autres restent tels quels.
    expect(priceBatches(ids, new Set(range(1, 200)))).toEqual(all.slice(1))
    expect(priceBatches(ids, new Set(range(1, 450)))).toEqual([])
  })
})

describe('coût pour compléter', () => {
  const costs: PriceFile = {
    date: '2026-10-12',
    cards: {
      '1': [10, 8, 12],
      '2': [99, 90, 99],
      '3': [3, 2, 3],
      '4': [500, 400, 500],
      '5': [4, 3, 4],
      '6': [600, 500, 600],
    },
  }

  test('la favorite d’un Pokémon à débloquer, rien pour un Pokémon débloqué par une autre carte ni pour celui dont une carte est commandée', () => {
    const data = withCards(
      collectionWith({ own: ownership('owned'), ordered: ownership('ordered') }),
      // Pikachu : à débloquer, sa favorite vaut 10 € et l'autre carte 99 €.
      card('favorite', [25], { cardmarket: 1 }),
      card('other', [25], { cardmarket: 2 }),
      // Bulbizarre : débloqué par sa deuxième carte, sa favorite (3 €) ne compte pas.
      card('unowned', [1], { cardmarket: 3 }),
      card('own', [1], { cardmarket: 4 }),
      // Zekrom : une carte commandée, sa favorite (4 €) ne compte pas non plus.
      card('waiting', [644], { cardmarket: 5 }),
      card('ordered', [644], { cardmarket: 6 }),
    )
    // Salamèche n'a pas de carte.
    expect(completionCost(buildPokedex(data).entries, costs)).toEqual({
      value: 10,
      priced: 1,
      unpriced: 0,
      noCard: 1,
    })
  })

  test('une carte TAG TEAM, favorite de deux Pokémon, n’est comptée qu’une fois', () => {
    const data = withCards(collectionWith(), card('tag', [25, 644], { cardmarket: 1 }))
    expect(completionCost(buildPokedex(data).entries, costs)).toMatchObject({
      value: 10,
      priced: 2,
    })
  })
})
