/**
 * La synchronisation entre appareils : une erreur y écraserait des commandes et un budget (ceux
 * d'un autre appareil), ou les perdrait. Jamais d'écrasement sans choix de l'utilisateur.
 */

import { describe, expect, test } from 'bun:test'
import { emptyCollection } from '@/lib/collection'
import { emptyShopping } from '@/lib/orders'
import { decide, documentHash, isEmptyDocument } from '@/lib/sync'
import { collectionWith, ownership } from './fixtures'

const local = (hash: string, empty = false) => ({ hash, empty })

/** Le document d'un nouveau venu, et le même avec une carte possédée. */
const empty = { collection: emptyCollection(), shopping: emptyShopping() }
const withCard = { ...empty, collection: collectionWith({ x: ownership('owned') }) }

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

  test('le serveur revenu à une version plus ancienne (base restaurée) : conflit', () => {
    // Rien n'a changé ici : reprendre sa version perdrait sans rien dire ce qui avait été envoyé.
    expect(
      decide(local('a5'), { version: 5, hash: 'a5' }, { version: 3, hash: 'a3', empty: false }),
    ).toBe('conflict')
    expect(
      decide(local('a6'), { version: 5, hash: 'a5' }, { version: 3, hash: 'a3', empty: false }),
    ).toBe('conflict')
    // La même version des deux côtés : il note simplement la version du serveur.
    expect(
      decide(local('a3'), { version: 5, hash: 'a5' }, { version: 3, hash: 'a3', empty: false }),
    ).toBe('adopt')
  })

  test('le même numéro, mais un autre document (base restaurée, puis un autre appareil revenu à ce numéro) : conflit', () => {
    const base = { version: 45, hash: 'a', tag: 'ta' }
    // Modifiée ici : l'envoyer écraserait ce que l'autre appareil a mis dans cette version.
    expect(decide(local('a2'), base, { version: 45, hash: 'b', tag: 'tb', empty: false })).toBe(
      'conflict',
    )
    // Rien de modifié ici : reprendre celle du serveur perdrait ce qu'il avait reçu avant sa
    // restauration, sans rien dire.
    expect(decide(local('a'), base, { version: 45, hash: 'b', tag: 'tb', empty: false })).toBe(
      'conflict',
    )
    // La même empreinte : la même version, rien de changé.
    expect(decide(local('a'), base, { version: 45, hash: 'a', tag: 'ta', empty: false })).toBe(
      'noop',
    )
    // Une version notée sans empreinte, au même contenu : il note celle du serveur.
    expect(
      decide(
        local('a'),
        { version: 45, hash: 'a' },
        { version: 45, hash: 'a', tag: 'ta', empty: false },
      ),
    ).toBe('adopt')
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
    const copy = JSON.parse(JSON.stringify(empty))
    expect(await documentHash(copy)).toBe(await documentHash(empty))
    expect(await documentHash(withCard)).not.toBe(await documentHash(empty))
  })
})

describe('isEmptyDocument', () => {
  test('vide : aucune carte, le budget par défaut ; une carte est à garder', () => {
    expect(isEmptyDocument(empty)).toBe(true)
    expect(isEmptyDocument(withCard)).toBe(false)
  })

  test('un budget réglé est à garder : le document n’est pas vide', () => {
    const budget = { ...empty.shopping.budget, monthly: 60 }
    const tuned = { ...empty, shopping: { ...empty.shopping, budget } }
    expect(isEmptyDocument(tuned)).toBe(false)
    // Première connexion d'un appareil dont seul le budget a changé : il ne reprend pas celui du
    // serveur sans rien dire.
    expect(
      decide({ hash: 'budget', empty: isEmptyDocument(tuned) }, null, {
        version: 3,
        hash: 's',
        empty: false,
      }),
    ).toBe('conflict')
  })
})
