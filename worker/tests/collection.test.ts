/**
 * La garde du Worker contre l'écrasement (`worker/collection.ts`) : un appareil qui envoie une
 * collection partie d'une version dépassée (un autre onglet, un autre appareil l'a changée), ou en
 * avance, est refusé (409), et la version du serveur reste telle quelle ; sans session rien ne
 * passe, ni d'un autre site (une modification, avant même la lecture de son corps ; une lecture,
 * si) ; un document abîmé est refusé (400). Une erreur ici écraserait les commandes d'un autre
 * appareil. La lecture dit à quel compte est la collection, et seulement sa version quand
 * l'appareil a déjà celle-là (`?version=`) ; un envoi compressé (`gzip`, celui du site) est
 * enregistré, mais refusé (413) au-delà de 5 000 000 octets décompressés, sans jamais décompresser
 * plus (une bombe de 100 Mo suivie d'octets illisibles : lue jusqu'au bout, elle ferait un 400) ;
 * sans session, 401 sans rien décompresser (le cookie renouvelé d'une session repart toujours) ;
 * une panne en lisant la session, 500 (pas le 400 d'un document refusé) ; un envoi renvoyé tel
 * quel après une réponse perdue est reconnu (200, la même version), un autre parti de la même
 * version reste refusé (409). Chaque compte ne touche qu'à sa collection, et la sienne part avec
 * lui. Le journal : ce qu'un compte peut répéter à volonté (un export signalé, un envoi refusé)
 * n'y écrit qu'une ligne par minute. Et ce que montre le Pokédex public d'un compte
 * (`/api/vitrine/<pseudo>`, l'aperçu d'un lien partagé) : ce qu'il laisserait passer serait
 * public. Le Worker entier, sur une base D1 neuve pour le fichier, avec un compte créé comme à
 * l'inscription et un premier envoi ; chaque test part de la version du moment.
 */

import { env } from 'cloudflare:workers'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { emptyShopping } from '@/lib/orders'
import { DAY } from '@/lib/time'
import type { CollectionDocument, CollectionResponse, CollectionSaved, VitrineData } from '@/types'
import { card, collectionWith, NOW, order, ownership, withCards } from '../../tests/fixtures'
import { auth } from '../auth'
import worker from '../index'
import { authCall, call, createAccount, gzip, ORIGIN, PASSWORD, sleep } from './helpers'

// Le journal du Worker (une ligne par évènement) : muet pendant ces tests.
const log = vi.spyOn(console, 'log').mockImplementation(() => {})
afterAll(() => log.mockRestore())

/** Le Worker des données : sans guide des prix (404), sauf dans les tests des prix (`dataApi`). */
const NO_PRICES = () => new Response(null, { status: 404 })
const dataApi = vi.spyOn(env.DATA, 'fetch').mockImplementation(async () => NO_PRICES())
afterAll(() => dataApi.mockRestore())

const signUp = await createAccount('Sacha')
const cookie = signUp.cookie
const sacha = signUp.user!.id

/** `/api/collection`, du site et avec la session ; `headers` s'y ajoute ou les remplace. */
const collection = (method: 'GET' | 'PUT', body?: unknown, headers: Record<string, string> = {}) =>
  call('/api/collection', {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

/**
 * `PUT /api/collection` comme l'envoie le site : compressé (`Content-Encoding: gzip`) ; `headers`
 * s'y ajoute ou les remplace.
 */
const gzipped = (body: RequestInit['body'], headers: Record<string, string> = {}) =>
  call('/api/collection', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      Origin: ORIGIN,
      Cookie: cookie,
      ...headers,
    },
    body,
  })

/** La version enregistrée sur le serveur. */
async function stored() {
  const response = await collection('GET')
  return { body: (await response.json()) as CollectionResponse }
}

/** Un document écrit directement dans la base, comme avant une livraison. */
const storeDirectly = (userId: string, document: string) =>
  env.DB.prepare(
    'INSERT INTO collections (user_id, version, collection, shopping, updated_at) VALUES (?, 1, ?, ?, ?)',
  )
    .bind(userId, document, JSON.stringify(emptyShopping()), NOW)
    .run()

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
  })

  test('une version en avance sur le serveur : 409', async () => {
    const before = await stored()
    const response = await collection('PUT', {
      account: sacha,
      baseVersion: before.body.version + 5,
      ...second,
    })
    expect(response.status).toBe(409)
    expect(await stored()).toEqual(before)
  })

  test('un document abîmé, ou un envoi sans compte ni version : 400, rien d’écrit', async () => {
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
    expect((await collection('PUT', { ...first })).status).toBe(400)
    expect((await collection('PUT', { account: sacha, baseVersion: -1, ...first })).status).toBe(
      400,
    )
    expect(await stored()).toEqual(before)
  })

  test('un document enregistré avant les collections d’extensions (sans `series`) : le suivant est enregistré, et journalisé', async () => {
    const old = await createAccount('Veteran')
    const before = JSON.stringify({
      ...withCards(collectionWith({ a: ownership('owned') }), card('a', [25])),
      series: undefined,
    })
    expect(before).not.toContain('series')
    await storeDirectly(old.user!.id, before)
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

  test('envoyé d’un autre site (le cookie part avec toute requête vers le site) : 403, avant d’être lu', async () => {
    const before = await stored()
    const response = await collection(
      'PUT',
      { account: sacha, baseVersion: before.body.version, ...second },
      { Origin: 'https://autre.exemple' },
    )
    expect(response.status).toBe(403)
    // Un corps que le Worker ne lit qu'en le demandant : il ne l'est jamais.
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
    const unread = await worker.request(
      new Request(`${ORIGIN}/api/collection`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://autre.exemple',
          Cookie: cookie,
        },
        body,
      }),
    )
    expect(unread.status).toBe(403)
    expect(unread.headers.get('cache-control')).toBe('no-store')
    expect(await unread.text()).toBe('')
    expect(read).toBe(false)
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

  test('d’un autre site, une lecture passe : la collection, un Pokédex public', async () => {
    const headers = { Origin: 'https://autre.exemple' }
    expect((await collection('GET', undefined, headers)).status).toBe(200)
    expect((await call('/api/vitrine/sacha', { headers })).status).toBe(200)
  })
})

describe('/api/collection : lue depuis sa version, envoyée compressée, renvoyée après une réponse perdue', () => {
  /** La lecture d'un appareil qui a déjà la version `version` (`?version=`). */
  const readFrom = (version: number | string) =>
    call(`/api/collection?version=${version}`, { headers: { Cookie: cookie } })

  test('l’appareil a déjà la version du serveur : la version et le compte seuls, sans le document', async () => {
    const { body } = await stored()
    const same = await readFrom(body.version)
    expect(same.status).toBe(200)
    expect(same.headers.get('cache-control')).toBe('no-store')
    expect(await same.json()).toEqual({ version: body.version, account: sacha })
    // Une autre version : le document entier.
    expect(await (await readFrom(body.version - 1)).json()).toEqual(body)
    // Une version qui n'en est pas une : refusée, sans document.
    expect((await readFrom('abc')).status).toBe(400)
  })

  test('compressée (`Content-Encoding: gzip`, comme l’envoie le site) : enregistrée comme une autre', async () => {
    const before = await stored()
    const next: CollectionDocument = {
      ...first,
      shopping: { ...emptyShopping(), orders: [order({ id: 'compressée' })] },
    }
    const sent = { account: sacha, baseVersion: before.body.version, ...next }
    const response = await gzipped(await gzip(JSON.stringify(sent)))
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
    expect((await gzipped(await gzip('{"account":'))).status).toBe(400)
    expect((await gzipped(JSON.stringify(sent))).status).toBe(400)
    expect(await stored()).toEqual(after)
  })

  test('compressée, sans session : 401, sans rien lire', async () => {
    const before = await stored()
    // 4 Mo une fois décompressés, dans 4 Ko ; une bombe ; du gzip illisible : lus, ils feraient
    // un 400 ou un 413. Sans session, rien n'est lu : 401.
    const heavy = await gzip(' '.repeat(4_000_000))
    const bomb = await gzip(new Uint8Array(100_000_000))
    for (const noSession of ['', 'better-auth.session_token=inconnu']) {
      for (const body of [heavy, bomb, 'pas du gzip']) {
        expect((await gzipped(body, { Cookie: noSession })).status).toBe(401)
      }
    }
    // Avec la session, le même corps est lu : des espaces ne sont pas un document, 400.
    expect((await gzipped(heavy)).status).toBe(400)
    expect(await stored()).toEqual(before)
  })

  test('illisible : 400 avec la session, 401 sans, et rien au journal', async () => {
    const before = await stored()
    // N'importe qui peut l'envoyer : rien ne doit en venir au journal (ni une ligne, ni une erreur
    // dans la sortie du Worker).
    log.mockClear()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (const [session, status] of [
        [cookie, 400],
        ['', 401],
      ] as const) {
        const response = await call('/api/collection', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: session },
          body: '{"account":',
        })
        expect(response.status).toBe(status)
      }
      expect(log).not.toHaveBeenCalled()
      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
    }
    expect(await stored()).toEqual(before)
  })

  test('la session ne peut pas être lue (une panne passagère) : 500, l’appareil réessaiera', async () => {
    const before = await stored()
    const lookup = vi.spyOn(auth.api, 'getSession').mockRejectedValueOnce(new Error('Base occupée'))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const sent = { account: sacha, baseVersion: before.body.version, ...second }
      // Pas un 400 : l'appareil dirait « Envoi refusé », et ne réessaierait pas ; pas un 401 : il
      // dirait la session fermée.
      expect((await gzipped(await gzip(JSON.stringify(sent)))).status).toBe(500)
    } finally {
      lookup.mockRestore()
      errors.mockRestore()
    }
    expect(await stored()).toEqual(before)
  })

  test('une session à renouveler : son cookie renouvelé repart avec la réponse d’un envoi compressé', async () => {
    const owner = await createAccount('Renouveau')
    // Ouverte il y a deux jours : renouvelée à la requête suivante (une fois par jour d'usage).
    await env.DB.prepare('UPDATE session SET expiresAt = ? WHERE userId = ?')
      .bind(Date.now() + 58 * DAY, owner.user!.id)
      .run()
    const sent = { account: owner.user!.id, baseVersion: 0, ...first }
    const response = await gzipped(await gzip(JSON.stringify(sent)), { Cookie: owner.cookie })
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().join()).toContain('session_token=')
  })

  test('plus de 5 000 000 octets une fois décompressée : 413, sans décompresser plus', async () => {
    const before = await stored()
    // Une « bombe » : 100 Mo de zéros une fois décompressée, 100 Ko compressée, suivie de trois
    // octets qui ne sont pas du gzip. Décompressée jusqu'au bout, elle lèverait une erreur (400) ;
    // arrêtée au plafond, elle n'y arrive jamais (413).
    const member = await gzip(new Uint8Array(100_000_000))
    const bomb = new Uint8Array(member.length + 3)
    bomb.set(member)
    bomb.set([1, 2, 3], member.length)
    const start = performance.now()
    const response = await gzipped(bomb)
    expect(response.status).toBe(413)
    // Arrêtée au plafond : quelques dizaines de millisecondes.
    expect(performance.now() - start).toBeLessThan(2_000)
    // Tel qu'envoyé, plus de 5 Mo : 413 aussi.
    expect((await gzipped(new Uint8Array(5_000_001))).status).toBe(413)
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
    // La réponse s'est perdue (délai, réseau coupé) : l'appareil renvoie le même document.
    log.mockClear()
    const again = await collection('PUT', sent)
    expect(again.status).toBe(200)
    expect((await again.json()) as CollectionSaved).toEqual({ version: before.body.version + 1 })
    expect(await stored()).toEqual(after)
    // Rien au journal : ni un refus, ni une modification de plus.
    expect(log).not.toHaveBeenCalled()
    // Compressée aussi.
    expect((await gzipped(await gzip(JSON.stringify(sent)))).status).toBe(200)
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

describe('les comptes : chacun sa collection', () => {
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
    expect((await call('/api/vitrine/pierre')).status).toBe(200)

    expect((await authCall('delete-user', { password: PASSWORD }, pierre.cookie)).status).toBe(200)
    const left = await env.DB.prepare('SELECT COUNT(*) AS count FROM collections WHERE user_id = ?')
      .bind(pierre.user!.id)
      .first()
    expect(left).toEqual({ count: 0 })
    expect((await call('/api/vitrine/pierre')).status).toBe(404)
    expect((await collection('GET', undefined, asPierre)).status).toBe(401)
  })

  test('un pseudo quitté : son Pokédex public n’y est plus, et y revient s’il le reprend', async () => {
    const flora = await createAccount('Flora')
    const rename = (to: string) => authCall('update-user', { name: to, username: to }, flora.cookie)
    expect((await rename('Flora-2')).status).toBe(200)
    expect((await call('/api/vitrine/flora')).status).toBe(404)
    expect((await rename('Flora')).status).toBe(200)
    expect((await call('/api/vitrine/flora')).status).toBe(200)
  })
})

describe('le journal : aucun compte ne le noie', () => {
  test('un export signalé sans fin, un document refusé renvoyé sans fin : une ligne par minute', async () => {
    // Un compte à part : les refus des autres tests, notés dans la minute, tairaient les siens.
    const rocky = await createAccount('Rocky')
    const asRocky = { Cookie: rocky.cookie }
    const report = (event: string) =>
      call('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...asRocky },
        body: JSON.stringify({ event }),
      })
    const lines = (message: string) =>
      log.mock.calls.flat().filter((line) => String(line).includes(message)).length
    log.mockClear()
    for (let i = 0; i < 50; i++) expect((await report('export')).status).toBe(204)
    expect((await report('import')).status).toBe(204)
    expect(lines('Collection exportée')).toBe(1)
    expect(lines('Fichier importé')).toBe(1)
    // Un autre évènement : refusé, rien au journal.
    expect((await report('autre')).status).toBe(400)

    const broken = {
      ...first,
      collection: { ...first.collection, customCards: { a: { ...card('a', [25]), id: 'z' } } },
    }
    for (let i = 0; i < 20; i++) {
      const sent = { account: rocky.user!.id, baseVersion: 0, ...broken }
      expect((await collection('PUT', sent, asRocky)).status).toBe(400)
    }
    expect(lines('Envoi refusé')).toBe(1)
  })
})

describe('/api/vitrine/<pseudo> : ce que voit un visiteur', () => {
  const visit = async (pseudo = 'sacha') => {
    const response = await call(`/api/vitrine/${pseudo}`)
    expect(response.status).toBe(200)
    return (await response.json()) as VitrineData
  }
  /** Ce que lit un robot d'aperçu à l'adresse `/pseudo` : le titre de sa page. */
  const previewTitle = async (path: string) => {
    const response = await call(path, { headers: { 'User-Agent': 'Mozilla/5.0 Discordbot/2.0' } })
    expect(response.status).toBe(200)
    return (await response.text()).match(/<title>(.*?)<\/title>/)?.[1]
  }

  test('le Pokédex du pseudo, sans tenir compte des majuscules ; un pseudo à personne : 404', async () => {
    expect((await visit('Sacha')).owner).toBe('Sacha')
    expect((await call('/api/vitrine/personne')).status).toBe(404)
    // L'aperçu d'un lien : celui du compte ; vers une adresse sans compte (une page du site,
    // `/connexion`), celui du site, jamais celui d'un compte.
    expect(await previewTitle('/Sacha')).toBe('Le Pokédex de Sacha')
    expect(await previewTitle('/connexion')).toBe('PokéCodex')
    // Un compte qui porterait une adresse du site (créé avant qu'elle ne le devienne) : son
    // Pokédex n'y est jamais montré.
    const misty = await createAccount('Misty')
    await env.DB.prepare('UPDATE "user" SET username = ? WHERE id = ?')
      .bind('pokedex', misty.user!.id)
      .run()
    expect((await call('/api/vitrine/pokedex')).status).toBe(404)
    expect(await previewTitle('/pokedex')).toBe('PokéCodex')
  })

  test('inchangé depuis la dernière visite : 304, sans corps', async () => {
    const response = await call('/api/vitrine/sacha')
    const etag = response.headers.get('etag')!
    const again = await call('/api/vitrine/sacha', { headers: { 'If-None-Match': `W/${etag}` } })
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')
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
    await storeDirectly(old.user!.id, document)
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
    await storeDirectly(owner.user!.id, JSON.stringify(document))
    const shown = await visit('collectionneur')
    expect(shown.collection.series).toEqual(document.series)
    expect(shown.collection.customCards.s?.seriesOnly).toBe(true)
    expect(shown.collection.customCards.a).not.toHaveProperty('seriesOnly')
    expect(shown.collection.favorites).toEqual({ 25: 'a' })
    expect(Object.keys(shown.collection.cards)).toEqual(['a'])
    expect(JSON.stringify(shown)).not.toMatch(/ordered|paidPrice/)
  })

  test('les prix du jour des seules cartes possédées, demandés au Worker des données', async () => {
    // Un faux Worker des données : il note ce qu'on lui demande, et rend un prix par carte.
    const asked: string[] = []
    dataApi.mockImplementation(async (input) => {
      const request = input as Request
      const url = new URL(request.url)
      asked.push(`${url.pathname}${url.search}`)
      const ids = url.searchParams.get('ids')!.split(',')
      return Response.json({
        date: '2026-10-19',
        cards: Object.fromEntries(ids.map((id) => [id, [6.87, 5, 7.2]])),
      })
    })
    try {
      expect((await visit()).prices).toEqual({
        date: '2026-10-19',
        cards: { '719445': [6.87, 5, 7.2] },
      })
      expect(asked).toEqual(['/v1/prices?ids=719445'])
      // L'API muette : le Pokédex, sans prix.
      dataApi.mockRejectedValue(new TypeError('API muette'))
      expect((await visit()).prices).toBeNull()
    } finally {
      dataApi.mockImplementation(async () => NO_PRICES())
    }
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
    await storeDirectly(owner.user!.id, JSON.stringify(document))
    return many
  }

  /**
   * Une API des données qui a un guide des prix, jusqu'à `stop` : elle note combien d'ids
   * porte chaque demande, dans l'ordre (`asked`), et combien elle en a reçu à la fois au plus
   * (`concurrent` : chacune répond après 20 ms), et rend un prix par carte ; `failing` : un paquet
   * d'un seul id échoue (500).
   */
  function pricesApi() {
    const api = { asked: [] as number[], concurrent: 0, failing: false, stop: () => {} }
    let pending = 0
    dataApi.mockImplementation(async (input) => {
      const ids = new URL((input as Request).url).searchParams.get('ids')!.split(',')
      api.asked.push(ids.length)
      api.concurrent = Math.max(api.concurrent, ++pending)
      await sleep(20)
      pending--
      if (api.failing && ids.length === 1) return new Response(null, { status: 500 })
      return Response.json({
        date: '2026-10-19',
        cards: Object.fromEntries(ids.map((id) => [id, [1, null, null]])),
      })
    })
    api.stop = () => dataApi.mockImplementation(async () => NO_PRICES())
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
      api.stop()
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
      api.stop()
    }
  })
})
