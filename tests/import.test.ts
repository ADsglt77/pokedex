/**
 * L'import d'un export, et le document qu'un appareil envoie au serveur (mêmes contrôles) : un
 * fichier retouché qui fausserait le budget est refusé. Ses favorites : complétées à la lecture
 * (un document d'avant les favorites s'importe), refusées si elles ne sont pas une carte de leur
 * Pokémon, sans jamais planter la lecture.
 */

import { describe, expect, test } from 'bun:test'
import { applyOrder, emptyShopping } from '@/lib/orders'
import { buildExportFile, documentProblem, isDay, readImport, readSent } from '@/lib/transfer'
import type { CollectionData, ShoppingData } from '@/types'
import { card, collectionWith, line, NOW, order, ownership, withCards } from './fixtures'

const collection: CollectionData = withCards(
  collectionWith({
    a: ownership('ordered', { paidPrice: 17 }),
    b: ownership('owned', { acquiredAt: NOW }),
  }),
  card('a', [25]),
)

const shopping: ShoppingData = {
  ...emptyShopping(),
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
}

/** L'export de `data`, retouché comme à la main (`value` mise à `path`, ou retirée), puis relu. */
function reread(path: (string | number)[] = [], value?: unknown, data = { collection, shopping }) {
  const file = JSON.parse(JSON.stringify(buildExportFile(data.collection, data.shopping)))
  if (path.length) {
    const parent = path.slice(0, -1).reduce((node, key) => node[key], file)
    if (value === undefined) delete parent[path.at(-1)!]
    else parent[path.at(-1)!] = value
  }
  return readImport(JSON.stringify(file))
}

/** Le document relu ; `null` si l'import est refusé. */
const reimport = (...args: Parameters<typeof reread>) => reread(...args).document

const ORDER = ['shopping', 'orders', 0]

// Trois cartes de trois Pokémon, dont `b`, la deuxième carte du 25 (et la carte du 4).
const several = {
  collection: withCards(
    collectionWith({ a: ownership('owned', { acquiredAt: NOW }), b: ownership('ordered') }),
    card('a', [25]),
    card('b', [25, 4]),
    card('c', [7]),
  ),
  shopping,
}
const FAVORITES = ['collection', 'favorites']

describe('import', () => {
  test('un export de l’app se réimporte tel quel', () => {
    expect(reimport()).toEqual({ collection, shopping })
  })

  test('un statut inconnu est refusé', () => {
    const lost = { status: 'lost', updatedAt: NOW, acquiredAt: null }
    expect(reimport(['collection', 'cards', 'c'], lost)).toBeNull()
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

  test('une année tapée en deux chiffres (« 05/10/26 » : l’an 26) est refusée, comme au formulaire', () => {
    // `isDay` est aussi le contrôle du formulaire de commande : il refuse ce que le serveur refuse.
    expect(isDay('0026-10-05')).toBe(false)
    expect(isDay('2026-10-05')).toBe(true)
    expect(reimport([...ORDER, 'date'], '0026-10-05')).toBeNull()
    expect(reimport([...ORDER, 'receivedAt'], '0026-10-05')).toBeNull()
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

  test('une carte sans clé `image` est refusée : « Modifier la carte » planterait', () => {
    expect(reimport(['collection', 'customCards', 'a', 'image'])).toBeNull()
  })

  test('un id Cardmarket nul, négatif, décimal, en texte ou trop long est refusé', () => {
    const cardmarket = ['collection', 'customCards', 'a', 'cardmarket']
    expect(reimport(cardmarket, 0)).toBeNull()
    expect(reimport(cardmarket, -5)).toBeNull()
    expect(reimport(cardmarket, 2.5)).toBeNull()
    expect(reimport(cardmarket, '812345')).toBeNull()
    expect(reimport(cardmarket, 1234567890123)).toBeNull()
    expect(reimport(cardmarket, 812345)).not.toBeNull()
  })

  test('une carte sans Pokémon, ou rangée sous un autre id que le sien, est refusée', () => {
    expect(reimport(['collection', 'customCards', 'a', 'dexIds'], [])).toBeNull()
    // Un numéro hors du Pokédex : la carte serait invisible, mais comptée.
    expect(reimport(['collection', 'customCards', 'a', 'dexIds'], [0])).toBeNull()
    expect(reimport(['collection', 'customCards', 'a', 'dexIds'], [1026])).toBeNull()
    // La favorite de la carte suit son Pokémon : `a` n'est plus une carte du 25.
    const last = withCards(collection, card('a', [1025]))
    expect(reimport([], undefined, { collection: last, shopping })).not.toBeNull()
    expect(reimport(['collection', 'customCards', 'a', 'id'], 'b')).toBeNull()
  })

  test('la langue d’une carte : absente (japonaise) ou « fr » ; « ja » et le reste, refusés', () => {
    const language = ['collection', 'customCards', 'a', 'language']
    // Un export d'avant les cartes françaises, sans le champ : japonaises, importées telles quelles.
    expect(reimport()?.collection.customCards.a).toEqual(card('a', [25]))
    expect(reimport(language, 'fr')?.collection.customCards.a?.language).toBe('fr')
    // Le japonais n'a qu'une écriture, l'absence : « ja » donnerait deux cartes d'une même langue.
    expect(reimport(language, 'ja')).toBeNull()
    expect(reimport(language, 'de')).toBeNull()
    expect(reimport(language, 'FR')).toBeNull()
    expect(reimport(language, 2)).toBeNull()
    expect(reimport(language, null)).toBeNull()
  })

  test('une commande avec deux lignes d’une même carte est refusée', () => {
    expect(reimport([...ORDER, 'lines'], [line('a', 12), line('a', 3)])).toBeNull()
    expect(reimport([...ORDER, 'lines'], [line('a', 12), line('b', 3)])).not.toBeNull()
  })

  test('un fichier sans achats est refusé', () => {
    expect(reimport(['shopping'])).toBeNull()
  })

  test('un export d’avant les favorites s’importe : chaque Pokémon a pour favorite sa première carte', () => {
    const read = reimport(FAVORITES, undefined, several)
    expect(read?.collection.favorites).toEqual({ 25: 'a', 4: 'b', 7: 'c' })
    expect(read?.collection.cards).toEqual(several.collection.cards)
    expect(read?.collection.customCards).toEqual(several.collection.customCards)
  })

  test('une favorite manquante est complétée, celles notées restent', () => {
    const twice = withCards(collectionWith(), card('a', [25]), card('b', [25]), card('c', [7]))
    expect(
      reimport(FAVORITES, { 25: 'b' }, { collection: twice, shopping })?.collection.favorites,
    ).toEqual({
      25: 'b',
      7: 'c',
    })
  })

  test('une favorite qui n’est pas une carte de son Pokémon est refusée', () => {
    // `c` est une carte du 7, `zz` n'existe pas, `x` n'est pas un numéro de Pokémon.
    for (const wrong of [{ 25: 'c' }, { 25: 'zz' }, { x: 'a' }, { 25: 'constructor' }]) {
      const read = reread(FAVORITES, wrong, several)
      expect(read.document).toBeNull()
      expect(read.problem).toContain('favorite')
    }
    expect(reread(FAVORITES, { 25: 'c' }, several).problem).toBe(
      'la carte favorite du Pokémon n° 25 n’est pas une de ses cartes',
    )
    // Une carte de plusieurs Pokémon : favorite de chacun, chacun pour soi.
    expect(reread(FAVORITES, { 25: 'b', 4: 'b' }, several).problem).toBeNull()
  })

  test('une carte abîmée dans un document d’avant est refusée, sans planter la lecture', () => {
    for (const dexIds of ['x', null, 25, { 0: 25 }]) {
      // Pas de `favorites` : il faut les compléter avec une carte abîmée.
      const file = JSON.parse(JSON.stringify(buildExportFile(several.collection, shopping)))
      file.collection.customCards.a.dexIds = dexIds
      delete file.collection.favorites
      const read = readImport(JSON.stringify(file))
      expect(read.document).toBeNull()
      expect(read.problem).toBe('la carte « Carte a » est abîmée')
    }
    // Pas même une carte : jamais d'exception à la lecture.
    for (const broken of [null, 5, 'x', [1]]) {
      const file = JSON.parse(JSON.stringify(buildExportFile(several.collection, shopping)))
      file.collection.customCards.a = broken
      delete file.collection.favorites
      expect(readImport(JSON.stringify(file)).problem).toBe('la carte « a » est abîmée')
    }
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
  const received = (document: object) => readSent(JSON.parse(JSON.stringify(document))).document

  test('un document de l’app est accepté tel quel', () => {
    expect(received({ collection, shopping })).toEqual({ collection, shopping })
  })

  test('une carte française est acceptée ; une langue inconnue, refusée', () => {
    const withLanguage = (language: unknown) => ({
      collection: { ...collection, customCards: { a: { ...card('a', [25]), language } } },
      shopping,
    })
    expect(received(withLanguage('fr'))?.collection.customCards.a?.language).toBe('fr')
    expect(received(withLanguage('ja'))).toBeNull()
    expect(received(withLanguage('de'))).toBeNull()
    expect(readSent(JSON.parse(JSON.stringify(withLanguage('de')))).problem).toBe(
      'la carte « Carte a » est abîmée',
    )
  })

  test('sans achats, il est refusé : ce n’est pas un vieil export', () => {
    expect(received({ collection })).toBeNull()
    expect(received({ shopping })).toBeNull()
  })

  test('il passe les contrôles d’un import', () => {
    const lines = [line('a', 12), line('a', 3)]
    const twice = { ...shopping, orders: [{ ...shopping.orders[0]!, lines }] }
    expect(received({ collection, shopping: twice })).toBeNull()
  })

  test('la règle en cause, dite en clair (le serveur la note, l’appareil la montre)', () => {
    const broken = { ...shopping, orders: [{ ...shopping.orders[0]!, shipping: '5' }] }
    expect(readSent(JSON.parse(JSON.stringify({ collection, shopping: broken })))).toEqual({
      document: null,
      problem: 'la commande « CM-1 » est abîmée',
    })
    expect(documentProblem({ collection, shopping })).toBeNull()
  })
})

describe('quantité d’une ligne', () => {
  // La quantité multiplie le montant : une quantité négative réduirait la dépense du mois, « 2 » en
  // texte ferait « 02 » cartes.
  test('nulle, négative, décimale ou en texte : refusée', () => {
    for (const quantity of [0, -1, 1.5, '2']) {
      expect(reimport([...ORDER, 'lines', 0, 'quantity'], quantity)).toBeNull()
    }
    expect(reimport([...ORDER, 'lines', 0, 'quantity'], 3)).not.toBeNull()
  })

  test('un fichier qui n’est pas du JSON, ou d’un autre genre : refusé, et dit pourquoi', () => {
    expect(readImport('pas du JSON').document).toBeNull()
    expect(readImport(JSON.stringify({ kind: 'autre chose' })).problem).toBe(
      'ce n’est pas un export de collection de ce Pokédex',
    )
  })
})
