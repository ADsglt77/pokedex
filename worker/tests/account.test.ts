/**
 * Le compte (`worker/auth.ts`) : chacun le sien, par un pseudo (deux caractères au moins, jamais
 * une adresse du site, unique sans tenir compte des majuscules), sans e-mail (le Worker en donne
 * une sans boîte) ; une seule session par compte ; supprimé seulement avec son mot de passe ; un
 * pseudo quitté jamais repris par un autre compte (la base le refuse elle-même), seuls les 3
 * derniers réservés. 20 mots de passe refusés par heure sur un pseudo, d'où qu'ils viennent :
 * au-delà, 429, même avec le bon, la même réponse qu'il ait un compte ou non. Un essai qui n'est pas
 * un refus (réussi, mal formé, en panne, en rafale) ne garde pas sa place ni n'ouvre l'heure ; un
 * pseudo invalide n'écrit rien ; des essais simultanés, ou en cours au changement d'heure, ne
 * passent pas la limite ; le blocage tombe une heure après le premier refus, sans que les essais
 * bloqués le prolongent. D'un autre site, une modification est refusée partout (403, avant la
 * lecture de son corps), une lecture jamais. Un corps de plus de 16 Ko, refusé (413) avant Better Auth,
 * que sa taille soit annoncée ou non. Les données de référence partent au Worker des données, sous
 * `/v1`, jamais avec le cookie de la session (`worker/data.ts`). Le Worker entier, dans le
 * moteur de Cloudflare, sur une base D1 neuve pour le fichier : chaque test crée ses comptes, sous
 * des pseudos à lui.
 */

import { env } from 'cloudflare:workers'
import { describe, expect, test, vi } from 'vitest'
import { PSEUDO_LOCKED } from '@/config/account'
import { HOUR, MINUTE } from '@/lib/time'
import type { AccountState } from '@/types'
import { auth } from '../auth'
import { db } from '../db'
import * as schema from '../schema'
import { authCall, call, cookieOf, createAccount, ORIGIN, PASSWORD, sleep } from './helpers'

const FOREIGN = 'https://autre.exemple'

/** Qui est connecté avec cette session (`/api/account`). */
const accountOf = async (cookie: string) =>
  ((await (await call('/api/account', { headers: { Cookie: cookie } })).json()) as AccountState)
    .user

/** Le code d'un refus de Better Auth. */
const codeOf = async (response: Response) => ((await response.json()) as { code: string }).code

/** Les comptes qui portent ce pseudo, dans la base. */
const holders = async (pseudo: string) =>
  (await env.DB.prepare('SELECT id FROM "user" WHERE username = ?').bind(pseudo).all()).results

describe('les comptes : chacun le sien', () => {
  test('pas d’e-mail : le Worker en donne une sans boîte, propre au compte ; connecté aussitôt', async () => {
    const sacha = await createAccount('Sacha')
    expect(sacha.response.status).toBe(200)
    expect(sacha.user!.email).toMatch(/^[0-9a-f-]{36}@pokedex\.invalid$/)
    expect(await accountOf(sacha.cookie)).toEqual({ id: sacha.user!.id, name: 'Sacha' })
  })

  test('un pseudo de deux caractères, oui ; une adresse du site, non', async () => {
    expect((await createAccount('Al')).response.status).toBe(200)
    for (const pseudo of ['A', 'connexion', 'Pokedex', 'Collections', 'api']) {
      expect((await createAccount(pseudo)).response.status).toBe(400)
    }
  })

  test('un pseudo déjà pris, même autrement écrit : refusé, rien de créé', async () => {
    await createAccount('Regis')
    const { response } = await createAccount('REGIS')
    expect(response.status).toBe(400)
    expect(await codeOf(response)).toBe('USERNAME_IS_ALREADY_TAKEN')
    expect(await holders('regis')).toHaveLength(1)
  })

  test('une seule session par compte : se connecter ailleurs ferme la première', async () => {
    const ondine = await createAccount('Ondine')
    const elsewhere = await authCall('sign-in/username', { username: 'ondine', password: PASSWORD })
    expect(elsewhere.status).toBe(200)
    expect(await accountOf(cookieOf(elsewhere))).toEqual({ id: ondine.user!.id, name: 'Ondine' })
    expect(await accountOf(ondine.cookie)).toBeNull()
  })

  test('supprimé avec son mot de passe seulement ; son pseudo n’est pas repris', async () => {
    const pierre = await createAccount('Pierre')
    // Sans mot de passe, ou avec un faux : rien ne part.
    expect((await authCall('delete-user', {}, pierre.cookie)).status).toBe(400)
    expect((await authCall('delete-user', { password: 'faux' }, pierre.cookie)).status).toBe(400)
    expect(await accountOf(pierre.cookie)).not.toBeNull()

    expect((await authCall('delete-user', { password: PASSWORD }, pierre.cookie)).status).toBe(200)
    expect(await accountOf(pierre.cookie)).toBeNull()
    expect(await holders('pierre')).toHaveLength(0)
    // Ses liens partagés ne mèneraient plus à lui.
    const { response } = await createAccount('pierre')
    expect(response.status).toBe(400)
    expect(await codeOf(response)).toBe('USERNAME_IS_ALREADY_TAKEN')
  })

  test('un pseudo quitté n’est jamais repris par un autre compte ; le sien peut le reprendre', async () => {
    const aurore = await createAccount('Aurore')
    const flora = await createAccount('Flora')
    const rename = (to: string) => authCall('update-user', { name: to, username: to }, flora.cookie)
    expect((await rename('Flora-2')).status).toBe(200)
    expect((await createAccount('flora')).response.status).toBe(400)
    expect((await rename('Flora')).status).toBe(200)
    expect(await holders('flora')).toEqual([{ id: flora.user!.id }])
    // La base le refuse elle-même (deux requêtes ensemble ne passent pas entre le contrôle et
    // l'écriture) : « flora-2 », quitté par Flora, n'est à personne d'autre.
    const take = env.DB.prepare('UPDATE "user" SET username = ? WHERE id = ?')
    await expect(take.bind('flora-2', aurore.user!.id).run()).rejects.toThrow('pseudo réservé')
  })

  test('changer de pseudo sans fin ne réserve que les 3 derniers', async () => {
    const cynthia = await createAccount('Cynthia')
    for (const to of ['Cynthia-1', 'Cynthia-2', 'Cynthia-3', 'Cynthia-4']) {
      const response = await authCall('update-user', { name: to, username: to }, cynthia.cookie)
      expect(response.status).toBe(200)
      // `released_at` est à la milliseconde : deux changements dans la même ne seraient plus
      // rangés (`ORDER BY released_at`), et les 3 gardés tirés au hasard.
      await sleep(5)
    }
    // Quittés : cynthia, -1, -2, -3 ; seuls les 3 derniers restent réservés.
    expect((await createAccount('cynthia-1')).response.status).toBe(400)
    expect((await createAccount('cynthia')).response.status).toBe(200)
  })
})

describe('d’un autre site : une modification refusée partout, une lecture jamais', () => {
  test('refusée avant la lecture de son corps (403, sans corps, jamais en cache)', async () => {
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
    const response = await call('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: FOREIGN },
      body,
    })
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(read).toBe(false)
  })

  test('une adresse inconnue aussi : 403, quand le site y aurait un 404', async () => {
    const post = (origin?: string) =>
      call('/api/inconnue', { method: 'POST', headers: origin ? { Origin: origin } : {} })
    expect((await post(FOREIGN)).status).toBe(403)
    // Sans origine : une modification n'en vient pas du site.
    expect((await post()).status).toBe(403)
    expect((await post(ORIGIN)).status).toBe(404)
  })

  test('ni création ni connexion (403)', async () => {
    await createAccount('Rocky')
    const created = await authCall(
      'sign-up/email',
      { name: 'Brock', username: 'Brock', email: '', password: PASSWORD },
      '',
      FOREIGN,
    )
    expect(created.status).toBe(403)
    expect(await holders('brock')).toHaveLength(0)
    const signedIn = await authCall(
      'sign-in/username',
      { username: 'Rocky', password: PASSWORD },
      '',
      FOREIGN,
    )
    expect(signedIn.status).toBe(403)
    expect(signedIn.headers.getSetCookie()).toEqual([])
  })

  test('les lectures passent, sans origine ou d’ailleurs', async () => {
    for (const headers of [{}, { Origin: FOREIGN }] as Record<string, string>[]) {
      const response = await call('/api/account', { headers })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ user: null })
    }
  })
})

describe('les mots de passe refusés sur un pseudo : 20 par heure, d’où qu’ils viennent', () => {
  /** Un essai de connexion, depuis l'adresse `198.51.100.<visitor>`. */
  const signInFrom = (visitor: number, username: string, password: string) =>
    call('/api/auth/sign-in/username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'CF-Connecting-IP': `198.51.100.${visitor}`,
      },
      body: JSON.stringify({ username, password }),
    })

  /** 20 mots de passe refusés sur ce pseudo, chacun d'une autre adresse : 401 chaque fois. */
  async function refuse(pseudo: string) {
    for (let visitor = 1; visitor <= 20; visitor++) {
      expect((await signInFrom(visitor, pseudo, 'mauvais-mot-de-passe')).status).toBe(401)
    }
  }

  /** Le pseudo est bloqué : 429, jamais en cache, avec le code que dit le formulaire. */
  async function expectLocked(response: Response) {
    expect(response.status).toBe(429)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await codeOf(response.clone())).toBe(PSEUDO_LOCKED)
    return response
  }

  /** Recule d'autant l'heure de chaque compteur de la base, comme si le temps avait passé. */
  const elapse = (ms: number) =>
    env.DB.prepare('UPDATE rateLimit SET lastRequest = lastRequest - ?').bind(ms).run()

  test('le 21e essai, après 20 refus depuis 20 adresses : 429, même avec le bon mot de passe ; un autre compte se connecte toujours de là', async () => {
    await createAccount('Visee')
    await createAccount('Voisine')
    for (let visitor = 1; visitor <= 20; visitor++) {
      // Le même pseudo, quelle que soit son écriture.
      const typed = visitor % 2 ? 'Visee' : 'VISEE'
      expect((await signInFrom(visitor, typed, 'mauvais-mot-de-passe')).status).toBe(401)
    }
    const locked = await expectLocked(await signInFrom(21, 'visee', PASSWORD))
    // Jusqu'à une heure après le premier refus.
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(3500)
    expect(Number(locked.headers.get('retry-after'))).toBeLessThanOrEqual(3600)
    expect(locked.headers.getSetCookie()).toEqual([])
    expect((await signInFrom(21, 'Voisine', PASSWORD)).status).toBe(200)
  }, 30_000)

  test('un pseudo sans compte se bloque de même, avec la même réponse : rien ne dit s’il existe', async () => {
    await createAccount('Connue')
    await refuse('Connue')
    await refuse('Inconnue')
    const known = await expectLocked(await signInFrom(21, 'Connue', 'mauvais-mot-de-passe'))
    const unknown = await expectLocked(await signInFrom(21, 'Inconnue', 'mauvais-mot-de-passe'))
    expect(await unknown.text()).toBe(await known.text())
    expect([...unknown.headers.keys()]).toEqual([...known.headers.keys()])
  }, 30_000)

  test('ni une connexion réussie ni un essai mal formé ne comptent parmi les refus', async () => {
    await createAccount('Patiente')
    expect((await signInFrom(1, 'Patiente', PASSWORD)).status).toBe(200)
    // Refusé avant d'être comparé : un mot de passe de plus de 128 caractères.
    expect((await signInFrom(1, 'Patiente', 'x'.repeat(200))).status).toBe(400)
    await refuse('Patiente')
    await expectLocked(await signInFrom(21, 'Patiente', PASSWORD))
  }, 30_000)

  test('40 essais mal formés simultanés d’un seul visiteur : aucun blocage durable, seuls les refus restent comptés', async () => {
    await createAccount('Assiegee')
    // Refusés avant toute comparaison, comme ceux que bloque la limite par visiteur de Better Auth.
    await Promise.all(Array.from({ length: 40 }, () => signInFrom(50, 'Assiegee', 'x'.repeat(200))))
    expect((await signInFrom(51, 'Assiegee', PASSWORD)).status).toBe(200)
    await refuse('Assiegee')
    await expectLocked(await signInFrom(21, 'Assiegee', PASSWORD))
  }, 30_000)

  test('un pseudo invalide n’est pas compté : rien n’est écrit dans la base', async () => {
    const rows = async () =>
      (await env.DB.prepare('SELECT count(*) AS n FROM rateLimit').first<{ n: number }>())!.n
    const before = await rows()
    // Trop court, trop long, une espace, une adresse du site : Better Auth les refuse (422).
    for (const pseudo of ['a', 'x'.repeat(21), 'pas valide', 'connexion']) {
      expect((await signInFrom(1, pseudo, 'mauvais-mot-de-passe')).status).toBe(422)
    }
    expect(await rows()).toBe(before)
  })

  test('des essais simultanés ne passent pas la limite : sur 30 à la fois, 20 refus et 10 blocages', async () => {
    const statuses = await Promise.all(
      Array.from(
        { length: 30 },
        async (_, visitor) =>
          (await signInFrom(visitor + 1, 'Rafale', 'mauvais-mot-de-passe')).status,
      ),
    )
    expect(statuses.filter((status) => status === 401)).toHaveLength(20)
    expect(statuses.filter((status) => status === 429)).toHaveLength(10)
  }, 30_000)

  test('le blocage tombe une heure après le premier refus, sans que les essais bloqués le prolongent', async () => {
    await createAccount('Attente')
    await refuse('Attente')
    await elapse(30 * MINUTE)
    await expectLocked(await signInFrom(21, 'Attente', PASSWORD))
    // Une minute avant la fin de l'heure (le temps des refus compris) : toujours bloqué.
    await elapse(29 * MINUTE)
    await expectLocked(await signInFrom(21, 'Attente', PASSWORD))
    await elapse(MINUTE + 1000)
    expect((await signInFrom(21, 'Attente', PASSWORD)).status).toBe(200)
    // Une heure neuve : ce refus est le premier.
    expect((await signInFrom(22, 'Attente', 'mauvais-mot-de-passe')).status).toBe(401)
  }, 30_000)

  test('au changement d’heure, un essai encore en cours ne rend pas sa place dans l’heure neuve : 20 refus au plus', async () => {
    const handler = auth.handler.bind(auth)
    let release = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const hold = vi.spyOn(auth, 'handler').mockImplementation(async (request) => {
      await gate
      return handler(request)
    })
    // Cinq essais mal formés, comptés dans cette heure, encore en cours quand elle finit.
    const held = Promise.all(
      Array.from({ length: 5 }, () => signInFrom(60, 'Bascule', 'x'.repeat(200))),
    )
    while (hold.mock.calls.length < 5) await sleep(10)
    hold.mockRestore()
    await elapse(HOUR + 1000)
    expect((await signInFrom(1, 'Bascule', 'mauvais-mot-de-passe')).status).toBe(401)
    release()
    await held
    let refused = 1
    for (let visitor = 2; visitor <= 30; visitor++) {
      const { status } = await signInFrom(visitor, 'Bascule', 'mauvais-mot-de-passe')
      if (status !== 401) {
        expect(status).toBe(429)
        break
      }
      refused++
    }
    expect(refused).toBe(20)
  }, 30_000)

  test('un essai qui n’est pas un refus n’ouvre pas l’heure : `Retry-After` ne dit rien d’une connexion réussie', async () => {
    await createAccount('Discrete')
    expect((await signInFrom(1, 'Discrete', PASSWORD)).status).toBe(200)
    await elapse(30 * MINUTE)
    await refuse('Discrete')
    const locked = await expectLocked(await signInFrom(21, 'Discrete', PASSWORD))
    // L'heure part du premier refus, pas de la connexion d'il y a 30 minutes.
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(3500)
  }, 30_000)

  test('une connexion interrompue par une panne rend son essai : 25 d’affilée ne bloquent pas', async () => {
    await createAccount('Panne')
    const broken = vi.spyOn(auth, 'handler').mockRejectedValue(new Error('panne simulée'))
    try {
      for (let visitor = 1; visitor <= 25; visitor++) {
        expect((await signInFrom(visitor, 'Panne', PASSWORD)).status).toBe(500)
      }
    } finally {
      broken.mockRestore()
    }
    expect((await signInFrom(26, 'Panne', PASSWORD)).status).toBe(200)
  }, 30_000)

  test('une place qui ne peut pas être rendue (panne de la base) ne change pas la réponse : la connexion réussie reste ouverte', async () => {
    await createAccount('Fragile')
    const update = db.update.bind(db)
    const broken = vi.spyOn(db, 'update').mockImplementation(((table: never) =>
      table === schema.rateLimit
        ? {
            set: () => ({
              where: () => ({ run: () => Promise.reject(new Error('panne simulée de la base')) }),
            }),
          }
        : update(table)) as never)
    const log = vi.spyOn(console, 'log')
    log.mockClear()
    try {
      const response = await signInFrom(1, 'Fragile', PASSWORD)
      expect(response.status).toBe(200)
      expect((await accountOf(cookieOf(response)))?.name).toBe('Fragile')
      // Le journal le dit.
      expect(log.mock.calls.flat().some((line) => String(line).includes('non rendu'))).toBe(true)
    } finally {
      broken.mockRestore()
    }
  }, 30_000)
})

describe('un corps de plus de 16 Ko : refusé avant Better Auth', () => {
  test('une inscription allongée à 1 Mo, annoncée ou en flux : 413 sans corps, jamais en cache, rien de créé', async () => {
    // Une inscription valable, suivie d'espaces : lue jusqu'au bout, elle créerait le compte.
    const json =
      JSON.stringify({ name: 'Gary', username: 'Gary', email: '', password: PASSWORD }) +
      ' '.repeat(1_000_000)
    const send = (body: BodyInit, headers: Record<string, string> = {}) =>
      call('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
        body,
      })
    // Sa taille annoncée (`Content-Length`, une requête ordinaire), ou en flux, sans taille.
    const declared = await send(json, { 'Content-Length': String(json.length) })
    const streamed = await send(new Blob([json]).stream())
    for (const response of [declared, streamed]) {
      expect(response.status).toBe(413)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.text()).toBe('')
    }
    expect(await holders('gary')).toHaveLength(0)
    // Sans les espaces : créé, comme avant.
    expect((await createAccount('Gary')).response.status).toBe(200)
  })
})

describe('les données de référence : au Worker des données', () => {
  test('sous `/v1`, jamais avec le cookie de la session', async () => {
    const seen: Request[] = []
    const fetch = vi.spyOn(env.DATA, 'fetch').mockImplementation(async (input) => {
      seen.push(input as Request)
      return new Response('[]')
    })
    const headers = { Cookie: 'better-auth.session_token=secret' }
    expect((await call('/api/species?langue=fr', { headers })).status).toBe(200)
    expect((await call('/images/cards/SV2A/166-md.webp', { headers })).status).toBe(200)
    fetch.mockRestore()
    expect(seen.map((request) => request.url)).toEqual([
      'https://pokedex-data/v1/species?langue=fr',
      'https://pokedex-data/v1/images/cards/SV2A/166-md.webp',
    ])
    for (const request of seen) expect(request.headers.get('cookie')).toBeNull()
  })
})
