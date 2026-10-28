/**
 * Pour les tests qui traversent le Worker entier (`worker.request`, comme le navigateur) :
 * l'adresse du site, une action du compte, un compte créé comme à l'inscription, la session
 * qu'une réponse pose ; et ce que Bun donnait (attendre, compresser).
 */

import { env } from 'cloudflare:workers'
import worker from '../index'

export const ORIGIN = env.BETTER_AUTH_URL

export const PASSWORD = 'mot-de-passe-d-essai'

/** Une requête au Worker, à une adresse du site. */
export const call = (path: string, init: RequestInit = {}) =>
  worker.request(`${ORIGIN}${path}`, init)

/** Une action du compte (`/api/auth/…`), du site (ou de `origin`), avec la session `cookie`. */
export const authCall = (path: string, body: unknown, cookie = '', origin = ORIGIN) =>
  call(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify(body),
  })

/** La session que pose une réponse : ses cookies, pour les requêtes suivantes. */
export const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ')

/**
 * Un compte créé comme à l'inscription (le pseudo deux fois, l'e-mail vide) : la réponse, le
 * compte et la session ouverte avec lui.
 */
export async function createAccount(pseudo: string) {
  const response = await authCall('sign-up/email', {
    name: pseudo,
    username: pseudo,
    email: '',
    password: PASSWORD,
  })
  const body = (await response.clone().json()) as { user?: { id: string; email: string } }
  return { response, user: body.user, cookie: cookieOf(response) }
}

/** Attend `ms` millisecondes. */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Compressé (`gzip`), comme le site envoie sa collection. */
export const gzip = async (data: string | Uint8Array<ArrayBuffer>) =>
  new Uint8Array(
    await new Response(
      new Blob([data]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer(),
  )
