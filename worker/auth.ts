/**
 * La connexion (Better Auth) : un compte par personne, par pseudo et mot de passe, dans la base du
 * site (D1, `schema.ts`, par Drizzle).
 * - Chacun crée le sien (`/inscription`) : un pseudo (`PSEUDO`, `src/config/account.ts`), unique
 *   sans tenir compte des majuscules, et un mot de passe. Le pseudo est gardé deux fois, d'accord
 *   (`guard`) : `name` tel que tapé (« Le Pokédex de Sacha »), `username` en minuscules (le plugin
 *   `username` : la connexion, l'adresse du Pokédex public `/sacha`). Pas d'e-mail : le site n'en
 *   envoie pas et n'en garde pas (Better Auth en exige une : chaque compte reçoit une adresse sans
 *   boîte, `<uuid>@pokedex.invalid`, que personne ne connaît) ; pas de mot de passe oublié, donc.
 * - Le pseudo et le mot de passe se changent dans l'app (Réglages › Compte & partage › Mon
 *   compte) ; le compte s'y supprime, avec son mot de passe, et sa collection part avec lui (en
 *   cascade, `collections` de `schema.ts`). Les derniers pseudos qu'un compte a
 *   quittés (changés, ou compte supprimé) ne sont jamais repris par un autre (les déclencheurs de
 *   `migrations/0001_pseudos.sql`) : un lien partagé vers `/pseudo` ne mène jamais au Pokédex d'un
 *   autre. Les adresses du site (`RESERVED_PSEUDOS`) ne sont à personne.
 * - Une modification venue d'une autre origine est refusée (403, `sameOrigin`) : un autre site ne
 *   connecte pas un visiteur à un compte qu'il ne connaît pas.
 * - Une seule session par compte : se connecter sur un appareil déconnecte ses autres. La
 *   collection n'est donc modifiée que d'un appareil à la fois.
 * Sessions de 60 jours, renouvelées chaque jour d'usage, dans un cookie (`__Secure-`, SameSite
 * Lax, en https) : le cookie renouvelé repart avec la réponse de `/api/account` et des routes du
 * compte (`sessionOf`, `signedIn`).
 *
 * `BETTER_AUTH_URL` : l'adresse publique du site (`wrangler.jsonc` ; en développement, celle de
 * Vite, http://localhost:5173, dans `.env`), jamais devinée de la requête ; `BETTER_AUTH_SECRET` :
 * la clé qui signe les cookies (un secret du Worker ; `.env` en développement). Vérifiées au
 * chargement du Worker : en production, un Worker mal réglé ne démarre pas.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { username, USERNAME_ERROR_CODES } from 'better-auth/plugins'
import { env } from 'cloudflare:workers'
import { and, eq, ne } from 'drizzle-orm'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { PASSWORD_MIN, PSEUDO } from '@/config/account'
import { isPseudo } from '@/lib/account'
import { MINUTE } from '@/lib/time'
import type { AccountState } from '@/types'
import { db } from './db'
import { journal, journalOnce, reasonOf, safeText, visitorOf, type JournalLevel } from './journal'
import * as schema from './schema'

if (!env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL manque : l’adresse publique du site (voir worker/auth.ts)')
}
if (process.env.NODE_ENV === 'production') {
  // En http, les cookies ne seraient plus réservés au https, et l'origine attendue ne serait pas
  // celle du site : chaque modification serait refusée (403). Sauf sur ce poste : `bun run
  // preview`, le site construit, à l'adresse de Vite (`.env`).
  if (!/^(https:\/\/|http:\/\/localhost:)/.test(env.BETTER_AUTH_URL)) {
    throw new Error('BETTER_AUTH_URL doit être en https en production (voir worker/auth.ts)')
  }
  // Une clé courte se devine : `openssl rand -base64 32` en donne une de 44 caractères.
  if ((env.BETTER_AUTH_SECRET ?? '').length < 32) {
    throw new Error('BETTER_AUTH_SECRET trop courte : 32 caractères au moins (voir worker/auth.ts)')
  }
}

/** L'origine publique du site, que doivent avoir les requêtes qui modifient des données. */
export const ORIGIN = new URL(env.BETTER_AUTH_URL).origin

/** Un jour, en secondes (Better Auth compte ses durées en secondes ; `@/lib/time` en ms). */
const DAY_IN_SECONDS = 24 * 60 * 60

/**
 * Une erreur de Better Auth dans le journal du site. Son message peut recopier ce qu'envoie un
 * visiteur (« Invalid callbackURL: … ») : écrit en détail, échappé, une fois par minute au plus
 * pour un même début. Sa cause (l'erreur, sa pile) suit.
 */
function logError(message: string, ...causes: unknown[]) {
  journalOnce(
    `better-auth ${message.slice(0, 60)}`,
    { topic: 'serveur', level: 'error', message: 'Better Auth', details: { cause: message } },
    undefined,
    MINUTE,
  )
  if (causes.length > 0) {
    console.error(...causes.map((cause) => (typeof cause === 'string' ? safeText(cause) : cause)))
  }
}

/** Le compte qui a quitté ce pseudo (`releasedPseudos`), s'il y en a un. */
const heldBy = async (pseudo: string) =>
  (
    await db
      .select({ userId: schema.releasedPseudos.userId })
      .from(schema.releasedPseudos)
      .where(eq(schema.releasedPseudos.username, pseudo))
      .get()
  )?.userId ?? null

/**
 * Avant Better Auth, sur le chemin qu'il a reconnu (`ctx.path`, quelle que soit l'écriture de
 * l'adresse). À la création et au changement de pseudo : un pseudo exigé (sans lui, ni connexion ni
 * Pokédex public), et `name` qui le reprend tel que tapé : une requête ne peut pas mettre autre
 * chose dans le titre de son Pokédex public ; un pseudo qu'un autre compte a quitté (`heldBy` : son
 * compte), refusé comme un pseudo pris (la base le refuse aussi, par ses déclencheurs : ce
 * contrôle-ci donne seulement la bonne raison). À la création, l'adresse sans boîte du compte. La
 * suppression du compte exige son mot de passe (Better Auth s'en passerait pour une session ouverte
 * depuis moins d'un jour).
 */
const guard = createAuthMiddleware(async (ctx) => {
  const body = (ctx.body ?? {}) as Record<string, unknown>
  const signUp = ctx.path === '/sign-up/email'
  if (signUp || (ctx.path === '/update-user' && ('name' in body || 'username' in body))) {
    if (typeof body.username !== 'string') {
      throw new APIError('BAD_REQUEST', { message: 'Pseudo manquant' })
    }
    const holder = await heldBy(body.username.toLowerCase())
    if (holder !== null && (signUp || holder !== (await getSessionFromCtx(ctx))?.user.id)) {
      throw APIError.from('BAD_REQUEST', USERNAME_ERROR_CODES.USERNAME_IS_ALREADY_TAKEN)
    }
    const email = signUp ? { email: `${crypto.randomUUID()}@pokedex.invalid` } : {}
    return { context: { body: { ...body, name: body.username, ...email } } }
  }
  if (ctx.path === '/delete-user' && !body.password) {
    throw new APIError('BAD_REQUEST', { message: 'Mot de passe manquant' })
  }
})

/** Better Auth (exporté pour les tests, qui simulent une panne de la session). */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, minPasswordLength: PASSWORD_MIN },
  // Personne ne connaît les adresses des comptes : la connexion se fait par le pseudo.
  disabledPaths: ['/sign-in/email'],
  plugins: [
    username({
      minUsernameLength: PSEUDO.min,
      maxUsernameLength: PSEUDO.max,
      usernameValidator: isPseudo,
      displayUsername: false,
    }),
  ],
  hooks: { before: guard },
  // Rien ne reste du compte supprimé, que son pseudo, réservé (les déclencheurs) : sa collection
  // part avec lui (en cascade).
  user: { deleteUser: { enabled: true } },
  // Ses messages dans le journal du site, ses erreurs seulement : une connexion refusée y est
  // déjà (« Invalid password » en plus serait du bruit).
  logger: {
    level: 'error',
    log: (_level, message, ...args) => logError(String(message), ...args),
  },
  // Ses refus (pseudo pris, mot de passe faux…) aussi : `journalAuth` les note déjà. Une erreur
  // imprévue, si.
  onAPIError: {
    onError: (error) => {
      if (isAPIError(error) && error.status !== 'INTERNAL_SERVER_ERROR') return
      logError(reasonOf(error), error)
    },
  },
  session: { expiresIn: 60 * DAY_IN_SECONDS, updateAge: DAY_IN_SECONDS },
  databaseHooks: {
    session: {
      create: {
        // Une seule session par compte : ses autres appareils sont déconnectés (et, au
        // changement du mot de passe, l'ancienne session de celui-ci).
        after: async (created) => {
          const { meta } = await db
            .delete(schema.session)
            .where(
              and(eq(schema.session.userId, created.userId), ne(schema.session.id, created.id)),
            )
            .run()
          if (meta.changes > 0) {
            journal({ topic: 'compte', level: 'warn', message: 'Ancienne session fermée' })
          }
        },
      },
    },
  },
  // L'adresse du visiteur, pour les limites (`rateLimit`) : celle que Cloudflare écrit lui-même.
  advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
  // En production, par visiteur : 10 tentatives de création de compte et 10 changements de pseudo
  // par heure ; 5 tentatives de connexion, de changement du mot de passe ou de suppression du
  // compte par minute ; 100 requêtes pour le reste. Comptées dans la base (`rateLimit` de
  // `schema.ts`) : chaque exemplaire du Worker les voit.
  rateLimit: {
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/username': { window: 60, max: 5 },
      '/sign-up/email': { window: 60 * 60, max: 10 },
      '/update-user': { window: 60 * 60, max: 10 },
      '/change-password': { window: 60, max: 5 },
      '/delete-user': { window: 60, max: 5 },
    },
  },
} satisfies BetterAuthOptions)

/** Le pseudo tapé dans une requête (une copie), pour le journal (jamais le mot de passe). */
async function typedPseudo(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: unknown } | null
  return typeof body?.username === 'string' ? body.username.toLowerCase() : undefined
}

/** Les actions du compte que note le journal, d'après leur chemin. */
const WATCHED =
  /\/(sign-in\/username|sign-up\/email|sign-out|change-password|update-user|delete-user)$/

/**
 * Pour le journal : connexion, création du compte, déconnexion, mot de passe, pseudo, suppression.
 * `pseudo` : celui de la session ; `typed` : celui de la requête, écrit seulement s'il est accepté
 * (un mot de passe tapé par erreur dans le champ du pseudo n'est jamais écrit). Un refus, qu'un
 * visiteur peut répéter à volonté : une ligne par visiteur et par minute au plus (`journalOnce`).
 */
function journalAuth(
  path: string,
  request: Request,
  response: Response,
  pseudo: string | undefined,
  typed: string | undefined,
) {
  const ok = response.ok
  const log = (message: string, level: JournalLevel, details: Record<string, string | undefined>) =>
    journal({ topic: 'compte', level, message, details }, request)
  const refused = (message: string) =>
    journalOnce(
      `${message} ${visitorOf(request)}`,
      {
        topic: 'compte',
        level: 'error',
        message,
        details: { raison: response.status === 429 ? 'trop d’essais' : undefined },
      },
      request,
      MINUTE,
    )
  if (path.endsWith('/sign-in/username')) {
    if (ok) log('Connexion', 'ok', { pseudo: typed })
    else refused(response.status === 429 ? 'Connexion bloquée' : 'Connexion refusée')
  } else if (path.endsWith('/sign-up/email')) {
    if (ok) log('Compte créé', 'ok', { pseudo: typed })
    else refused(response.status === 429 ? 'Création bloquée' : 'Création refusée')
  } else if (path.endsWith('/sign-out')) {
    if (ok) log('Déconnexion', 'info', { pseudo })
  } else if (path.endsWith('/change-password')) {
    log(ok ? 'Mot de passe changé' : 'Mot de passe non changé', ok ? 'ok' : 'error', { pseudo })
  } else if (path.endsWith('/delete-user')) {
    log(ok ? 'Compte supprimé' : 'Compte non supprimé', ok ? 'warn' : 'error', { pseudo })
  } else if (ok) {
    log('Pseudo changé', 'info', { pseudo, nouveau: typed })
  }
}

/**
 * Une modification (ni `GET` ni `HEAD`) venue d'une autre origine (le cookie part avec toute
 * requête vers le site) : 403 sans corps, avant la recherche de la route et la lecture du corps,
 * et notée au journal (une fois par minute et par visiteur), où elle dit un réglage à revoir
 * (`BETTER_AUTH_URL` qui n'est pas l'adresse du site) ou une tentative depuis un autre site. Pour
 * toute l'API (`index.ts`), une adresse inconnue aussi.
 */
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  const { method, url } = c.req.raw
  const received = c.req.header('origin')
  if (['GET', 'HEAD'].includes(method) || received === ORIGIN) return next()
  journalOnce(
    `Origine refusée ${visitorOf(c.req.raw)}`,
    {
      topic: 'compte',
      level: 'warn',
      message: 'Modification refusée',
      details: {
        route: `${method} ${new URL(url).pathname}`,
        origine: received ?? 'aucune',
        raison: 'autre origine',
      },
    },
    c.req.raw,
    MINUTE,
  )
  return c.body(null, 403, { 'Cache-Control': 'no-store' })
}

/**
 * La session d'une requête. Renouvelée (une fois par jour d'usage), son nouveau cookie part avec
 * la réponse : sans lui, le navigateur garderait l'ancien, et il faudrait se reconnecter au bout
 * de 60 jours.
 */
async function sessionOf(c: Context) {
  const { headers, response } = await auth.api.getSession({
    headers: c.req.raw.headers,
    returnHeaders: true,
  })
  for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true })
  return response
}

/** Ce que reçoit une route réservée au compte (`signedIn`) : le compte connecté. */
export interface SignedIn {
  Variables: { user: typeof auth.$Infer.Session.user }
}

/**
 * Les routes réservées au compte : 401 sans session, jamais en cache ; la route reçoit le compte
 * (`c.var.user`). La session est lue avant le corps : sans elle, rien n'est lu ni décompressé.
 * Une panne en la lisant (la base…) : 500 (`index.ts`), jamais un 401 qui dirait la session
 * fermée.
 */
export const signedIn = createMiddleware<SignedIn>(async (c, next) => {
  c.header('Cache-Control', 'no-store')
  const session = await sessionOf(c)
  if (!session) return c.json(null, 401)
  c.set('user', session.user)
  await next()
})

/**
 * Le compte dans l'API (`/api/…`) :
 * - `/api/auth/*` : Better Auth (création du compte, connexion, déconnexion, session, pseudo, mot
 *   de passe, suppression) ;
 * - `GET /api/account` : `AccountState`, qui est connecté sur ce navigateur (`null` : personne) :
 *   une seule requête au démarrage.
 */
export const accountRoutes = new Hono()
  .all('/auth/*', async (c) => {
    const request = c.req.raw
    // Pour le journal, l'adresse comme la lit Better Auth (« /update-user/ » aussi).
    const path = new URL(request.url).pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')
    if (!WATCHED.test(path)) return auth.handler(request)
    // Lus avant que Better Auth ne lise la requête (une copie, et la session d'avant : celle
    // d'un compte qui se supprime n'existe plus après).
    const typed = await typedPseudo(request.clone())
    const user = /\/sign-(in\/username|up\/email)$/.test(path)
      ? undefined
      : (await auth.api.getSession({ headers: request.headers }))?.user
    const pseudo = user?.username ?? undefined
    const response = await auth.handler(request)
    journalAuth(path, request, response, pseudo, typed)
    return response
  })
  .get('/account', async (c) => {
    c.header('Cache-Control', 'no-store')
    const session = await sessionOf(c)
    return c.json<AccountState>({
      user: session && { id: session.user.id, name: session.user.name },
    })
  })
