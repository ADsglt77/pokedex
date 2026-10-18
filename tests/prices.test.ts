/**
 * Le prix d'une carte, que lisent la liste d'achats et le plan : celui de son id Cardmarket, jamais
 * celui d'une autre carte, et aucun s'il n'y en a pas (aucun prix n'est inventé) ; l'API ne rend
 * que les prix des cartes demandées (`/api/prices/collection`, `/api/prices/selection`), avec un
 * ETag qui change avec eux. Et les historiques de la collection, lus en une demande, que la courbe
 * de sa valeur additionne.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { Elysia } from 'elysia'
import { collectionHistory, historiesOf, priceOf } from '@/lib/prices'
import type { CardPriceHistory, PriceFile, PriceHistories } from '@/types'
import { DATA_DIR, openData, writeSource } from '../server/db'
import { referenceRoutes } from '../server/reference'

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

describe('/api/prices/collection et /api/prices/selection', () => {
  // Jamais `.data` : la base neuve du dossier temporaire de `setup.ts`.
  if (!DATA_DIR.startsWith(tmpdir())) throw new Error(`DATA_DIR n’est pas temporaire : ${DATA_DIR}`)
  const data = openData()
  afterAll(() => data.close())
  const api = new Elysia().group('/api', (group) => group.use(referenceRoutes(data)))
  const get = (path: string, headers: Record<string, string> = {}) =>
    api.handle(new Request(`http://localhost/api/prices/${path}`, { headers }))

  test('tant que les prix n’ont jamais été lus : 404', async () => {
    expect((await get('collection?ids=719445')).status).toBe(404)
  })

  test('les prix des seules cartes demandées, jamais ceux d’une autre', async () => {
    const write = data.query(
      'INSERT INTO cardmarket_prices (id, price, low, avg30) VALUES (?, ?, ?, ?)',
    )
    write.run(719445, 6.87, 5, 7.2)
    write.run(719446, 99, null, null)
    write.run(719447, 1.5, 1, 2)
    writeSource(data, 'cardmarket', { stamp: 'lundi', date: '2026-10-12' })
    for (const path of ['collection', 'selection']) {
      const response = await get(`${path}?ids=719446,1,719445,719445`)
      expect(response.status).toBe(200)
      expect((await response.json()) as PriceFile).toEqual({
        date: '2026-10-12',
        cards: { '719445': [6.87, 5, 7.2], '719446': [99, null, null] },
      })
    }
  })

  test('un ETag : 304 tant que les prix n’ont pas changé, puis les nouveaux', async () => {
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
