/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : celui de son id Cardmarket, jamais
 * celui d'une autre carte, et aucun s'il n'y en a pas (aucun prix n'est inventé) ; l'API ne rend
 * que les prix des cartes demandées (`/api/prices/collection`, `/api/prices/selection`), une clé
 * pour chacune (`null` sans prix), avec un ETag qui change avec eux. L'écriture quotidienne du
 * guide des prix, et de l'historique (irremplaçable : Cardmarket n'en garde pas). Et les
 * historiques de la collection, lus en une demande, que la courbe de sa valeur additionne.
 */

import { describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { collectionHistory, historiesOf, priceOf } from '@/lib/prices'
import type { CardPriceHistory, PriceFile, PriceHistories } from '@/types'
import { readSource, writeSource } from '../server/db'
import { historyReader } from '../server/history'
import { savePriceGuide, type PriceGuide, type ProductList } from '../server/jobs/prices'
import { referenceRoutes } from '../server/reference'
import { testData } from './server'

const prices: PriceFile = {
  date: '2026-10-12',
  cards: { '719445': [6.87, 5, 7.2], '719446': [99, null, null] },
}

describe('priceOf', () => {
  test('une carte reliée à Cardmarket : le prix de son id', () => {
    expect(priceOf(prices, { cardmarket: 719445 })).toEqual({ price: 6.87, low: 5, avg30: 7.2 })
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

  test('sans historique, ou absente d’une réponse gardée hors ligne : ne compte pas', () => {
    expect(historiesOf(response, [719445, 1, 719621])).toEqual([a])
    expect(historiesOf({}, [719621])).toEqual([])
  })
})

/** La base des prix : chaque test pose son propre état (ils passent dans n'importe quel ordre). */
const data = testData()

/** Aucun prix lu, aucun historique, aucun produit. */
function reset() {
  data.run("DELETE FROM sources WHERE name = 'cardmarket'")
  data.run('DELETE FROM cardmarket_prices')
  data.run('DELETE FROM cardmarket_history')
  data.run('DELETE FROM cardmarket_products')
}

/** Les prix du jour de trois cartes, et le passage de la tâche (`stamp`). */
function writePrices(stamp = 'lundi', date = '2026-10-12') {
  const write = data.query(
    'INSERT INTO cardmarket_prices (id, price, low, avg30) VALUES (?, ?, ?, ?)',
  )
  write.run(719445, 6.87, 5, 7.2)
  write.run(719446, 99, null, null)
  write.run(719447, 1.5, 1, 2)
  writeSource(data, 'cardmarket', { stamp, date })
}

describe('/api/prices/collection et /api/prices/selection', () => {
  const api = new Elysia().group('/api', (group) => group.use(referenceRoutes(data)))
  const get = (path: string, headers: Record<string, string> = {}) =>
    api.handle(new Request(`http://localhost/api/prices/${path}`, { headers }))

  test('tant que les prix n’ont jamais été lus : 404', async () => {
    reset()
    expect((await get('collection?ids=719445')).status).toBe(404)
  })

  test('les prix des seules cartes demandées, une clé chacune (`null` sans prix), jamais ceux d’une autre', async () => {
    reset()
    writePrices()
    for (const path of ['collection', 'selection']) {
      const response = await get(`${path}?ids=719446,1,719445,719445`)
      expect(response.status).toBe(200)
      expect((await response.json()) as PriceFile).toEqual({
        date: '2026-10-12',
        cards: { '719445': [6.87, 5, 7.2], '719446': [99, null, null], '1': null },
      })
    }
  })

  test('un ETag : 304 tant que les prix n’ont pas changé, puis les nouveaux', async () => {
    reset()
    writePrices()
    const first = await get('collection?ids=719445')
    const etag = first.headers.get('etag')!
    expect((await get('collection?ids=719445', { 'If-None-Match': etag })).status).toBe(304)
    // Affaibli par un relais (Cloudflare) : le même.
    expect((await get('collection?ids=719445', { 'If-None-Match': `W/${etag}` })).status).toBe(304)
    // D'autres cartes : une autre réponse.
    expect((await get('collection?ids=719446', { 'If-None-Match': etag })).status).toBe(200)
    // Le passage suivant de la tâche : de nouveaux prix, un autre ETag.
    data.query('UPDATE cardmarket_prices SET price = 7.1 WHERE id = 719445').run()
    writeSource(data, 'cardmarket', { stamp: 'mardi', date: '2026-10-13' })
    const next = await get('collection?ids=719445', { 'If-None-Match': etag })
    expect(next.status).toBe(200)
    expect(((await next.json()) as PriceFile).cards['719445']![0]).toBe(7.1)
  })

  test('des ids mal écrits : refusés', async () => {
    expect((await get('collection?ids=719445,abc')).status).toBe(422)
    expect((await get('selection?ids=0719445')).status).toBe(422)
  })
})

describe('savePriceGuide : les prix du jour et l’historique', () => {
  const SINGLE = 51
  /** Un guide des prix du jour `day` : une ligne par carte (`[id, tendance, moyenne, plus bas]`). */
  const guide = (
    day: string,
    rows: [id: number, trend: number | null, avg30: number | null, low?: number | null][],
    sealed: number[] = [],
  ): PriceGuide => ({
    createdAt: `${day}T03:00:00+0200`,
    priceGuides: [
      ...rows.map(([idProduct, trend, avg30, low = null]) => ({
        idProduct,
        idCategory: SINGLE,
        trend,
        avg30,
        low,
      })),
      ...sealed.map((idProduct) => ({ idProduct, idCategory: 52, trend: 50, avg30: 50, low: 40 })),
    ],
  })
  const products = (ids: number[]): ProductList => ({
    products: ids.map((idProduct) => ({
      idProduct,
      name: `Carte ${idProduct}`,
      idExpansion: 7,
      idMetacard: idProduct,
    })),
  })
  const history = historyReader(data)
  const priceRow = (id: number) =>
    data.query('SELECT price, low, avg30 FROM cardmarket_prices WHERE id = ?').get(id)

  test('le jour suivant : ajouté à l’année de chaque carte, les autres cartes intactes', () => {
    reset()
    savePriceGuide(
      data,
      guide('2026-10-12', [
        [1, 6.87, 7.2, 5],
        [2, 3, 3],
      ]),
      products([1, 2]),
      'a',
    )
    savePriceGuide(
      data,
      guide('2026-10-13', [
        [1, 7.1, 7.2],
        [2, 3, 3],
      ]),
      products([1, 2]),
      'b',
    )
    expect(history(1)).toEqual({ name: 'Carte 1', from: '2026-10-12', prices: [6.87, 7.1] })
    expect(history(2)).toEqual({ name: 'Carte 2', from: '2026-10-12', prices: [3, 3] })
    expect(priceRow(1)).toEqual({ price: 7.1, low: null, avg30: 7.2 })
    expect(readSource(data, 'cardmarket')).toEqual({ stamp: 'b', date: '2026-10-13' })
  })

  test('relancée le même jour : le prix du jour remplacé, rien d’ajouté', () => {
    reset()
    savePriceGuide(data, guide('2026-10-12', [[1, 6.87, 7.2]]), products([1]), 'a')
    savePriceGuide(data, guide('2026-10-12', [[1, 6.5, 7.2]]), products([1]), 'a2')
    expect(history(1)).toEqual({ name: 'Carte 1', from: '2026-10-12', prices: [6.5] })
  })

  test('sans tendance, la moyenne sur 30 jours ; 0 compte pour pas de prix ; le scellé ignoré', () => {
    reset()
    const day = guide(
      '2026-10-12',
      [
        [1, null, 4.2, 0],
        [2, 0, 0],
        [3, 2, null],
      ],
      [9],
    )
    savePriceGuide(data, day, products([1, 2, 3]), 'a')
    expect(priceRow(1)).toEqual({ price: 4.2, low: null, avg30: 4.2 })
    expect(priceRow(2)).toBeNull()
    expect(priceRow(9)).toBeNull()
    expect(history(2)).toBeNull()
    expect(history(3)).toEqual({ name: 'Carte 3', from: '2026-10-12', prices: [2] })
  })

  test('moins de la moitié des prix d’avant (le format a changé) : une erreur, rien d’écrit', () => {
    reset()
    savePriceGuide(
      data,
      guide('2026-10-12', [
        [1, 1, 1],
        [2, 2, 2],
        [3, 3, 3],
      ]),
      products([1, 2, 3]),
      'a',
    )
    expect(() =>
      savePriceGuide(data, guide('2026-10-13', [[1, 1.5, 1]]), products([1, 2, 3]), 'b'),
    ).toThrow('format changé')
    expect(history(1)).toEqual({ name: 'Carte 1', from: '2026-10-12', prices: [1] })
    expect(priceRow(2)).toEqual({ price: 2, low: null, avg30: 2 })
    expect(readSource(data, 'cardmarket')).toEqual({ stamp: 'a', date: '2026-10-12' })
  })

  test('un produit que la liste ne donne plus : son nom reste, son extension part', () => {
    reset()
    savePriceGuide(
      data,
      guide('2026-10-12', [
        [1, 1, 1],
        [2, 2, 2],
      ]),
      products([1, 2]),
      'a',
    )
    savePriceGuide(
      data,
      guide('2026-10-13', [
        [1, 1, 1],
        [2, 2, 2],
      ]),
      products([1]),
      'b',
    )
    expect(
      data.query('SELECT name, expansion, metacard FROM cardmarket_products WHERE id = 2').get(),
    ).toEqual({ name: 'Carte 2', expansion: null, metacard: null })
  })
})
