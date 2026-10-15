/**
 * La connexion (Better Auth) : un seul compte, le vôtre, par e-mail et mot de passe, dans `app.db`.
 * - Il se crée à la première visite du site (`/bienvenue`), avec le code de première visite : tant
 *   qu'aucun compte n'existe, le serveur l'écrit dans son journal (`index.ts`), que vous seul lisez.
 *   Un visiteur arrivé avant vous ne peut donc pas le prendre. Ensuite, plus aucune inscription.
 *   `create-user.ts` le crée aussi depuis le serveur, ou change son mot de passe.
 * - Une seule session : se connecter sur un appareil déconnecte les autres. La collection n'est
 *   donc modifiée que d'un appareil à la fois.
 * Sessions de 60 jours, renouvelées chaque jour d'usage, dans un cookie (`__Secure-`, SameSite
 * Lax, en https).
 *
 * `BETTER_AUTH_URL` : l'adresse publique du site (en développement, celle de Vite :
 * http://localhost:5173), jamais devinée de la requête ; `BETTER_AUTH_SECRET` : la clé qui signe
 * les cookies (`openssl rand -base64 32`). Les deux sont exigées en production.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError } from 'better-auth/api'
import { getMigrations } from 'better-auth/db/migration'
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'

/** Un jour, en secondes (Better Auth compte ses durées en secondes ; `@/lib/time` en ms). */
const DAY_IN_SECONDS = 24 * 60 * 60

/** Sans les caractères qui se confondent (I, L, O, U) : « 7KQM-3XPA ». */
const CODE_LETTERS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Un code de première visite : 8 caractères, 40 bits, à 5 essais par minute. */
function newCode() {
  const letters = Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (byte) => CODE_LETTERS[byte % 32],
  )
  return `${letters.slice(0, 4).join('')}-${letters.slice(4).join('')}`
}

/** Le code tel que saisi, comparable au vrai : majuscules, sans espace ni tiret. */
const comparableCode = (code: string | null | undefined) =>
  (code ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

/**
 * La connexion, une fois créées les tables du compte qui manquent ; et la première visite. `trusted`
 * : seulement pour `create-user.ts`, qui crée le compte sans code.
 */
export async function createAuth(db: Database, { trusted = false } = {}) {
  let code: string | null = null
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    session: { expiresIn: 60 * DAY_IN_SECONDS, updateAge: DAY_IN_SECONDS },
    databaseHooks: {
      user: {
        create: {
          // Au moment de créer le compte (une adresse invalide ou un mot de passe trop court sont
          // refusés avant) : le code sert une fois, un second compte n'en trouve plus, pas plus
          // qu'après un compte créé par `create-user.ts` pendant que le serveur tourne. Si la
          // création échoue ensuite, redémarrer le serveur en donne un nouveau.
          before: async (_user, context) => {
            if (trusted) return
            const given = (context?.headers as Headers | undefined)?.get('x-setup-code')
            if (!code || account.get() || comparableCode(given) !== comparableCode(code)) {
              throw new APIError('FORBIDDEN', { message: 'Code de première visite incorrect' })
            }
            code = null
          },
        },
      },
      session: {
        create: {
          // Une seule session par compte : les autres appareils sont déconnectés.
          after: async (session) => {
            db.query('DELETE FROM session WHERE userId = ? AND id != ?').run(
              session.userId,
              session.id,
            )
          },
        },
      },
    },
    // Derrière le tunnel Cloudflare et nginx (qui n'écoute que sur la machine), l'adresse du
    // visiteur est dans cet en-tête : la limite de tentatives vaut pour lui, pas pour le tunnel.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // En production : 5 tentatives de connexion ou de création du compte par minute, 100 requêtes
    // pour le reste.
    rateLimit: {
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
  } satisfies BetterAuthOptions
  await (await getMigrations(options)).runMigrations()

  const account = db.query('SELECT email FROM "user" LIMIT 1')
  if (!trusted && !account.get()) code = newCode()
  return {
    auth: betterAuth(options),
    /** Le compte (son e-mail), `null` tant qu'il n'est pas créé. */
    account: () => (account.get() as { email: string } | null)?.email ?? null,
    /** Le code de première visite, `null` une fois le compte créé. */
    setupCode: () => code,
  }
}

export type Accounts = Awaited<ReturnType<typeof createAuth>>

/** L'origine publique du site, que doivent avoir les requêtes qui modifient des données. */
export const appOrigin = (auth: Accounts['auth']) => new URL(auth.options.baseURL as string).origin

/**
 * Le compte dans l'API (`/api/…`) :
 * - `/api/auth/*` : Better Auth (connexion, déconnexion, session, création du compte) ;
 * - `GET /api/account` : `{ exists }`, si le compte existe déjà (sinon, la première visite) ;
 * - la macro `auth` des routes réservées au compte : 401 sans session, 403 pour une modification
 *   venue d'une autre origine (le cookie part avec toute requête vers le site), jamais en cache ;
 *   la route reçoit `user`.
 */
export function accountRoutes({ auth, account }: Accounts) {
  const origin = appOrigin(auth)
  return new Elysia({ name: 'account' })
    .all(
      '/auth/*',
      ({ request, status }) =>
        // Le compte existe : plus d'inscription, refusée d'emblée (sans dire si une adresse est
        // celle du compte, ni calculer un mot de passe pour rien).
        new URL(request.url).pathname.endsWith('/sign-up/email') && account() !== null
          ? status(403, null)
          : auth.handler(request),
      {
        // Better Auth lit lui-même la requête.
        parse: 'none',
        detail: { hide: true },
      },
    )
    .get(
      '/account',
      ({ set }) => {
        set.headers['cache-control'] = 'no-store'
        return { exists: account() !== null }
      },
      { detail: { summary: 'Le compte existe-t-il ? Sinon, la première visite le crée' } },
    )
    .macro({
      auth: {
        async resolve({ request, set, status }) {
          set.headers['cache-control'] = 'no-store'
          if (
            !['GET', 'HEAD'].includes(request.method) &&
            request.headers.get('origin') !== origin
          ) {
            return status(403, null)
          }
          const session = await auth.api.getSession({ headers: request.headers })
          return session ? { user: session.user } : status(401, null)
        },
      },
    })
}
