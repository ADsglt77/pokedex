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
 * - Un corps de plus de 16 Ko (le site n'envoie qu'un pseudo et des mots de passe) est refusé
 *   (413, `maxBody`) avant Better Auth, qui lit tout ce qu'il reçoit.
 * - 20 mots de passe refusés par heure sur un même pseudo, d'où qu'ils viennent, qu'il ait un
 *   compte ou non (`REFUSALS`) : au-delà, sa connexion reçoit 429 (`PSEUDO_LOCKED`).
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

// `minimal` : sans Kysely (environ 500 Ko chargés à chaque démarrage), inutile ici : la base passe
// par Drizzle (`drizzleAdapter`), ses migrations aussi.
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { username, USERNAME_ERROR_CODES } from 'better-auth/plugins'
import { env, waitUntil } from 'cloudflare:workers'
import { and, eq, ne, sql } from 'drizzle-orm'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { PASSWORD_MIN, PSEUDO, PSEUDO_LOCKED } from '@/config/account'
import { isPseudo } from '@/lib/account'
import { HOUR } from '@/lib/time'
import type { AccountState } from '@/types'
import { db } from './db'
import {
  journal,
  journalOnce,
  loggable,
  reasonOf,
  safeText,
  visitorOf,
  type JournalLevel,
} from './journal'
import * as schema from './schema'

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
 * pour un même début. Sa cause (l'erreur, sa pile ; une requête SQL sans ses valeurs, `loggable`)
 * suit.
 */
function logError(message: string, ...causes: unknown[]) {
  journalOnce(`better-auth ${message.slice(0, 60)}`, {
    topic: 'serveur',
    level: 'error',
    message: 'Better Auth',
    details: { cause: message },
  })
  if (causes.length > 0) {
    console.error(
      ...causes.flatMap((cause) =>
        typeof cause === 'string' ? [safeText(cause)] : loggable(cause),
      ),
    )
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
 * l'adresse). À la création et au changement de pseudo (le seul usage de `/update-user`) : un
 * pseudo exigé (sans lui, ni connexion ni Pokédex public), et `name` qui le reprend tel que tapé :
 * une requête ne peut pas mettre autre chose dans le titre de son Pokédex public ; un pseudo qu'un
 * autre compte a quitté (`heldBy` : son compte), refusé comme un pseudo pris (la base le refuse
 * aussi, par ses déclencheurs : ce contrôle-ci donne seulement la bonne raison). À la création,
 * l'adresse sans boîte du compte. La suppression du compte exige son mot de passe (Better Auth s'en
 * passerait pour une session ouverte depuis moins d'un jour).
 */
const guard = createAuthMiddleware(async (ctx) => {
  const body = (ctx.body ?? {}) as Record<string, unknown>
  const signUp = ctx.path === '/sign-up/email'
  if (signUp || ctx.path === '/update-user') {
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
    log: (_level, message, ...args) => logError(message, ...args),
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
  // La session et son compte lus d'une seule requête (les relations de `schema.ts`). L'adresse du
  // visiteur, pour les limites (`rateLimit`) : celle que Cloudflare écrit lui-même.
  advanced: {
    database: { joins: true },
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
  },
  // En production, par visiteur : 10 tentatives de création de compte et 10 changements de pseudo
  // par heure ; 5 tentatives de connexion, de changement du mot de passe ou de suppression du
  // compte par minute ; 100 requêtes pour le reste. Comptées dans la base (`rateLimit` de
  // `schema.ts`) : chaque exemplaire du Worker les voit. `enabled` dit la production : seul, Better
  // Auth lirait `NODE_ENV` à l'exécution, que le Worker en ligne n'a pas (coupées) ; celui-ci, Vite
  // l'écrit au build. En développement et dans les tests, pas de limite. Better Auth purge la table
  // de ses lignes de plus que sa plus longue fenêtre, une heure (pas moins, ou les refus par pseudo,
  // `REFUSALS`, dans la même table, partiraient avant la fin de leur heure), mais seulement quand un
  // visiteur revient sur une même action du compte, sa fenêtre finie (`deleteExpiredRows`) : sans
  // durée maximale, des semaines peuvent passer sur un site calme (les mentions légales le disent).
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
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

/**
 * Les mots de passe refusés sur un même pseudo (décision D-03) : 20 par heure, d'où qu'ils
 * viennent (les limites de Better Auth, par visiteur, se contournent en changeant d'adresse), que
 * le pseudo ait un compte ou non : la réponse n'en dit rien. Contrepartie : un tiers peut bloquer
 * une heure la connexion à un pseudo, ce que dit le formulaire (`PSEUDO_LOCKED`). Pas coupée en
 * développement ni dans les tests.
 */
const REFUSALS = { max: 20, window: HOUR }

/**
 * La clé d'un pseudo visé dans `rateLimit` (à côté de celles de Better Auth, `<ip>|<chemin>`) : son
 * empreinte par la clé du site (HMAC), jamais le pseudo tapé, qui peut être un mot de passe tapé
 * dans le mauvais champ.
 */
async function refusalKey(pseudo: string) {
  const encoder = new TextEncoder()
  const secret = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.BETTER_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', secret, encoder.encode(pseudo))
  return `pseudo|${btoa(String.fromCharCode(...new Uint8Array(mac)))}`
}

/**
 * Réserve une place à un essai sur ce pseudo avant de le laisser à Better Auth, en une seule
 * requête : refus et essais en cours ne dépassent jamais 20 dans l'heure, même simultanés. Rend le
 * début de l'heure (`lastRequest`, que les essais suivants ne repoussent pas : le blocage tombe une
 * heure après), ou rien quand l'heure est pleine : l'essai est bloqué, sans rien écrire. La ligne
 * reste ensuite jusqu'à une purge de Better Auth (plus haut).
 */
function reserveAttempt(key: string) {
  const now = Date.now()
  const { count, lastRequest } = schema.rateLimit
  const ended = sql`${lastRequest} <= ${now - REFUSALS.window}`
  return db
    .insert(schema.rateLimit)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: {
        count: sql`CASE WHEN ${ended} THEN 1 ELSE ${count} + 1 END`,
        lastRequest: sql`CASE WHEN ${ended} THEN ${now} ELSE ${lastRequest} END`,
      },
      setWhere: sql`${ended} OR ${count} < ${REFUSALS.max}`,
    })
    .returning({ since: lastRequest })
    .get()
}

/**
 * Rend sa place à un essai qui n'était pas un refus, dans son heure seulement (`since`) : une
 * heure neuve ne la reprend pas, et le compteur ne passe jamais sous zéro. Plus rien de compté :
 * l'heure se referme (`lastRequest` à 0), un essai qui n'était pas un refus ne l'ouvre donc pas, et
 * `Retry-After` ne dit rien de lui (une connexion réussie, par exemple).
 */
function releaseAttempt(key: string, since: number) {
  const { count, lastRequest } = schema.rateLimit
  return db
    .update(schema.rateLimit)
    .set({
      count: sql`${count} - 1`,
      lastRequest: sql`CASE WHEN ${count} = 1 THEN 0 ELSE ${lastRequest} END`,
    })
    .where(and(eq(schema.rateLimit.key, key), eq(lastRequest, since)))
    .run()
}

/**
 * Une connexion, sous la limite des refus de son pseudo. Seul un refus (401 : pseudo ou mot de
 * passe faux) garde sa place : une connexion réussie, une requête mal formée, la limite de Better
 * Auth ou une panne la rendent, sans quoi un seul visiteur bloquerait un pseudo en quelques
 * secondes. Au repos, le compteur vaut donc les refus de l'heure ; pendant une rafale, les essais
 * en cours y comptent aussi : un vrai essai peut recevoir 429 le temps qu'elle passe, pas après.
 * Heure pleine : 429 sans même lire le mot de passe, jamais en cache, avec le temps à attendre.
 */
async function countedSignIn(request: Request, pseudo: string) {
  const key = await refusalKey(pseudo)
  const reserved = await reserveAttempt(key)
  if (!reserved) {
    const row = await db
      .select({ since: schema.rateLimit.lastRequest })
      .from(schema.rateLimit)
      .where(eq(schema.rateLimit.key, key))
      .get()
    const wait = Math.ceil(((row?.since ?? 0) + REFUSALS.window - Date.now()) / 1000)
    return Response.json(
      { code: PSEUDO_LOCKED, message: 'Trop de mots de passe refusés pour ce pseudo' },
      {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(Math.max(wait, 1)) },
      },
    )
  }
  let response: Response | undefined
  try {
    response = await auth.handler(request)
    return response
  } finally {
    // Une panne de la base en rendant la place ne change pas la réponse (une connexion réussie le
    // reste) : la place reste comptée, comme un refus, jusqu'à la fin de l'heure, et le journal le
    // dit.
    if (response?.status !== 401) {
      await releaseAttempt(key, reserved.since).catch((error: unknown) =>
        journalOnce('Place non rendue', {
          topic: 'serveur',
          level: 'error',
          message: 'Essai de connexion non rendu',
          details: { cause: reasonOf(error) },
        }),
      )
    }
  }
}

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
  )
  return c.body(null, 403, { 'Cache-Control': 'no-store' })
}

/**
 * Un corps de plus de `maxSize` octets : 413 sans corps, jamais en cache, sans le lire plus loin
 * (sa taille annoncée suffit ; envoyé en flux, il n'est lu que jusqu'au plafond). Cloudflare en
 * accepte jusqu'à 100 Mo : lu en entier, un seul ferait dépasser ses 128 Mo à l'exemplaire du
 * Worker, et couperait avec lui les requêtes des autres visiteurs.
 */
export const maxBody = (maxSize: number) =>
  bodyLimit({ maxSize, onError: (c) => c.body(null, 413, { 'Cache-Control': 'no-store' }) })

/**
 * La session d'une requête, et sa réponse jamais en cache. Renouvelée (une fois par jour d'usage),
 * son nouveau cookie part avec la réponse : sans lui, le navigateur garderait l'ancien, et il
 * faudrait se reconnecter au bout de 60 jours.
 */
async function sessionOf(c: Context) {
  c.header('Cache-Control', 'no-store')
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
  .all('/auth/*', maxBody(16 * 1024), async (c) => {
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
    // Un pseudo invalide n'est pas compté (rien d'écrit) : Better Auth le refuse (422) sans
    // comparer de mot de passe. Une connexion comptée va jusqu'au bout même si le client coupe
    // (`waitUntil`, 30 s au plus) : sa place est toujours rendue ou gardée.
    const counted =
      typed !== undefined && isPseudo(typed) && path.endsWith('/sign-in/username')
        ? countedSignIn(request, typed)
        : undefined
    // Son échec, `await` le rend déjà (500, `index.ts`) : pas une seconde fois au journal du runtime.
    if (counted) waitUntil(counted.catch(() => {}))
    const response = await (counted ?? auth.handler(request))
    journalAuth(path, request, response, pseudo, typed)
    return response
  })
  .get('/account', async (c) => {
    const session = await sessionOf(c)
    return c.json<AccountState>({
      user: session && { id: session.user.id, name: session.user.name },
    })
  })
