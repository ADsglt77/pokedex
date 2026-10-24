/**
 * La garde du serveur contre l'écrasement (`server/collection.ts`) : un appareil qui envoie une
 * collection partie d'une version dépassée (un autre onglet, un autre appareil l'a changée), ou en
 * avance (la base restaurée), est refusé (409), et la version du serveur reste telle quelle ; sans
 * session rien ne passe, ni d'un autre site (une modification, sur toute adresse, avant même la
 * lecture de son corps ; une lecture, si) ; un document abîmé est refusé (400). Une erreur ici écraserait les
 * commandes d'un autre appareil. La lecture dit à quel compte est la collection, et seulement sa
 * version quand l'appareil a déjà celle-là (`?version=`) ; un envoi compressé (`gzip`, celui du
 * site) est enregistré, aussi derrière un vrai `Bun.serve`, mais refusé (413) au-delà de 5 000 000
 * octets décompressés, sans jamais décompresser plus ; sans session, 401 sans rien décompresser
 * (le cookie renouvelé d'une session repart toujours) ; une panne en lisant la session, 500 (pas
 * le 400 d'un document refusé) ; un envoi renvoyé tel quel après une réponse perdue est reconnu (200, la même
 * version), un autre parti de la même version reste refusé (409). Chaque compte ne touche qu'à sa
 * collection, et la sienne part avec lui. Et ce que montre le Pokédex public d'un compte (`/api/vitrine/<pseudo>`) : ce qu'il
 * laisserait passer serait public. Le serveur entier (`createApp`), sur des bases neuves dans le
 * dossier temporaire de `setup.ts`, avec un compte créé comme à l'inscription et un premier envoi ;
 * chaque test part de la version du moment, dans n'importe quel ordre.
 */

import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { emptyShopping } from '@/lib/orders'
import { DAY } from '@/lib/time'
import {
  MAX_DOCUMENT,
  type CollectionDocument,
  type CollectionResponse,
  type CollectionSaved,
  type VitrineData,
} from '@/types'
import { card, collectionWith, NOW, order, ownership, withCards } from './fixtures'
import { openServer, ORIGIN, PASSWORD } from './server'

// Le journal du serveur (une ligne par évènement) : muet pendant ces tests.
const log = spyOn(console, 'log').mockImplementation(() => {})
afterAll(() => log.mockRestore())

const { app, accounts, server, authCall, createAccount } = await openServer()

const signUp = await createAccount('Sacha')
const cookie = signUp.cookie
const sacha = signUp.user!.id

/** `/api/collection`, du site et avec la session ; `headers` s'y ajoute ou les remplace. */
const collection = (method: 'GET' | 'PUT', body?: unknown, headers: Record<string, string> = {}) =>
  server.handle(
    new Request(`${ORIGIN}/api/collection`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )

/**
 * `PUT /api/collection` comme l'envoie le site : compressé (`Content-Encoding: gzip`) ; `headers`
 * s'y ajoute ou les remplace.
 */
const gzipped = (body: RequestInit['body'], headers: Record<string, string> = {}) =>
  server.handle(
    new Request(`${ORIGIN}/api/collection`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        Origin: ORIGIN,
        Cookie: cookie,
        ...headers,
      },
      body,
    }),
  )

/** La version enregistrée sur le serveur. */
async function stored() {
  const response = await collection('GET')
  return { body: (await response.json()) as CollectionResponse }
}

/** Le nombre de versions remplacées gardées pour le compte de Sacha. */
const keptVersions = () =>
  (
    app.query('SELECT COUNT(*) AS count FROM collection_versions WHERE user_id = ?').get(sacha) as {
      count: number
    }
  ).count

/**
 * Le document d'un appareil : une carte possédée, payée 30 €, reliée à Cardmarket ; une autre
 * choisie, pas encore achetée.
 */
const first: CollectionDocument = {
  collection: withCards(
    collectionWith({ a: ownership('owned', { paidPrice: 30 }) }),
    card('a', [25], { cardmarket: 719445 }),
    card('b', [4], { cardmarket: 719621 }),
  ),
  shopping: emptyShopping(),
}

/** Celui d'un autre appareil, parti de la même version : une commande. */
const second: CollectionDocument = {
  collection: collectionWith(),
  shopping: { ...emptyShopping(), orders: [order()] },
}

/** Le premier envoi, parti de la version 0 (le serveur n'a encore rien), et ce qu'il a enregistré. */
const saved = await collection('PUT', { account: sacha, baseVersion: 0, ...first })
const savedBody = (await saved.json()) as CollectionSaved
const afterFirst = await stored()

describe('/api/collection : jamais une version écrasée', () => {
  test('le compte créé, parti de la version 0 : enregistré, version 1', () => {
    expect(signUp.response.status).toBe(200)
    expect(saved.status).toBe(200)
    expect(savedBody).toEqual({ version: 1 })
    // La lecture dit à quel compte est la collection : l'appareil ne prend jamais celle d'un autre.
    expect(afterFirst.body).toEqual({
      version: 1,
      account: sacha,
      ...first,
    } satisfies CollectionResponse)
  })

  test('un autre appareil, parti de la version 0 : 409, la version du serveur reste', async () => {
    const before = await stored()
    const response = await collection('PUT', { account: sacha, baseVersion: 0, ...second })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual(before)
  })

  test('une mise à jour partie de la version du serveur : enregistrée, la suivante partie d’avant refusée', async () => {
    const before = await stored()
    const next: CollectionDocument = {
      ...first,
      shopping: { ...emptyShopping(), orders: [order()] },
    }
    const response = await collection('PUT', {
      account: sacha,
      baseVersion: before.body.version,
      ...next,
    })
    expect(response.status).toBe(200)
    const after = await stored()
    expect(after.body).toEqual({ version: before.body.version + 1, account: sacha, ...next })
    expect((await response.json()) as CollectionSaved).toEqual({
      version: before.body.version + 1,
    })
    // Un appareil encore à la version d'avant : 409, la nouvelle reste.
    const stale = await collection('PUT', {
      account: sacha,
      baseVersion: before.body.version,
      ...second,
    })
    expect(stale.status).toBe(409)
    expect(await stored()).toEqual(after)
    // La version remplacée est gardée (une par heure au plus), pour revenir en arrière à la main.
    const kept = app
      .query('SELECT MIN(version) AS version FROM collection_versions WHERE user_id = ?')
      .get(signUp.user!.id) as { version: number | null }
    expect(kept.version).not.toBeNull()
    expect(kept.version!).toBeLessThan(after.body.version)
  })

  test('une version en avance sur le serveur (une base restaurée plus ancienne) : 409', async () => {
    const before = await stored()
    const response = await collection('PUT', {
      account: sacha,
      baseVersion: before.body.version + 5,
      ...second,
    })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual(before)
  })

  test('un document abîmé : 400, rien d’écrit', async () => {
    const before = await stored()
    const broken = {
      ...first,
      collection: { ...first.collection, customCards: { a: { ...card('a', [25]), id: 'z' } } },
    }
    const response = await collection('PUT', {
      account: sacha,
      baseVersion: before.body.version,
      ...broken,
    })
    expect(response.status).toBe(400)
    expect(await stored()).toEqual(before)
  })

  test('un document enregistré avant les collections d’extensions (sans `series`) : le suivant est enregistré, et journalisé', async () => {
    // Écrit directement, comme avant cette livraison : il n'a pas de clé `series`.
    const old = await createAccount('Veteran')
    const before = JSON.stringify({
      ...withCards(collectionWith({ a: ownership('owned') }), card('a', [25])),
      series: undefined,
    })
    expect(before).not.toContain('series')
    app
      .query(
        'INSERT INTO collections (user_id, version, collection, shopping, updated_at) VALUES (?, 1, ?, ?, ?)',
      )
      .run(old.user!.id, before, JSON.stringify(emptyShopping()), NOW)
    // Il commence une collection : le journal la compare à celle d'avant, qui n'en a pas.
    const next: CollectionDocument = {
      collection: {
        ...withCards(
          collectionWith({ a: ownership('owned') }),
          card('a', [25]),
          card('s', [4], { seriesOnly: true }),
        ),
        series: [{ set: 'SV2A', name: 'Pokémon Card 151', startedAt: NOW, cards: ['a', 's'] }],
      },
      shopping: emptyShopping(),
    }
    log.mockClear()
    const response = await collection(
      'PUT',
      { account: old.user!.id, baseVersion: 1, ...next },
      { Cookie: old.cookie },
    )
    expect(response.status).toBe(200)
    expect((await response.json()) as CollectionSaved).toEqual({ version: 2 })
    expect(log.mock.calls.flat().join(' ')).toContain('Collection commencée')
  })

  test('envoyé d’un autre site (le cookie part avec toute requête vers le site) : 403', async () => {
    const before = await stored()
    const response = await collection(
      'PUT',
      { account: sacha, baseVersion: before.body.version, ...second },
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
      (
        await collection(
          'PUT',
          { account: sacha, baseVersion: before.body.version, ...second },
          noCookie,
        )
      ).status,
    ).toBe(401)
    expect(await stored()).toEqual(before)
  })
})

describe('/api/collection : lue depuis sa version, envoyée compressée, renvoyée après une réponse perdue', () => {
  /** La lecture d'un appareil qui a déjà la version `version` (`?version=`). */
  const readFrom = (version: number | string) =>
    server.handle(
      new Request(`${ORIGIN}/api/collection?version=${version}`, { headers: { Cookie: cookie } }),
    )

  test('l’appareil a déjà la version du serveur : la version et le compte seuls, sans le document', async () => {
    const { body } = await stored()
    const same = await readFrom(body.version)
    expect(same.status).toBe(200)
    expect(same.headers.get('cache-control')).toBe('no-store')
    expect(await same.json()).toEqual({ version: body.version, account: sacha })
    // Une autre version : le document entier.
    expect(await (await readFrom(body.version - 1)).json()).toEqual(body)
    // Une version qui n'en est pas une : refusée par le schéma, sans document.
    expect((await readFrom('abc')).status).toBe(422)
  })

  test('compressée (`Content-Encoding: gzip`, comme l’envoie le site) : enregistrée comme une autre', async () => {
    const before = await stored()
    const next: CollectionDocument = {
      ...first,
      shopping: { ...emptyShopping(), orders: [order({ id: 'compressée' })] },
    }
    const sent = { account: sacha, baseVersion: before.body.version, ...next }
    const response = await gzipped(Bun.gzipSync(JSON.stringify(sent)))
    expect(response.status).toBe(200)
    expect((await response.json()) as CollectionSaved).toEqual({
      version: before.body.version + 1,
    })
    expect((await stored()).body).toEqual({
      version: before.body.version + 1,
      account: sacha,
      ...next,
    })
    // Illisible une fois décompressée, ou pas du gzip : 400, rien d'écrit.
    const after = await stored()
    expect((await gzipped(Bun.gzipSync('{"account":'))).status).toBe(400)
    expect((await gzipped(JSON.stringify(sent))).status).toBe(400)
    expect(await stored()).toEqual(after)
  })

  /** Ce que le serveur décompresse pendant `run` : le nombre de `DecompressionStream` créés. */
  async function decompressions(run: () => Promise<unknown>) {
    const Original = globalThis.DecompressionStream
    let count = 0
    class Counted extends Original {
      constructor(format: ConstructorParameters<typeof DecompressionStream>[0]) {
        super(format)
        count++
      }
    }
    Object.assign(globalThis, { DecompressionStream: Counted })
    try {
      await run()
    } finally {
      Object.assign(globalThis, { DecompressionStream: Original })
    }
    return count
  }

  test('compressée, sans session : 401, sans rien décompresser', async () => {
    const before = await stored()
    // 4 Mo une fois décompressés, dans 4 Ko.
    const heavy = Bun.gzipSync(' '.repeat(4_000_000))
    for (const noSession of ['', 'better-auth.session_token=inconnu']) {
      let status = 0
      const count = await decompressions(async () => {
        status = (await gzipped(heavy, { Cookie: noSession })).status
      })
      expect(status).toBe(401)
      expect(count).toBe(0)
    }
    // Avec la session, le même corps est décompressé (le compteur compte bien) ; des espaces ne
    // sont pas un document : 400.
    expect(await decompressions(() => gzipped(heavy))).toBe(1)
    // Du gzip illisible, sans session : 401, pas 400.
    expect((await gzipped('pas du gzip', { Cookie: '' })).status).toBe(401)
    expect(await stored()).toEqual(before)
  })

  test('la session ne peut pas être lue (une panne passagère) : 500, l’appareil réessaiera', async () => {
    const before = await stored()
    const lookup = spyOn(accounts.auth.api, 'getSession').mockRejectedValueOnce(
      new Error('Base occupée'),
    )
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const sent = { account: sacha, baseVersion: before.body.version, ...second }
      // Pas un 400 : l'appareil dirait « Envoi refusé », et ne réessaierait pas.
      expect((await gzipped(Bun.gzipSync(JSON.stringify(sent)))).status).toBe(500)
    } finally {
      lookup.mockRestore()
      errors.mockRestore()
    }
    expect(await stored()).toEqual(before)
  })

  test('derrière un vrai `Bun.serve` : enregistrée, sans erreur perdue en route', async () => {
    const before = await stored()
    // Une erreur que personne n'attrape (`server.handle` ne passe pas par le serveur HTTP de Bun).
    const lost: unknown[] = []
    const onLost = (error: unknown) => lost.push(error)
    process.on('unhandledRejection', onLost)
    const real = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      maxRequestBodySize: MAX_DOCUMENT,
      fetch: (request) => server.handle(request),
    })
    try {
      const sent = { account: sacha, baseVersion: before.body.version, ...first }
      const response = await fetch(new URL('/api/collection', real.url), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          Origin: ORIGIN,
          Cookie: cookie,
        },
        body: Bun.gzipSync(JSON.stringify(sent)),
      })
      expect(response.status).toBe(200)
      // Une erreur perdue arriverait juste après la réponse.
      await Bun.sleep(100)
    } finally {
      process.off('unhandledRejection', onLost)
      await real.stop(true)
    }
    expect(lost).toEqual([])
  })

  test('une session à renouveler : son cookie renouvelé repart avec la réponse d’un envoi compressé', async () => {
    const owner = await createAccount('Renouveau')
    // Ouverte il y a deux jours : renouvelée à la requête suivante (une fois par jour d'usage). Le
    // contrôle de la session avant la décompression ne doit pas consommer ce renouvellement.
    const twoDaysOld = new Date(Date.now() + 58 * DAY).toISOString()
    app.query('UPDATE session SET expiresAt = ? WHERE userId = ?').run(twoDaysOld, owner.user!.id)
    const sent = { account: owner.user!.id, baseVersion: 0, ...first }
    const response = await gzipped(Bun.gzipSync(JSON.stringify(sent)), { Cookie: owner.cookie })
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().join()).toContain('session_token=')
  })

  test('plus de 5 000 000 octets une fois décompressée : 413, sans décompresser plus', async () => {
    const before = await stored()
    // Une « bombe » : 50 Go une fois décompressée (500 membres gzip de 100 Mo de zéros), 48 Mo
    // compressés. Décompressée en entier, il faudrait des dizaines de secondes, et autant de Go.
    const member = Bun.gzipSync(new Uint8Array(100_000_000))
    const bomb = new Uint8Array(member.length * 500)
    for (let i = 0; i < 500; i++) bomb.set(member, i * member.length)
    const start = performance.now()
    const response = await gzipped(bomb)
    expect(response.status).toBe(413)
    // Arrêtée au plafond : quelques dizaines de millisecondes.
    expect(performance.now() - start).toBeLessThan(2_000)
    expect(await stored()).toEqual(before)
  })

  test('renvoyée telle quelle après une réponse perdue : 200, la version déjà enregistrée, rien de nouveau', async () => {
    const before = await stored()
    const next: CollectionDocument = {
      ...first,
      shopping: { ...emptyShopping(), orders: [order({ id: 'renvoyée' })] },
    }
    const sent = { account: sacha, baseVersion: before.body.version, ...next }
    expect((await collection('PUT', sent)).status).toBe(200)
    const after = await stored()
    const kept = keptVersions()
    // La réponse s'est perdue (délai, réseau coupé) : l'appareil renvoie le même document.
    log.mockClear()
    const again = await collection('PUT', sent)
    expect(again.status).toBe(200)
    expect((await again.json()) as CollectionSaved).toEqual({ version: before.body.version + 1 })
    expect(await stored()).toEqual(after)
    expect(keptVersions()).toBe(kept)
    // Rien au journal : ni un refus, ni une modification de plus.
    expect(log).not.toHaveBeenCalled()
    // Compressée aussi.
    expect((await gzipped(Bun.gzipSync(JSON.stringify(sent)))).status).toBe(200)
    expect(await stored()).toEqual(after)
  })

  test('un autre document parti de la même version : toujours 409, rien d’écrit', async () => {
    const before = await stored()
    const sent = { account: sacha, baseVersion: before.body.version, ...first }
    expect((await collection('PUT', sent)).status).toBe(200)
    const after = await stored()
    const other = await collection('PUT', { ...sent, ...second })
    expect(other.status).toBe(409)
    expect(await stored()).toEqual(after)
    // Le même document, mais de plus loin (deux versions d'écart) : 409 aussi.
    const older = await collection('PUT', { ...sent, baseVersion: before.body.version - 1 })
    expect(older.status).toBe(409)
    expect(await stored()).toEqual(after)
  })
})

describe('d’un autre site : une modification refusée partout, une lecture jamais', () => {
  const FOREIGN = 'https://autre.exemple'

  test('refusée avant la lecture de son corps (403, sans corps, jamais en cache)', async () => {
    // Un corps que le serveur ne lit qu'en le demandant : il ne l'est jamais.
    let read = false
    const body = new ReadableStream(
      {
        pull(controller) {
          read = true
          controller.enqueue(new TextEncoder().encode('{}'))
          controller.close()
        },
      },
      { highWaterMark: 0 },
    )
    const request = new Request(`${ORIGIN}/api/collection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: FOREIGN, Cookie: cookie },
      body,
    })
    const response = await server.handle(request)
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(read).toBe(false)
    expect(request.bodyUsed).toBe(false)
  })

  test('une adresse inconnue aussi : 403, quand le site y aurait un 404', async () => {
    const post = (path: string, origin?: string) =>
      server.handle(
        new Request(`${ORIGIN}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(origin && { Origin: origin }) },
          body: '{}',
        }),
      )
    expect((await post('/api/inconnue', FOREIGN)).status).toBe(403)
    expect((await post('/inconnue', FOREIGN)).status).toBe(403)
    // Sans origine : une modification n'en vient pas du site.
    expect((await post('/api/inconnue')).status).toBe(403)
    expect((await post('/api/inconnue', ORIGIN)).status).toBe(404)
  })

  test('les lectures passent, sans origine ou d’ailleurs : le contrôle de santé, un Pokédex public', async () => {
    const get = (path: string, headers: Record<string, string> = {}) =>
      server.handle(new Request(`${ORIGIN}${path}`, { headers }))
    for (const headers of [{}, { Origin: FOREIGN }] as Record<string, string>[]) {
      const account = await get('/api/account', headers)
      expect(account.status).toBe(200)
      expect(await account.json()).toEqual({ user: null })
      expect((await get('/api/vitrine/sacha', headers)).status).toBe(200)
      expect((await get('/api/collection', { ...headers, Cookie: cookie })).status).toBe(200)
    }
  })
})

describe('les comptes : chacun le sien', () => {
  test('pas d’e-mail : le serveur en donne une sans boîte, propre au compte', () => {
    expect(signUp.user!.email).toMatch(/^[0-9a-f-]{36}@pokedex\.invalid$/)
  })

  test('un pseudo de deux caractères, oui ; une adresse du site, non', async () => {
    expect((await createAccount('Al')).response.status).toBe(200)
    for (const pseudo of ['A', 'connexion', 'Pokedex', 'Collections', 'api']) {
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
      account: ondine.user!.id,
      collection: null,
      shopping: null,
    })
    expect(
      (await collection('PUT', { account: ondine.user!.id, baseVersion: 0, ...second }, asOndine))
        .status,
    ).toBe(200)
    expect(await stored()).toEqual(before)
    const ondineSees = (await (
      await collection('GET', undefined, asOndine)
    ).json()) as CollectionResponse
    expect(ondineSees).toEqual({ version: 1, account: ondine.user!.id, ...second })
  })

  test('parti d’un autre compte (une connexion entre-temps) : 401, rien d’écrit', async () => {
    const before = await stored()
    const misty = await createAccount('Ondine2')
    const asMisty = { Cookie: misty.cookie }
    const response = await collection('PUT', { account: sacha, baseVersion: 0, ...first }, asMisty)
    expect(response.status).toBe(401)
    expect(await stored()).toEqual(before)
    const mistySees = (await (
      await collection('GET', undefined, asMisty)
    ).json()) as CollectionResponse
    expect(mistySees.version).toBe(0)
  })

  test('supprimé avec son mot de passe : son compte, sa collection et son Pokédex public partent', async () => {
    const pierre = await createAccount('Pierre')
    const asPierre = { Cookie: pierre.cookie }
    expect(
      (await collection('PUT', { account: pierre.user!.id, baseVersion: 0, ...first }, asPierre))
        .status,
    ).toBe(200)
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
      // `released_at` est à la milliseconde : deux changements dans la même ne seraient plus
      // rangés (`ORDER BY released_at`), et les 3 gardés tirés au hasard.
      await Bun.sleep(5)
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
    expect(await preview.text()).toContain('<title>PokéCodex</title>')
    // Un compte qui porterait une adresse du site (créé avant qu'elle ne le devienne) : son
    // Pokédex n'y est jamais montré.
    const misty = await createAccount('Misty')
    app.query('UPDATE "user" SET username = ? WHERE id = ?').run('pokedex', misty.user!.id)
    expect((await server.handle(new Request(`${ORIGIN}/api/vitrine/pokedex`))).status).toBe(404)
    const hidden = await server.handle(new Request(`${ORIGIN}/api/vitrine/pokedex/apercu`))
    expect(await hidden.text()).toContain('<title>PokéCodex</title>')
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

  test('un Pokédex enregistré avant les favorites est montré avec la première carte de chaque Pokémon', async () => {
    // Un document d'avant cette livraison, écrit directement : il n'a pas de clé `favorites`.
    const old = await createAccount('Ancien')
    const document = JSON.stringify({
      ...withCards(collectionWith({ a: ownership('owned') }), card('a', [25])),
      favorites: undefined,
    })
    expect(document).not.toContain('favorites')
    app
      .query(
        'INSERT INTO collections (user_id, version, collection, shopping, updated_at) VALUES (?, 1, ?, ?, ?)',
      )
      .run(old.user!.id, document, JSON.stringify(emptyShopping()), NOW)
    expect((await visit('ancien')).collection.favorites).toEqual({ 25: 'a' })
  })

  test('les collections d’extensions sont montrées avec leurs cases, jamais une case commandée comme telle', async () => {
    // Une collection de deux cases : une possédée, une pas encore obtenue mais commandée (payée 12 €).
    const owner = await createAccount('Collectionneur')
    const document = {
      ...withCards(
        collectionWith({
          a: ownership('owned', { paidPrice: 30 }),
          s: ownership('ordered', { paidPrice: 12 }),
        }),
        card('a', [25]),
        card('s', [4], { seriesOnly: true }),
      ),
      series: [{ set: 'SV2A', name: 'Pokémon Card 151', startedAt: NOW, cards: ['a', 's'] }],
    }
    app
      .query(
        'INSERT INTO collections (user_id, version, collection, shopping, updated_at) VALUES (?, 1, ?, ?, ?)',
      )
      .run(owner.user!.id, JSON.stringify(document), JSON.stringify(emptyShopping()), NOW)
    const shown = await visit('collectionneur')
    expect(shown.collection.series).toEqual(document.series)
    expect(shown.collection.customCards.s?.seriesOnly).toBe(true)
    expect(shown.collection.customCards.a).not.toHaveProperty('seriesOnly')
    expect(shown.collection.favorites).toEqual({ 25: 'a' })
    expect(Object.keys(shown.collection.cards)).toEqual(['a'])
    expect(JSON.stringify(shown)).not.toMatch(/ordered|paidPrice/)
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
      expect(asked).toEqual(['Bearer token-d-essai /v1/prices?ids=719445'])
    } finally {
      await api.stop(true)
      process.env.DATA_API_URL = before
    }
    // L'API muette : le Pokédex, sans prix.
    expect((await visit()).prices).toBeNull()
  })

  /** Le compte `pseudo`, qui possède `count` cartes, chacune de son id Cardmarket ; ses cartes. */
  async function accountOwning(pseudo: string, count: number) {
    const owner = await createAccount(pseudo)
    const many = Array.from({ length: count }, (_, index) =>
      card(`c${index}`, [25], { cardmarket: 100_001 + index }),
    )
    const document = withCards(
      collectionWith(Object.fromEntries(many.map(({ id }) => [id, ownership('owned')]))),
      ...many,
    )
    app
      .query(
        'INSERT INTO collections (user_id, version, collection, shopping, updated_at) VALUES (?, 1, ?, ?, ?)',
      )
      .run(owner.user!.id, JSON.stringify(document), JSON.stringify(emptyShopping()), NOW)
    return many
  }

  /**
   * Une fausse API des données, à la place de la vraie jusqu'à `stop` : elle note combien d'ids
   * porte chaque demande, dans l'ordre (`asked`), et combien elle en a reçu à la fois au plus
   * (`concurrent` : chacune répond après 20 ms), et rend un prix par carte ; `failing` : un paquet
   * d'un seul id échoue (500).
   */
  function pricesApi() {
    const api = { asked: [] as number[], concurrent: 0, failing: false, stop: async () => {} }
    let pending = 0
    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(request) {
        const ids = new URL(request.url).searchParams.get('ids')!.split(',')
        api.asked.push(ids.length)
        api.concurrent = Math.max(api.concurrent, ++pending)
        await Bun.sleep(20)
        pending--
        if (api.failing && ids.length === 1) return new Response(null, { status: 500 })
        return Response.json({
          date: '2026-10-19',
          cards: Object.fromEntries(ids.map((id) => [id, [1, null, null]])),
        })
      },
    })
    const before = process.env.DATA_API_URL
    process.env.DATA_API_URL = server.url.origin
    api.stop = async () => {
      await server.stop(true)
      process.env.DATA_API_URL = before
    }
    return api
  }

  test('plus de 1 000 cartes possédées : leurs prix demandés par paquets de 1 000, l’un après l’autre, réunis', async () => {
    // L'API des données refuse plus de 1 025 ids par demande.
    const many = await accountOwning('Riche', 1001)
    const api = pricesApi()
    try {
      const { prices } = await visit('riche')
      // Dans l'ordre, et jamais deux à la fois : une visite sans session ne mobilise pas l'API.
      expect(api.asked).toEqual([1000, 1])
      expect(api.concurrent).toBe(1)
      expect(prices?.date).toBe('2026-10-19')
      expect(Object.keys(prices!.cards).sort()).toEqual(
        many.map(({ cardmarket }) => String(cardmarket)).sort(),
      )
      // Un paquet sans réponse : pas de prix du tout, plutôt qu'une valeur fausse.
      api.failing = true
      expect((await visit('riche')).prices).toBeNull()
    } finally {
      await api.stop()
    }
  })

  test('au plus 5 paquets par visite : au-delà de 5 000 cartes possédées, aucun prix demandé', async () => {
    // Une visite sans session ne fait jamais plus de 5 demandes à l'API des données.
    await accountOwning('Enorme', 5000)
    await accountOwning('Immense', 5001)
    const api = pricesApi()
    try {
      expect((await visit('enorme')).prices).not.toBeNull()
      expect(api.asked).toEqual([1000, 1000, 1000, 1000, 1000])
      api.asked.length = 0
      expect((await visit('immense')).prices).toBeNull()
      expect(api.asked).toEqual([])
    } finally {
      await api.stop()
    }
  })
})
