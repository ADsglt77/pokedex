/** L'import d'un export : un fichier retouché qui fausserait le budget est refusé. */

import { describe, expect, test } from 'bun:test'
import { DEFAULT_BUDGET } from '@/config/shopping'
import { buildExportFile, parseImport } from '@/lib/transfer'
import type { ShoppingData } from '@/types'
import { collectionWith, line, order, ownership } from './fixtures'

const collection = {
  ...collectionWith({ a: ownership('ordered', { paidPrice: 17 }) }),
  customCards: { a: { id: 'a', dexIds: [25], reference: 'Pikachu (SV8 033)', image: null } },
}

const shopping: ShoppingData = {
  schemaVersion: 1,
  updatedAt: null,
  preferences: {},
  orders: [order({ lines: [line('a', 12)], shipping: 5 })],
  budget: { ...DEFAULT_BUDGET },
}

/** L'export, retouché comme à la main (`value` mise à `path`, ou retirée), puis relu. */
function reimport(path: (string | number)[] = [], value?: unknown) {
  const file = JSON.parse(JSON.stringify(buildExportFile(collection, shopping)))
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

  test('une commande à l’état ou à la date illisible est refusée', () => {
    expect(reimport([...ORDER, 'state'], 'lost')).toBeNull()
    expect(reimport([...ORDER, 'receivedAt'], 'hier')).toBeNull()
  })

  test('un export d’avant le module d’achats garde les achats en place', () => {
    expect(reimport(['shopping'])?.shopping).toBeNull()
  })
})
