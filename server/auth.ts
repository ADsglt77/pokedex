/**
 * La connexion (Better Auth) : un seul compte, le vôtre, par e-mail et mot de passe, dans `app.db`.
 * - Il se crée à la première visite du site (`/bienvenue`) : pseudo, e-mail, mot de passe. Le
 *   premier créé est le seul : ensuite, plus aucune inscription (refusée d'emblée, et la base
 *   refuse un second compte, même si deux créations arrivent ensemble).
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
import { getMigrations } from 'better-auth/db/migration'
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'

/** Un jour, en secondes (Better Auth compte ses durées en secondes ; `@/lib/time` en ms). */
const DAY_IN_SECONDS = 24 * 60 * 60

/** La connexion, une fois créées les tables du compte qui manquent. */
export async function createAuth(db: Database) {
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    session: { expiresIn: 60 * DAY_IN_SECONDS, updateAge: DAY_IN_SECONDS },
    databaseHooks: {
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
  // Un seul compte, même si deux créations arrivent ensemble : la base refuse le second.
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS one_account BEFORE INSERT ON "user"
    WHEN EXISTS (SELECT 1 FROM "user")
    BEGIN SELECT RAISE(ABORT, 'un seul compte'); END
  `)

  const account = db.query('SELECT email FROM "user" LIMIT 1')
  return {
    auth: betterAuth(options),
    /** Le compte (son e-mail), `null` tant qu'il n'est pas créé. */
    account: () => (account.get() as { email: string } | null)?.email ?? null,
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
