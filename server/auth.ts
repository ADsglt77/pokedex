/**
 * La connexion (Better Auth) : un seul compte, le vôtre, par e-mail et mot de passe, dans `app.db`.
 * - Il se crée à la première visite du site (`/bienvenue`) : pseudo, e-mail, mot de passe, et
 *   seulement avec l'adresse `ACCOUNT_EMAIL` (exigée en production, `index.ts`) : un visiteur
 *   arrivé avant vous ne peut pas le prendre. Le premier créé est le seul : ensuite, plus aucune
 *   inscription (refusée d'emblée, et la base refuse un second compte, même si deux créations
 *   arrivent ensemble). Son mot de passe et son pseudo se changent dans l'app (Données › Mon
 *   compte).
 * - Une seule session : se connecter sur un appareil déconnecte les autres. La collection n'est
 *   donc modifiée que d'un appareil à la fois.
 * Sessions de 60 jours, renouvelées chaque jour d'usage, dans un cookie (`__Secure-`, SameSite
 * Lax, en https) : le cookie renouvelé repart avec la réponse de `/api/account` et des routes du
 * compte (`sessionOf`).
 *
 * `BETTER_AUTH_URL` : l'adresse publique du site (en développement, celle de Vite :
 * http://localhost:5173), jamais devinée de la requête ; `BETTER_AUTH_SECRET` : la clé qui signe
 * les cookies (`openssl rand -base64 32`). Les deux sont exigées en production.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import type { Database } from 'bun:sqlite'
import { Elysia, type Context } from 'elysia'
import { journal, type JournalLevel } from './journal'

/** Un jour, en secondes (Better Auth compte ses durées en secondes ; `@/lib/time` en ms). */
const DAY_IN_SECONDS = 24 * 60 * 60

/** La connexion, une fois créées les tables du compte qui manquent. */
export async function createAuth(db: Database) {
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    // Ses messages dans le journal de l'app, ses erreurs seulement : une connexion refusée y est
    // déjà (« Invalid password » en plus serait du bruit). Leur cause (l'erreur, sa pile) suit,
    // telle quelle.
    logger: {
      level: 'error',
      log: (_level, message, ...args) => {
        journal({ topic: 'serveur', level: 'error', message: `Better Auth : ${message}` })
        if (args.length > 0) console.error(...args)
      },
    },
    session: { expiresIn: 60 * DAY_IN_SECONDS, updateAge: DAY_IN_SECONDS },
    databaseHooks: {
      session: {
        create: {
          // Une seule session par compte : les autres appareils sont déconnectés (et, au changement
          // du mot de passe, l'ancienne session de celui-ci).
          after: async (session) => {
            const { changes } = db
              .query('DELETE FROM session WHERE userId = ? AND id != ?')
              .run(session.userId, session.id)
            if (changes > 0) {
              journal({ topic: 'compte', level: 'warn', message: 'Ancienne session fermée' })
            }
          },
        },
      },
    },
    // Derrière le tunnel Cloudflare et nginx (qui n'écoute que sur la machine), l'adresse du
    // visiteur est dans cet en-tête : la limite de tentatives vaut pour lui, pas pour le tunnel.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // En production : 5 tentatives de connexion, de création du compte ou de changement du mot de
    // passe par minute, 100 requêtes pour le reste.
    rateLimit: {
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/change-password': { window: 60, max: 5 },
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

/** L'adresse du compte (`ACCOUNT_EMAIL`) : aucune autre ne peut le créer. */
const ACCOUNT_EMAIL = process.env.ACCOUNT_EMAIL?.trim().toLowerCase()

/** L'e-mail et le pseudo d'une requête, pour le journal (jamais le mot de passe). */
async function bodyOf(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    name?: unknown
  } | null
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined)
  return { email: text(body?.email), name: text(body?.name) }
}

/** Les actions du compte que note le journal, d'après leur chemin. */
const WATCHED = /\/(sign-in\/email|sign-up\/email|sign-out|change-password|update-user)$/

/** Pour le journal : connexion, création du compte, déconnexion, mot de passe, pseudo. */
function journalAuth(
  path: string,
  request: Request,
  response: Response,
  email: string,
  name?: string,
) {
  const ok = response.ok
  const log = (message: string, level: JournalLevel, pseudo?: string, raison?: string) =>
    journal({ topic: 'compte', level, message, details: { email, pseudo, raison } }, request)
  if (path.endsWith('/sign-in/email')) {
    if (ok) log('Connexion', 'ok')
    else if (response.status === 429) log('Connexion bloquée', 'error', undefined, 'trop d’essais')
    else log('Connexion refusée', 'error')
  } else if (path.endsWith('/sign-up/email')) {
    log(ok ? 'Compte créé' : 'Création du compte refusée', ok ? 'ok' : 'error', name)
  } else if (path.endsWith('/sign-out')) {
    if (ok) log('Déconnexion', 'info')
  } else if (path.endsWith('/change-password')) {
    log(ok ? 'Mot de passe changé' : 'Mot de passe non changé', ok ? 'ok' : 'error')
  } else if (ok) {
    log('Pseudo changé', 'info', name)
  }
}

/** L'origine publique du site, que doivent avoir les requêtes qui modifient des données. */
export const appOrigin = (auth: Accounts['auth']) => new URL(auth.options.baseURL as string).origin

/**
 * Le compte dans l'API (`/api/…`) :
 * - `/api/auth/*` : Better Auth (connexion, déconnexion, session, création du compte) ;
 * - `GET /api/account` : `{ exists, user }`, si le compte existe déjà (sinon, la première visite) et
 *   qui est connecté sur ce navigateur (`null` : personne) : une seule requête au démarrage ;
 * - la macro `auth` des routes réservées au compte : 401 sans session, 403 pour une modification
 *   venue d'une autre origine (le cookie part avec toute requête vers le site), jamais en cache ;
 *   la route reçoit `user`.
 */
export function accountRoutes({ auth, account }: Accounts) {
  const origin = appOrigin(auth)
  /**
   * La session d'une requête. Renouvelée (une fois par jour d'usage), son nouveau cookie part avec
   * la réponse : sans lui, le navigateur garderait l'ancien, et il faudrait se reconnecter au bout
   * de 60 jours.
   */
  const sessionOf = async (request: Request, set: Context['set']) => {
    const { headers, response } = await auth.api.getSession({
      headers: request.headers,
      returnHeaders: true,
    })
    set.headers['set-cookie'] = headers.getSetCookie()
    return response
  }
  return new Elysia({ name: 'account' })
    .all(
      '/auth/*',
      async ({ request, status }) => {
        const path = new URL(request.url).pathname
        if (!WATCHED.test(path)) return auth.handler(request)
        // Lus avant que Better Auth ne lise la requête (une copie) ; hors connexion et création,
        // l'e-mail de la session.
        const body = await bodyOf(request.clone())
        const email = /\/sign-(in|up)\/email$/.test(path)
          ? (body.email ?? '?')
          : ((await auth.api.getSession({ headers: request.headers }))?.user.email ?? '?')
        // Une création refusée d'emblée (sans dire si une adresse est celle du compte, ni calculer
        // un mot de passe pour rien) : le compte existe, ou ce n'est pas son adresse.
        if (path.endsWith('/sign-up/email')) {
          const refused =
            account() !== null
              ? 'un compte existe déjà'
              : ACCOUNT_EMAIL && email.trim().toLowerCase() !== ACCOUNT_EMAIL
                ? 'adresse non prévue'
                : null
          if (refused) {
            journal(
              {
                topic: 'compte',
                level: 'error',
                message: 'Création refusée',
                details: { email, raison: refused },
              },
              request,
            )
            return status(403, null)
          }
        }
        const response = await auth.handler(request)
        journalAuth(path, request, response, email, body.name)
        return response
      },
      {
        // Better Auth lit lui-même la requête.
        parse: 'none',
        detail: { hide: true },
      },
    )
    .get(
      '/account',
      async ({ request, set }) => {
        set.headers['cache-control'] = 'no-store'
        const exists = account() !== null
        const session = exists ? await sessionOf(request, set) : null
        const user = session && {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        }
        return { exists, user }
      },
      {
        detail: { summary: 'Le compte existe-t-il (sinon, la première visite) ; qui est connecté' },
      },
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
          const session = await sessionOf(request, set)
          return session ? { user: session.user } : status(401, null)
        },
      },
    })
}
