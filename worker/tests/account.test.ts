/**
 * Le compte (`worker/auth.ts`) : chacun le sien, par un pseudo (deux caractères au moins, jamais
 * une adresse du site, unique sans tenir compte des majuscules), sans e-mail (le Worker en donne
 * une sans boîte) ; une seule session par compte ; supprimé seulement avec son mot de passe ; un
 * pseudo quitté jamais repris par un autre compte (la base le refuse elle-même), seuls les 3
 * derniers réservés. D'un autre site, une modification est refusée partout (403, avant la lecture
 * de son corps), une lecture jamais. Les données de référence partent au Worker des données, sous
 * `/v1`, jamais avec le cookie de la session (`worker/data.ts`). Le Worker entier, dans le
 * moteur de Cloudflare, sur une base D1 neuve pour le fichier : chaque test crée ses comptes, sous
 * des pseudos à lui.
 */

import { env } from 'cloudflare:workers'
import { describe, expect, test, vi } from 'vitest'
import type { AccountState } from '@/types'
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
