/**
 * L'import d'un export, et le document qu'un appareil envoie au serveur (mêmes contrôles) : un
 * fichier retouché qui fausserait le budget est refusé.
 */

import { describe, expect, test } from 'bun:test'
import { DEFAULT_BUDGET } from '@/config/shopping'
import { applyOrder } from '@/lib/orders'
import { buildExportFile, parseImport, readDocument } from '@/lib/transfer'
import type { CollectionData, ShoppingData } from '@/types'
import { collectionWith, line, NOW, order, ownership } from './fixtures'

const collection: CollectionData = {
  ...collectionWith({
    a: ownership('ordered', { paidPrice: 17 }),
    b: ownership('owned', { acquiredAt: NOW }),
  }),
  customCards: { a: { id: 'a', dexIds: [25], reference: 'Pikachu (SV8 033)', image: null } },
}

const shopping: ShoppingData = {
  schemaVersion: 1,
  updatedAt: null,
  preferences: { a: { decision: 'accepted', priority: 'normal', note: 'Mint', updatedAt: NOW } },
  orders: [
    order({
      lines: [line('a', 12)],
      shipping: 5,
      reference: 'CM-1',
      note: 'Bien emballée',
      supplier: 'other',
      supplierName: 'Une boutique',
    }),
  ],
  budget: { ...DEFAULT_BUDGET },
}

/** L'export de `data`, retouché comme à la main (`value` mise à `path`, ou retirée), puis relu. */
function reimport(
  path: (string | number)[] = [],
  value?: unknown,
  data = { collection, shopping },
) {
  const file = JSON.parse(JSON.stringify(buildExportFile(data.collection, data.shopping)))
  if (path.length) {
    const parent = path.slice(0, -1).reduce((node, key) => node[key], file)
    if (value === undefined) delete parent[path.at(-1)!]
    else parent[path.at(-1)!] = value
  }
  return parseImport(JSON.stringify(file))
}

const ORDER = ['shopping', 'orders', 0]

describe('import', () => {
  test('un export de l’app se réimporte tel quel', () => {
    expect(reimport()).toEqual({ collection, shopping })
  })

  test('un montant en texte est refusé : il fausserait le budget', () => {
    expect(reimport([...ORDER, 'shipping'], '5')).toBeNull()
    expect(reimport([...ORDER, 'lines', 0, 'unitPrice'], '12')).toBeNull()
    expect(reimport(['shopping', 'budget', 'monthly'], -1)).toBeNull()
  })

  test('un remboursé plus grand que la commande est refusé : une dépense négative', () => {
    expect(reimport([...ORDER, 'refunded'], 17)).not.toBeNull()
    expect(reimport([...ORDER, 'refunded'], 17.01)).toBeNull()
  })

  test('une commande à l’état ou à la date illisible est refusée', () => {
    expect(reimport([...ORDER, 'state'], 'lost')).toBeNull()
    expect(reimport([...ORDER, 'receivedAt'], 'hier')).toBeNull()
  })

  test('un jour qui n’existe pas est refusé', () => {
    expect(reimport([...ORDER, 'date'], '2026-13-45')).toBeNull()
    expect(reimport([...ORDER, 'date'], '2026-02-30')).toBeNull()
    expect(reimport([...ORDER, 'receivedAt'], '2026-02-29')).toBeNull()
    expect(reimport([...ORDER, 'receivedAt'], '2028-02-29')).not.toBeNull()
  })

  test('une commande sans id, ou du même id qu’une autre, est refusée', () => {
    expect(reimport([...ORDER, 'id'])).toBeNull()
    expect(reimport([...ORDER, 'id'], 7)).toBeNull()
    expect(reimport([...ORDER, 'id'], '')).toBeNull()
    const twice = { ...shopping, orders: [shopping.orders[0]!, shopping.orders[0]!] }
    expect(reimport([], undefined, { collection, shopping: twice })).toBeNull()
  })

  test('un texte qui n’en est pas un est refusé : les pages le liraient comme tel', () => {
    expect(reimport(['collection', 'customCards', 'a', 'reference'], 5)).toBeNull()
    expect(reimport(['shopping', 'preferences', 'a', 'note'], 5)).toBeNull()
    expect(reimport([...ORDER, 'supplierName'], 5)).toBeNull()
    expect(reimport([...ORDER, 'reference'], 5)).toBeNull()
    expect(reimport([...ORDER, 'note'], ['Bien emballée'])).toBeNull()
    expect(reimport(['collection', 'cards', 'a', 'updatedAt'], 5)).toBeNull()
    expect(reimport(['collection', 'updatedAt'], 5)).toBeNull()
    expect(reimport(['shopping', 'updatedAt'], 5)).toBeNull()
  })

  test('une date d’obtention illisible est refusée ; absente, elle est acceptée', () => {
    expect(reimport(['collection', 'cards', 'b', 'acquiredAt'], 5)).toBeNull()
    expect(reimport(['collection', 'cards', 'b', 'acquiredAt'], 'hier')).toBeNull()
    expect(reimport(['collection', 'cards', 'b', 'acquiredAt'], null)).not.toBeNull()
    expect(reimport(['collection', 'cards', 'b', 'acquiredAt'])).not.toBeNull()
  })

  test('une carte d’une page hors de Cardmarket est refusée ; sur Cardmarket, acceptée', () => {
    const page = ['collection', 'customCards', 'a', 'page']
    expect(reimport(page, 'https://example.com/fr/Pokemon/Products?idProduct=1')).toBeNull()
    expect(reimport(page, 'http://www.cardmarket.com/fr/Pokemon/Products?idProduct=1')).toBeNull()
    expect(
      reimport(page, 'https://www.cardmarket.com/fr/Pokemon/Products?idProduct=1'),
    ).not.toBeNull()
  })

  test('une carte sans Pokémon, ou rangée sous un autre id que le sien, est refusée', () => {
    expect(reimport(['collection', 'customCards', 'a', 'dexIds'], [])).toBeNull()
    expect(reimport(['collection', 'customCards', 'a', 'id'], 'b')).toBeNull()
  })

  test('une commande avec deux lignes d’une même carte est refusée', () => {
    expect(reimport([...ORDER, 'lines'], [line('a', 12), line('a', 3)])).toBeNull()
    expect(reimport([...ORDER, 'lines'], [line('a', 12), line('b', 3)])).not.toBeNull()
  })

  test('une priorité inconnue est refusée', () => {
    expect(reimport(['shopping', 'preferences', 'a', 'priority'], 'urgente')).toBeNull()
  })

  test('un export d’avant le module d’achats garde les achats en place', () => {
    expect(reimport(['shopping'])?.shopping).toBeNull()
  })

  test('une commande reçue avec une carte gratuite et un port de 2 centimes se réimporte', () => {
    const received = order({
      lines: [line('a', 1, { quantity: 3 }), line('b', 0)],
      shipping: 0.02,
      state: 'received',
      receivedAt: '2026-10-09',
    })
    const owned = applyOrder(collectionWith(), null, received, [], NOW)
    const data = { collection: owned, shopping: { ...shopping, orders: [received] } }
    expect(reimport([], undefined, data)).toEqual(data)
  })
})

describe('document envoyé au serveur', () => {
  /** Le document tel que le serveur le reçoit (JSON). */
  const received = (document: object) => readDocument(JSON.parse(JSON.stringify(document)))

  test('un document de l’app est accepté tel quel', () => {
    expect(received({ collection, shopping })).toEqual({ collection, shopping })
  })

  test('sans achats, il est refusé : ce n’est pas un vieil export', () => {
    expect(received({ collection })).toBeNull()
    expect(received({ shopping })).toBeNull()
  })

  test('il passe les contrôles d’un import', () => {
    const lines = [line('a', 12), line('a', 3)]
    const twice = { ...shopping, orders: [{ ...shopping.orders[0]!, lines }] }
    expect(received({ collection, shopping: twice })).toBeNull()
    const unknown = { ...shopping.preferences.a!, priority: 'urgente' }
    expect(
      received({ collection, shopping: { ...shopping, preferences: { a: unknown } } }),
    ).toBeNull()
  })
})
