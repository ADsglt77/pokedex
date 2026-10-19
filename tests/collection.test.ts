/**
 * La garde du serveur contre l'écrasement (`server/collection.ts`) : un appareil qui envoie une
 * collection partie d'une version dépassée, ou d'un autre document au même numéro (la base
 * restaurée), est refusé (409), et la version du serveur reste telle quelle ; sans session, ou d'un
 * autre site, rien ne passe ; un document abîmé est refusé (400). Une erreur ici écraserait les
 * commandes d'un autre appareil. Chaque compte ne touche qu'à sa collection, et la sienne part avec
 * lui. Et ce que montre le Pokédex public d'un compte (`/api/vitrine/<pseudo>`) : ce qu'il
 * laisserait passer serait public. Le serveur entier (`createApp`), sur des bases neuves dans le
 * dossier temporaire de `setup.ts`, avec un compte créé comme à l'inscription et un premier envoi ;
 * chaque test part de la version du moment, dans n'importe quel ordre.
 */

import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { emptyShopping } from '@/lib/orders'
import type { SyncDocument } from '@/lib/sync'
import type { CollectionResponse, CollectionSaved, VitrineData } from '@/types'
import { createApp } from '../server/app'
import { createAuth } from '../server/auth'
import { card, collectionWith, order, ownership } from './fixtures'
import { testApp } from './server'

// Le journal du serveur (une ligne par évènement) : muet pendant ces tests.
const log = spyOn(console, 'log').mockImplementation(() => {})
afterAll(() => log.mockRestore())

const app = testApp()
const server = createApp({ app, accounts: await createAuth(app) })
const ORIGIN = process.env.BETTER_AUTH_URL!

const PASSWORD = 'mot-de-passe-d-essai'

/** Une action du compte (`/api/auth/…`), du site, avec la session `cookie`. */
const authCall = (path: string, body: unknown, cookie = '') =>
  server.handle(
    new Request(`${ORIGIN}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify(body),
    }),
  )

/**
 * Un compte créé comme à l'inscription (le pseudo deux fois, l'e-mail vide : le serveur en donne
 * une), sa réponse, son id et la session ouverte avec lui.
 */
async function createAccount(pseudo: string) {
  const response = await authCall('sign-up/email', {
    name: pseudo,
    username: pseudo,
    email: '',
    password: PASSWORD,
  })
  const body = (await response.clone().json()) as { user?: { id: string; email: string } }
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ')
  return { response, user: body.user, cookie }
}

const signUp = await createAccount('Sacha')
const cookie = signUp.cookie

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
    expect(signUp.response.status).toBe(200)
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
    const kept = app
      .query('SELECT MIN(version) AS version FROM collection_versions WHERE user_id = ?')
      .get(signUp.user!.id) as { version: number | null }
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

describe('les comptes : chacun le sien', () => {
  test('pas d’e-mail : le serveur en donne une sans boîte, propre au compte', () => {
    expect(signUp.user!.email).toMatch(/^[0-9a-f-]{36}@pokedex\.invalid$/)
  })

  test('un pseudo de deux caractères, oui ; une adresse du site, non', async () => {
    expect((await createAccount('Al')).response.status).toBe(200)
    for (const pseudo of ['A', 'connexion', 'Pokedex', 'api']) {
      expect((await createAccount(pseudo)).response.status).toBe(400)
    }
  })

  test('un pseudo déjà pris, même autrement écrit : refusé, rien de créé', async () => {
    const { response } = await createAccount('SACHA')
    expect(response.status).toBe(400)
    expect(((await response.json()) as { code: string }).code).toBe('USERNAME_IS_ALREADY_TAKEN')
    const count = app.query('SELECT COUNT(*) AS count FROM "user" WHERE username = ?').get('sacha')
    expect(count).toEqual({ count: 1 })
  })

  test('un autre compte ne voit ni ne touche la collection du premier', async () => {
    const before = await stored()
    const ondine = await createAccount('Ondine')
    const asOndine = { Cookie: ondine.cookie }
    const empty = await collection('GET', undefined, asOndine)
    expect((await empty.json()) as CollectionResponse).toEqual({
      version: 0,
      collection: null,
      shopping: null,
    })
    expect((await collection('PUT', { baseVersion: 0, ...second }, asOndine)).status).toBe(200)
    expect(await stored()).toEqual(before)
    const ondineSees = (await (
      await collection('GET', undefined, asOndine)
    ).json()) as CollectionResponse
    expect(ondineSees).toEqual({ version: 1, ...second })
  })

  test('supprimé avec son mot de passe : son compte, sa collection et son Pokédex public partent', async () => {
    const pierre = await createAccount('Pierre')
    const asPierre = { Cookie: pierre.cookie }
    expect((await collection('PUT', { baseVersion: 0, ...first }, asPierre)).status).toBe(200)
    // Sans mot de passe, ou avec un faux : rien ne part.
    expect((await authCall('delete-user', {}, pierre.cookie)).status).toBe(400)
    expect((await authCall('delete-user', { password: 'faux' }, pierre.cookie)).status).toBe(400)
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/pierre`))).status).toBe(200)

    expect((await authCall('delete-user', { password: PASSWORD }, pierre.cookie)).status).toBe(200)
    const left = (table: string) =>
      app.query(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id = ?`).get(pierre.user!.id)
    expect(left('collections')).toEqual({ count: 0 })
    expect(left('collection_versions')).toEqual({ count: 0 })
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/pierre`))).status).toBe(404)
    expect((await collection('GET', undefined, asPierre)).status).toBe(401)
    // Son pseudo n'est pas repris par un autre : ses liens partagés ne mèneraient plus à lui.
    const { response } = await createAccount('pierre')
    expect(response.status).toBe(400)
    expect(((await response.json()) as { code: string }).code).toBe('USERNAME_IS_ALREADY_TAKEN')
  })

  test('un pseudo quitté n’est jamais repris par un autre compte ; le sien peut le reprendre', async () => {
    const flora = await createAccount('Flora')
    const rename = (to: string) => authCall('update-user', { name: to, username: to }, flora.cookie)
    expect((await rename('Flora-2')).status).toBe(200)
    expect((await createAccount('flora')).response.status).toBe(400)
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/flora`))).status).toBe(404)
    expect((await rename('Flora')).status).toBe(200)
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/flora`))).status).toBe(200)
    // La base le refuse elle-même (deux requêtes ensemble ne passent pas entre le contrôle et
    // l'écriture) : « flora-2 », quitté par Flora, n'est à personne d'autre.
    const take = app.query('UPDATE "user" SET username = ? WHERE id = ?')
    expect(() => take.run('flora-2', signUp.user!.id)).toThrow('pseudo réservé')
  })

  test('changer de pseudo sans fin ne réserve que les 3 derniers', async () => {
    const cynthia = await createAccount('Cynthia')
    for (const to of ['Cynthia-1', 'Cynthia-2', 'Cynthia-3', 'Cynthia-4']) {
      const response = await authCall('update-user', { name: to, username: to }, cynthia.cookie)
      expect(response.status).toBe(200)
    }
    // Quittés : cynthia, -1, -2, -3 ; seuls les 3 derniers restent réservés.
    expect((await createAccount('cynthia-1')).response.status).toBe(400)
    expect((await createAccount('cynthia')).response.status).toBe(200)
  })

  test('envoyé d’un autre site : ni création ni connexion (403)', async () => {
    const from = (path: string, body: unknown) =>
      server.handle(
        new Request(`${ORIGIN}/api/auth/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://autre.exemple' },
          body: JSON.stringify(body),
        }),
      )
    const created = await from('sign-up/email', {
      name: 'Brock',
      username: 'Brock',
      email: '',
      password: PASSWORD,
    })
    expect(created.status).toBe(403)
    expect(app.query('SELECT 1 FROM "user" WHERE username = ?').get('brock')).toBeNull()
    const signedIn = await from('sign-in/username', { username: 'Sacha', password: PASSWORD })
    expect(signedIn.status).toBe(403)
    expect(signedIn.headers.getSetCookie()).toEqual([])
  })
})

describe('/api/vitrine/<pseudo> : ce que voit un visiteur', () => {
  const visit = async (pseudo = 'sacha') => {
    const response = await server.handle(new Request(`${ORIGIN}/api/vitrine/${pseudo}`))
    expect(response.status).toBe(200)
    return (await response.json()) as VitrineData
  }

  test('le Pokédex du pseudo, sans tenir compte des majuscules ; un pseudo à personne : 404', async () => {
    expect((await visit('Sacha')).owner).toBe('Sacha')
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/personne`))).status).toBe(404)
    // L'aperçu d'un lien vers une adresse sans compte (une page du site, `/connexion`) : celui du
    // site, jamais celui d'un compte.
    const preview = await server.handle(new Request(`${ORIGIN}/api/vitrine/connexion/apercu`))
    expect(preview.status).toBe(200)
    expect(await preview.text()).toContain('<title>Mon Pokédex</title>')
    // Un compte qui porterait une adresse du site (créé avant qu'elle ne le devienne) : son
    // Pokédex n'y est jamais montré.
    const misty = await createAccount('Misty')
    app.query('UPDATE "user" SET username = ? WHERE id = ?').run('pokedex', misty.user!.id)
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/pokedex`))).status).toBe(404)
    const hidden = await server.handle(new Request(`${ORIGIN}/api/vitrine/pokedex/apercu`))
    expect(await hidden.text()).toContain('<title>Mon Pokédex</title>')
  })

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

  test('les prix du jour des seules cartes possédées, demandés à l’API des données avec le token', async () => {
    // Une fausse API des données : elle note ce qu'on lui demande, et rend un prix par carte.
    const asked: string[] = []
    const api = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch(request) {
        const url = new URL(request.url)
        asked.push(`${request.headers.get('authorization')} ${url.pathname}${url.search}`)
        const ids = url.searchParams.get('ids')!.split(',')
        return Response.json({
          date: '2026-10-19',
          cards: Object.fromEntries(ids.map((id) => [id, [6.87, 5, 7.2]])),
        })
      },
    })
    const before = process.env.DATA_API_URL
    process.env.DATA_API_URL = api.url.origin
    try {
      expect((await visit()).prices).toEqual({
        date: '2026-10-19',
        cards: { '719445': [6.87, 5, 7.2] },
      })
      expect(asked).toEqual(['Bearer token-d-essai /v1/prices/collection?ids=719445'])
    } finally {
      await api.stop(true)
      process.env.DATA_API_URL = before
    }
    // L'API muette : le Pokédex, sans prix.
    expect((await visit()).prices).toBeNull()
  })
})
