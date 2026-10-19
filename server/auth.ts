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
import { MINUTE } from '@/lib/time'
import type { AccountState } from '@/types'
import { journal, journalOnce, safeText, visitorOf, type JournalLevel } from './journal'

/** Un jour, en secondes (Better Auth compte ses durées en secondes ; `@/lib/time` en ms). */
const DAY_IN_SECONDS = 24 * 60 * 60

/** L'adresse du compte (`ACCOUNT_EMAIL`) : aucune autre ne peut le créer. */
const ACCOUNT_EMAIL = process.env.ACCOUNT_EMAIL?.trim().toLowerCase()

/** La connexion, une fois créées les tables du compte qui manquent. */
export async function createAuth(db: Database) {
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true },
    // Ses messages dans le journal de l'app, ses erreurs seulement : une connexion refusée y est
    // déjà (« Invalid password » en plus serait du bruit). Son message peut recopier ce qu'envoie
    // un visiteur (« Invalid callbackURL: … ») : écrit en détail, échappé, une fois par minute au
    // plus pour un même début. Leur cause (l'erreur, sa pile) suit.
    logger: {
      level: 'error',
      log: (_level, message, ...args) => {
        const cause = String(message)
        journalOnce(
          `better-auth ${cause.slice(0, 60)}`,
          { topic: 'serveur', level: 'error', message: 'Better Auth', details: { cause } },
          undefined,
          MINUTE,
        )
        if (args.length > 0) {
          console.error(...args.map((arg) => (typeof arg === 'string' ? safeText(arg) : arg)))
        }
      },
    },
    session: { expiresIn: 60 * DAY_IN_SECONDS, updateAge: DAY_IN_SECONDS },
    databaseHooks: {
      user: {
        create: {
          // La garde de `/sign-up/email` (plus bas) lit la requête à sa façon ; celle-ci porte sur
          // l'adresse que Better Auth enregistre vraiment : une requête qu'ils liraient chacun
          // autrement ne crée pas le compte d'un autre.
          before: async (user) =>
            !ACCOUNT_EMAIL || user.email.trim().toLowerCase() === ACCOUNT_EMAIL,
        },
      },
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

/** L'e-mail et le pseudo d'une requête (une copie), pour le journal (jamais le mot de passe). */
async function bodyOf(request: { json: () => Promise<unknown> }) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    name?: unknown
  } | null
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined)
  return { email: text(body?.email), name: text(body?.name) }
}

/**
 * Un e-mail pour le journal : tel quel s'il en a l'air (une arobase), sinon `?` : un mot de passe
 * collé par erreur dans le champ de l'e-mail n'y est jamais écrit.
 */
const shownEmail = (email: string) => (email.includes('@') ? email : '?')

/** Les actions du compte que note le journal, d'après leur chemin. */
const WATCHED = /\/(sign-in\/email|sign-up\/email|sign-out|change-password|update-user)$/

/**
 * Pour le journal : connexion, création du compte, déconnexion, mot de passe, pseudo. Une
 * connexion refusée ou bloquée, qu'un visiteur peut répéter à volonté : une ligne par visiteur et
 * par minute au plus (`journalOnce`).
 */
function journalAuth(
  path: string,
  request: Request,
  response: Response,
  email: string,
  name?: string,
) {
  const ok = response.ok
  const details = (pseudo?: string, raison?: string) => ({ email, pseudo, raison })
  const log = (message: string, level: JournalLevel, pseudo?: string) =>
    journal({ topic: 'compte', level, message, details: details(pseudo) }, request)
  const refused = (message: string, raison?: string) =>
    journalOnce(
      `${message} ${visitorOf(request)}`,
      { topic: 'compte', level: 'error', message, details: details(undefined, raison) },
      request,
      MINUTE,
    )
  if (path.endsWith('/sign-in/email')) {
    if (ok) log('Connexion', 'ok')
    else if (response.status === 429) refused('Connexion bloquée', 'trop d’essais')
    else refused('Connexion refusée')
  } else if (path.endsWith('/sign-up/email')) {
    if (ok) log('Compte créé', 'ok', name)
    else refused('Création du compte refusée')
  } else if (path.endsWith('/sign-out')) {
    if (ok) log('Déconnexion', 'info')
  } else if (path.endsWith('/change-password')) {
    log(ok ? 'Mot de passe changé' : 'Mot de passe non changé', ok ? 'ok' : 'error')
  } else if (ok) {
    log('Pseudo changé', 'info', name)
  }
}

/** Les créations refusées d'emblée de chaque visiteur, la dernière minute (leurs heures, en ms). */
const refusals = new Map<string, number[]>()

/**
 * Une création refusée de plus pour ce visiteur : au-delà de 5 par minute, `true` (429), comme la
 * limite de Better Auth pour une création qu'il traite. Un refus d'emblée ne passe pas par elle :
 * on pourrait sinon essayer des adresses sans fin pour trouver celle du compte.
 */
function tooManyRefusals(visitor: string, now: number) {
  const recent = (refusals.get(visitor) ?? []).filter((at) => now - at < MINUTE)
  recent.push(now)
  refusals.delete(visitor)
  refusals.set(visitor, recent)
  // Une liste bornée : les plus anciens visiteurs d'abord.
  for (const oldest of refusals.keys()) {
    if (refusals.size <= 10_000) break
    refusals.delete(oldest)
  }
  return recent.length > 5
}

/**
 * Une modification venue d'une autre origine (le cookie part avec toute requête vers le site) :
 * refusée dès la lecture du corps, avant même de le lire (`parse` de la macro `auth`), puis
 * répondue 403 par `app.ts`.
 */
export class ForeignOrigin extends Error {}

/** L'origine publique du site, que doivent avoir les requêtes qui modifient des données. */
export const appOrigin = (auth: Accounts['auth']) => new URL(auth.options.baseURL as string).origin

/**
 * Le compte dans l'API (`/api/…`) :
 * - `/api/auth/*` : Better Auth (connexion, déconnexion, session, création du compte) ;
 * - `GET /api/account` : `AccountState`, si le compte existe déjà (sinon, la première visite) et
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
  /**
   * Une modification venue d'une autre origine : notée au journal (une fois par minute et par
   * visiteur), où elle dit un réglage à revoir (`BETTER_AUTH_URL` qui n'est pas l'adresse du site)
   * ou une tentative depuis un autre site.
   */
  const foreign = (request: Request) => {
    if (['GET', 'HEAD'].includes(request.method)) return false
    const received = request.headers.get('origin')
    if (received === origin) return false
    journalOnce(
      `Origine refusée ${visitorOf(request)}`,
      {
        topic: 'compte',
        level: 'warn',
        message: 'Modification refusée',
        details: {
          route: `${request.method} ${new URL(request.url).pathname}`,
          origine: received ?? 'aucune',
          raison: 'autre origine',
        },
      },
      request,
      MINUTE,
    )
    return true
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
          ? shownEmail(body.email ?? '?')
          : ((await auth.api.getSession({ headers: request.headers }))?.user.email ?? '?')
        // Une création refusée d'emblée (sans dire si une adresse est celle du compte, ni calculer
        // un mot de passe pour rien) : le compte existe, ce n'est pas son adresse, ou la requête
        // n'est pas en JSON (Better Auth lirait aussi un formulaire, autrement que cette garde).
        if (path.endsWith('/sign-up/email')) {
          const json = /^application\/json\b/i.test(request.headers.get('content-type') ?? '')
          const refused =
            account() !== null
              ? 'un compte existe déjà'
              : !json
                ? 'pas en JSON'
                : ACCOUNT_EMAIL && (body.email ?? '').trim().toLowerCase() !== ACCOUNT_EMAIL
                  ? 'adresse non prévue'
                  : null
          if (refused) {
            journalOnce(
              `Création refusée ${visitorOf(request)}`,
              {
                topic: 'compte',
                level: 'error',
                message: 'Création refusée',
                details: { email, raison: refused },
              },
              request,
              MINUTE,
            )
            return status(tooManyRefusals(visitorOf(request), Date.now()) ? 429 : 403, null)
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
      async ({ request, set }): Promise<AccountState> => {
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
        // Avant de lire le corps (jusqu'à 5 Mo) et de le valider : une autre origine est refusée
        // d'emblée (`ForeignOrigin`, 403), sans un 422 qui renverrait ce qu'elle a envoyé.
        parse({ request }) {
          if (foreign(request)) throw new ForeignOrigin()
        },
        async resolve({ request, set, status }) {
          set.headers['cache-control'] = 'no-store'
          if (foreign(request)) return status(403, null)
          const session = await sessionOf(request, set)
          return session ? { user: session.user } : status(401, null)
        },
      },
    })
}
