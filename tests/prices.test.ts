/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : celui de son id Cardmarket, jamais
 * celui d'une autre carte, et aucun s'il n'y en a pas (aucun prix n'est inventé). Et les
 * historiques de la collection, que la courbe de sa valeur additionne. Et les demandes par paquets
 * (l'API des données refuse plus de 1 025 ids ; des paquets de prix qui se décaleraient seraient
 * redemandés sans fin, et le Worker du site en refuserait l'excès (`worker/limits.ts`) : plus aucun
 * prix ; les historiques et les lignes de Cardmarket demandés d'un coup dépasseraient sa limite,
 * et une réponse partielle fausserait la courbe ou la liste de souhaits). Et le coût pour
 * compléter le Pokédex : la favorite de chaque Pokémon à débloquer, une carte comptée
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
  loadInBatches,
  priceBatches,
  priceOf,
} from '@/lib/prices'
import type { CardPriceHistory, PriceFile } from '@/types'
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
  // Les historiques reçus, gardés par id (`store/prices.ts`).
  const known = new Map([
    [719621, a],
    [719446, b],
    [719445, null],
  ])

  test('dans l’ordre des cartes, chaque id avec son historique', () => {
    expect(historiesOf(known, [719446, 719621])).toEqual([b, a])
  })

  test('la même carte possédée pour deux Pokémon compte deux fois, comme au prix du jour', () => {
    expect(historiesOf(known, [719446, 719446, 719621])).toEqual([b, b, a])
    expect(collectionHistory(historiesOf(known, [719446, 719446, 719621]))).toEqual([
      { date: '2026-10-14', value: 20 },
      { date: '2026-10-15', value: 21 },
    ])
  })

  test('sans historique, ou pas reçue : ne compte pas', () => {
    expect(historiesOf(known, [719445, 1, 719621])).toEqual([a])
    expect(historiesOf(new Map(), [719621])).toEqual([])
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

  test('les prix : des paquets fixes de 200, coupés dans la liste triée', () => {
    // Dans le désordre, avec un doublon : coupés dans la liste triée, d'après la liste seule (pas
    // les prix déjà reçus) : une réponse ne décale aucun paquet, chacun garde son adresse.
    const ids = [...range(201, 450), ...range(1, 200), 7]
    const all = priceBatches(ids)
    expect(sizes(all)).toEqual([200, 200, 50])
    expect(all.flat()).toEqual(range(1, 450))
    expect(priceBatches([...ids].reverse())).toEqual(all)
  })

  /** Une demande qui répond après un temps, et note qu'elle a commencé avant la fin d'une autre. */
  function slowLoad(answer: (batch: number[], index: number) => Record<string, string> | null) {
    const asked: number[][] = []
    let running = 0
    let overlapped = false
    const load = async (batch: number[]) => {
      overlapped ||= running > 0
      running++
      asked.push(batch)
      await new Promise((resolve) => setTimeout(resolve, 2))
      running--
      return answer(batch, asked.length - 1)
    }
    return { load, asked, overlapped: () => overlapped }
  }

  test('les historiques, les lignes de Cardmarket : des paquets de 1 000, l’un après l’autre, réunis', async () => {
    // Le Worker du site n'accepte que 30 de ces demandes par 10 s (`worker/limits.ts`) ; l'API,
    // 1 025 ids chacune.
    const lines = slowLoad((batch) => Object.fromEntries(batch.map((id) => [id, `ligne ${id}`])))
    const found = await loadInBatches([...range(1, 2500), 7, 2500], lines.load)
    expect(sizes(lines.asked)).toEqual([1000, 1000, 500])
    expect(lines.overlapped()).toBe(false)
    expect(Object.keys(found!)).toHaveLength(2500)
    expect([found![1], found![2500]]).toEqual(['ligne 1', 'ligne 2500'])
    // Aucun id : aucune demande.
    const none = slowLoad(() => null)
    expect(await loadInBatches([], none.load)).toEqual({})
    expect(none.asked).toEqual([])
  })

  test('un paquet sans réponse : rien, une réponse partielle serait fausse', async () => {
    const lines = slowLoad((_, index) => (index === 1 ? null : {}))
    expect(await loadInBatches(range(1, 2500), lines.load)).toBeNull()
    // Les paquets suivants ne sont pas demandés pour rien.
    expect(lines.asked).toHaveLength(2)
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
