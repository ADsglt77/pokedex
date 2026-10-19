/**
 * La garde du serveur contre l'écrasement (`server/collection.ts`) : un appareil qui envoie une
 * collection partie d'une version dépassée, ou d'un autre document au même numéro (la base
 * restaurée), est refusé (409), et la version du serveur reste telle quelle ; sans session, ou d'un
 * autre site, rien ne passe ; un document abîmé est refusé (400). Une erreur ici écraserait les
 * commandes d'un autre appareil. Et ce que montre le Pokédex public (`/api/vitrine`) : ce qu'il
 * laisserait passer serait public. Le serveur entier (`createApp`), sur des bases neuves dans le
 * dossier temporaire de `setup.ts`, avec le compte créé comme à la première visite et un premier
 * envoi ; chaque test part de la version du moment, dans n'importe quel ordre.
 */

import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { emptyShopping } from '@/lib/orders'
import type { SyncDocument } from '@/lib/sync'
import type { CollectionResponse, CollectionSaved, VitrineData } from '@/types'
import { createApp } from '../server/app'
import { createAuth } from '../server/auth'
import { card, collectionWith, order, ownership } from './fixtures'
import { testBases } from './server'

// Le journal du serveur (une ligne par évènement) : muet pendant ces tests.
const log = spyOn(console, 'log').mockImplementation(() => {})
afterAll(() => log.mockRestore())

const { data, app } = testBases()
const server = createApp({ data, app, accounts: await createAuth(app) })
const ORIGIN = process.env.BETTER_AUTH_URL!

const signUp = await server.handle(
  new Request(`${ORIGIN}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      email: process.env.ACCOUNT_EMAIL,
      password: 'mot-de-passe-d-essai',
      name: 'Sacha',
    }),
  }),
)
/** La session ouverte à la création du compte. */
const cookie = signUp.headers
  .getSetCookie()
  .map((line) => line.split(';')[0])
  .join('; ')

/** `/api/collection`, du site et avec la session ; `headers` s'y ajoute ou les remplace. */
const collection = (method: 'GET' | 'PUT', body?: unknown, headers: Record<string, string> = {}) =>
  server.handle(
    new Request(`${ORIGIN}/api/collection`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )

/** La version enregistrée sur le serveur, et son ETag (`"v<version>-<empreinte>"`). */
async function stored() {
  const response = await collection('GET')
  const etag = response.headers.get('ETag')!
  return {
    body: (await response.json()) as CollectionResponse,
    etag,
    tag: etag.split('-')[1]!.slice(0, -1),
  }
}

/**
 * Le document d'un appareil : une carte possédée, payée 30 €, reliée à Cardmarket ; une autre
 * choisie, pas encore achetée.
 */
const first: SyncDocument = {
  collection: {
    ...collectionWith({ a: ownership('owned', { paidPrice: 30 }) }),
    customCards: {
      a: card('a', [25], { cardmarket: 719445 }),
      b: card('b', [4], { cardmarket: 719621 }),
    },
  },
  shopping: emptyShopping(),
}

/** Celui d'un autre appareil, parti de la même version : une commande. */
const second: SyncDocument = {
  collection: collectionWith(),
  shopping: { ...emptyShopping(), orders: [order()] },
}

/** Le premier envoi, parti de la version 0 (le serveur n'a encore rien), et ce qu'il a enregistré. */
const saved = await collection('PUT', { baseVersion: 0, ...first })
const savedBody = (await saved.json()) as CollectionSaved
const afterFirst = await stored()

describe('/api/collection : jamais une version écrasée', () => {
  test('le compte créé, parti de la version 0 : enregistré, version 1, avec son empreinte', () => {
    expect(signUp.status).toBe(200)
    expect(saved.status).toBe(200)
    expect(savedBody).toEqual({ version: 1, tag: afterFirst.tag })
    expect(afterFirst.body).toEqual({ version: 1, ...first } satisfies CollectionResponse)
    expect(afterFirst.etag).toBe(`"v1-${afterFirst.tag}"`)
  })

  test('un autre appareil, parti de la version 0 : 409, la version du serveur reste', async () => {
    const before = await stored()
    const response = await collection('PUT', { baseVersion: 0, ...second })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual(before)
  })

  test('un appareil qui a déjà la version : 304, sans corps', async () => {
    const { etag } = await stored()
    const response = await collection('GET', undefined, { 'If-None-Match': etag })
    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
  })

  test('une mise à jour partie de la version du serveur : enregistrée, la suivante partie d’avant refusée', async () => {
    const before = await stored()
    const next: SyncDocument = { ...first, shopping: { ...emptyShopping(), orders: [order()] } }
    const response = await collection('PUT', {
      baseVersion: before.body.version,
      baseTag: before.tag,
      ...next,
    })
    expect(response.status).toBe(200)
    const after = await stored()
    expect(after.body).toEqual({ version: before.body.version + 1, ...next })
    expect((await response.json()) as CollectionSaved).toEqual({
      version: before.body.version + 1,
      tag: after.tag,
    })
    // Un appareil encore à la version d'avant : 409, la nouvelle reste.
    const stale = await collection('PUT', { baseVersion: before.body.version, ...second })
    expect(stale.status).toBe(409)
    expect(await stored()).toEqual(after)
    // La version remplacée est gardée (une par heure au plus), pour revenir en arrière à la main.
    const kept = app.query('SELECT MIN(version) AS version FROM collection_versions').get() as {
      version: number | null
    }
    expect(kept.version).not.toBeNull()
    expect(kept.version!).toBeLessThan(after.body.version)
  })

  test('le même numéro, mais un autre document (la base restaurée) : 409', async () => {
    const before = await stored()
    const response = await collection('PUT', {
      baseVersion: before.body.version,
      baseTag: 'autre',
      ...second,
    })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual(before)
  })

  test('une version en avance sur le serveur (une base restaurée plus ancienne) : 409', async () => {
    const before = await stored()
    const response = await collection('PUT', { baseVersion: before.body.version + 5, ...second })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual(before)
  })

  test('un document abîmé : 400, rien d’écrit', async () => {
    const before = await stored()
    const broken = {
      ...first,
      collection: { ...first.collection, customCards: { a: { ...card('a', [25]), id: 'z' } } },
    }
    const response = await collection('PUT', { baseVersion: before.body.version, ...broken })
    expect(response.status).toBe(400)
    expect(await stored()).toEqual(before)
  })

  test('envoyé d’un autre site (le cookie part avec toute requête vers le site) : 403', async () => {
    const before = await stored()
    const response = await collection(
      'PUT',
      { baseVersion: before.body.version, ...second },
      { Origin: 'https://autre.exemple' },
    )
    expect(response.status).toBe(403)
    // Refusé avant d'être lu : un corps invalide aussi (pas de 422 qui renverrait l'envoi).
    const invalid = await collection('PUT', {}, { Origin: 'https://autre.exemple' })
    expect(invalid.status).toBe(403)
    expect(await invalid.text()).toBe('')
    expect(await stored()).toEqual(before)
  })

  test('sans session : 401, en lecture comme en écriture', async () => {
    const before = await stored()
    const noCookie = { Cookie: '' }
    expect((await collection('GET', undefined, noCookie)).status).toBe(401)
    expect(
      (await collection('PUT', { baseVersion: before.body.version, ...second }, noCookie)).status,
    ).toBe(401)
    expect(await stored()).toEqual(before)
  })
})

describe('/api/vitrine : ce que voit un visiteur', () => {
  const visit = async () => {
    const response = await server.handle(new Request(`${ORIGIN}/api/vitrine`))
    expect(response.status).toBe(200)
    return (await response.json()) as VitrineData
  }

  test('sans session : les cartes, jamais un prix payé, une commande ni un statut « commandée »', async () => {
    const shown = await visit()
    const text = JSON.stringify(shown)
    expect(text).not.toContain('paidPrice')
    expect(text).not.toContain('orders')
    expect(text).not.toContain('shopping')
    expect(text).not.toContain('ordered')
    expect(shown.owner).toBe('Sacha')
    expect(Object.keys(shown.collection.customCards).sort()).toEqual(['a', 'b'])
    expect(Object.keys(shown.collection.cards)).toEqual(['a'])
  })

  test('les prix du jour des seules cartes possédées', async () => {
    const { prices } = await visit()
    // Sans guide des prix lu (selon l'ordre des fichiers de test), aucun prix.
    if (prices) expect(Object.keys(prices.cards)).toEqual(['719445'])
  })
})
