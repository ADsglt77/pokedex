/**
 * La synchronisation entre appareils : une erreur y écraserait des commandes et un budget (ceux
 * d'un autre appareil), ou les perdrait. Jamais d'écrasement sans choix de l'utilisateur.
 */

import { describe, expect, test } from 'bun:test'
import { emptyCollection } from '@/lib/collection'
import { decide, documentHash, isEmptyDocument } from '@/lib/sync'
import { emptyShopping } from '@/lib/wishlist'

const local = (hash: string, empty = false) => ({ hash, empty })

describe('decide', () => {
  test('serveur vide : le premier appareil envoie la sienne, sauf vide', () => {
    expect(decide(local('a'), null, { version: 0, hash: null, empty: true })).toBe('push')
    expect(decide(local('a', true), null, { version: 0, hash: null, empty: true })).toBe('noop')
  })

  test('première connexion de cet appareil', () => {
    // Vide ici : il reçoit celle du serveur.
    expect(decide(local('vide', true), null, { version: 3, hash: 's', empty: false })).toBe('adopt')
    // La même des deux côtés : il note la version.
    expect(decide(local('s'), null, { version: 3, hash: 's', empty: false })).toBe('adopt')
    // Deux collections différentes : l'utilisateur choisit, rien n'est écrasé.
    expect(decide(local('a'), null, { version: 3, hash: 's', empty: false })).toBe('conflict')
    // Rien à perdre sur le serveur (une collection effacée) : il envoie la sienne.
    expect(decide(local('a'), null, { version: 3, hash: 'vide', empty: true })).toBe('push')
  })

  test('seul cet appareil a changé : il envoie', () => {
    expect(
      decide(local('a2'), { version: 3, hash: 'a1' }, { version: 3, hash: 'a1', empty: false }),
    ).toBe('push')
  })

  test('seul le serveur a changé : cet appareil la reprend', () => {
    expect(
      decide(local('a1'), { version: 3, hash: 'a1' }, { version: 4, hash: 'b', empty: false }),
    ).toBe('adopt')
  })

  test('les deux ont changé : conflit, jamais d’écrasement', () => {
    expect(
      decide(local('a2'), { version: 3, hash: 'a1' }, { version: 4, hash: 'b', empty: false }),
    ).toBe('conflict')
  })

  test('les deux ont fait la même modification : il note la version', () => {
    expect(
      decide(local('b'), { version: 3, hash: 'a1' }, { version: 4, hash: 'b', empty: false }),
    ).toBe('adopt')
  })

  test('rien n’a changé', () => {
    expect(
      decide(local('a1'), { version: 3, hash: 'a1' }, { version: 3, hash: 'a1', empty: false }),
    ).toBe('noop')
  })

  test('cet appareil vidé (« Effacer ») après la dernière synchronisation : il envoie', () => {
    expect(
      decide(
        local('vide', true),
        { version: 3, hash: 'a1' },
        { version: 3, hash: 'a1', empty: false },
      ),
    ).toBe('push')
  })
})

describe('documentHash', () => {
  test('même contenu, même empreinte ; une carte de plus, une autre', async () => {
    const empty = { collection: emptyCollection(), shopping: emptyShopping() }
    const copy = JSON.parse(JSON.stringify(empty))
    const owned = { status: 'owned', updatedAt: '2026-10-14', acquiredAt: '2026-10-14' } as const
    const changed = { ...empty, collection: { ...empty.collection, cards: { x: owned } } }
    expect(await documentHash(copy)).toBe(await documentHash(empty))
    expect(await documentHash(changed)).not.toBe(await documentHash(empty))
    expect(isEmptyDocument(empty)).toBe(true)
    expect(isEmptyDocument(changed)).toBe(false)
  })
})
