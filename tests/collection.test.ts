/**
 * La garde du serveur contre l'écrasement (`server/collection.ts`) : un appareil qui envoie une
 * collection partie d'une version dépassée est refusé (409), et la version du serveur reste telle
 * quelle ; sans session, ou d'un autre site, rien ne passe. Une erreur ici écraserait les commandes
 * d'un autre appareil. Le serveur entier (`createApp`), sur des bases neuves dans le dossier
 * temporaire de `setup.ts`, avec le compte créé comme à la première visite et un premier envoi ;
 * chaque test essaie ensuite de l'écraser, dans n'importe quel ordre.
 */

import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { emptyShopping } from '@/lib/orders'
import type { SyncDocument } from '@/lib/sync'
import type { CollectionResponse, CollectionSaved } from '@/types'
import { createApp } from '../server/app'
import { createAuth } from '../server/auth'
import { DATA_DIR, openApp, openData } from '../server/db'
import { card, collectionWith, order, ownership } from './fixtures'

// Jamais `.data` : sans `setup.ts` (`bun test` lancé hors du projet), rien n'est ouvert.
if (!DATA_DIR.startsWith(tmpdir())) throw new Error(`DATA_DIR n’est pas temporaire : ${DATA_DIR}`)

// Le journal du serveur (une ligne par évènement) : muet pendant ces tests.
const log = spyOn(console, 'log').mockImplementation(() => {})

const data = openData()
const app = openApp()
const server = createApp({ data, app, accounts: await createAuth(app) })
const ORIGIN = process.env.BETTER_AUTH_URL!

// Les bases fermées, pour que `setup.ts` retire leur dossier. Better Auth prépare ses requêtes sans
// les libérer : la base ne lâche son fichier qu'une fois elles ramassées (Windows refuserait sinon
// de le retirer).
afterAll(() => {
  log.mockRestore()
  app.close()
  data.close()
  Bun.gc(true)
})

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

/** La version enregistrée sur le serveur. */
const stored = async () => (await (await collection('GET')).json()) as CollectionResponse

/** Le document d'un appareil : une carte possédée, payée 30 €. */
const first: SyncDocument = {
  collection: {
    ...collectionWith({ a: ownership('owned', { paidPrice: 30 }) }),
    customCards: { a: card('a', [25]) },
  },
  shopping: emptyShopping(),
}

/** Celui d'un autre appareil, parti de la même version : une commande. */
const second: SyncDocument = {
  collection: collectionWith(),
  shopping: { ...emptyShopping(), orders: [order()] },
}

/** Le premier envoi, parti de la version 0 (le serveur n'a encore rien). */
const saved = await collection('PUT', { baseVersion: 0, ...first })

describe('/api/collection : jamais une version écrasée', () => {
  test('le compte créé, parti de la version 0 : enregistré, version 1', async () => {
    expect(signUp.status).toBe(200)
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({ version: 1 } satisfies CollectionSaved)
    expect(await stored()).toEqual({ version: 1, ...first } satisfies CollectionResponse)
  })

  test('un autre appareil, parti lui aussi de la version 0 : 409, la version 1 reste', async () => {
    const response = await collection('PUT', { baseVersion: 0, ...second })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual({ version: 1, ...first } satisfies CollectionResponse)
  })

  test('un appareil qui a déjà la version 1 : 304, sans corps', async () => {
    const response = await collection('GET', undefined, { 'If-None-Match': '"v1"' })
    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
  })

  test('envoyé d’un autre site (le cookie part avec toute requête vers le site) : 403', async () => {
    const response = await collection(
      'PUT',
      { baseVersion: 1, ...second },
      { Origin: 'https://autre.exemple' },
    )
    expect(response.status).toBe(403)
    expect(await stored()).toEqual({ version: 1, ...first } satisfies CollectionResponse)
  })

  test('sans session : 401, en lecture comme en écriture', async () => {
    const noCookie = { Cookie: '' }
    expect((await collection('GET', undefined, noCookie)).status).toBe(401)
    expect((await collection('PUT', { baseVersion: 1, ...second }, noCookie)).status).toBe(401)
    expect(await stored()).toEqual({ version: 1, ...first } satisfies CollectionResponse)
  })
})
