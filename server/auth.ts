/**
 * La connexion (Better Auth) : un compte par personne, par pseudo et mot de passe, dans `app.db`.
 * - Chacun crée le sien (`/inscription`) : un pseudo (`PSEUDO`, `src/config/account.ts`), unique
 *   sans tenir compte des majuscules, et un mot de passe. Le pseudo est gardé deux fois, d'accord
 *   (`guard`) : `name` tel que tapé (« Le Pokédex de Sacha »), `username` en minuscules (le plugin
 *   `username` : la connexion, l'adresse du Pokédex public `/sacha`). Pas d'e-mail : le site n'en
 *   envoie pas et n'en garde pas (Better Auth en exige une : chaque compte reçoit une adresse sans
 *   boîte, `<uuid>@pokedex.invalid`, que personne ne connaît) ; pas de mot de passe oublié, donc.
 * - Le pseudo et le mot de passe se changent dans l'app (Données › Mon compte) ; le compte s'y
 *   supprime, avec son mot de passe, et sa collection part avec lui. Les derniers pseudos qu'un
 *   compte a quittés (changés, ou compte supprimé) ne sont jamais repris par un autre
 *   (`PSEUDO_TRIGGERS`) : un lien partagé vers `/pseudo` ne mène jamais au Pokédex d'un autre. Les
 *   adresses du site (`RESERVED_PSEUDOS`) ne sont à personne.
 * - Une modification du compte venue d'une autre origine est refusée (403) : un autre site ne
 *   connecte pas un visiteur à un compte qu'il ne connaît pas.
 * - Une seule session par compte : se connecter sur un appareil déconnecte ses autres. La
 *   collection n'est donc modifiée que d'un appareil à la fois.
 * Sessions de 60 jours, renouvelées chaque jour d'usage, dans un cookie (`__Secure-`, SameSite
 * Lax, en https) : le cookie renouvelé repart avec la réponse de `/api/account` et des routes du
 * compte (`sessionOf`).
 *
 * `BETTER_AUTH_URL` : l'adresse publique du site (en développement, celle de Vite :
 * http://localhost:5173), jamais devinée de la requête ; `BETTER_AUTH_SECRET` : la clé qui signe
 * les cookies (`openssl rand -base64 32`). Les deux sont exigées en production.
 */

import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { getMigrations } from 'better-auth/db/migration'
import { username, USERNAME_ERROR_CODES } from 'better-auth/plugins'
import type { Database } from 'bun:sqlite'
import { Elysia, type Context } from 'elysia'
import { PASSWORD_MIN, PSEUDO } from '@/config/account'
import { isPseudo } from '@/lib/account'
import { MINUTE } from '@/lib/time'
import type { AccountState } from '@/types'
import { journal, journalOnce, reasonOf, safeText, visitorOf, type JournalLevel } from './journal'

/** Un jour, en secondes (Better Auth compte ses durées en secondes ; `@/lib/time` en ms). */
const DAY_IN_SECONDS = 24 * 60 * 60

/**
 * Une erreur de Better Auth dans le journal de l'app. Son message peut recopier ce qu'envoie un
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

/** Les derniers pseudos quittés que chaque compte garde réservés (`PSEUDO_TRIGGERS`). */
const KEPT_PSEUDOS = 3

/**
 * Un pseudo quitté (`OLD`, changé ou compte supprimé) : réservé à son compte, qui n'en garde que
 * ses `KEPT_PSEUDOS` derniers.
 */
const RELEASE = `
    INSERT OR REPLACE INTO released_pseudos (username, user_id, released_at)
      VALUES (OLD.username, OLD.id, strftime('%Y-%m-%dT%H:%M:%f', 'now'));
    DELETE FROM released_pseudos WHERE user_id = OLD.id AND username NOT IN (
      SELECT username FROM released_pseudos WHERE user_id = OLD.id
      ORDER BY released_at DESC LIMIT ${KEPT_PSEUDOS});`

/**
 * Les pseudos quittés, gardés par la base elle-même, d'un seul tenant avec le changement de pseudo
 * ou la suppression du compte (deux requêtes ensemble ne passent pas entre un contrôle et
 * l'écriture) : un pseudo quitté reste réservé à son compte, qui peut le reprendre ; un autre
 * compte qui le prendrait est refusé. Un compte n'en garde que ses `KEPT_PSEUDOS` derniers :
 * changer de pseudo sans fin n'en réserve pas autant. Sur la table de Better Auth : posés après
 * qu'il l'a créée.
 */
const PSEUDO_TRIGGERS = `
  CREATE TRIGGER IF NOT EXISTS pseudo_reserved_on_insert BEFORE INSERT ON "user"
  WHEN NEW.username IN (SELECT username FROM released_pseudos)
  BEGIN SELECT RAISE(ABORT, 'pseudo réservé'); END;

  CREATE TRIGGER IF NOT EXISTS pseudo_reserved_on_update BEFORE UPDATE OF username ON "user"
  WHEN EXISTS (SELECT 1 FROM released_pseudos WHERE username = NEW.username AND user_id != NEW.id)
  BEGIN SELECT RAISE(ABORT, 'pseudo réservé'); END;

  CREATE TRIGGER IF NOT EXISTS pseudo_released_on_update AFTER UPDATE OF username ON "user"
  WHEN OLD.username IS NOT NULL AND OLD.username IS NOT NEW.username
  BEGIN
    DELETE FROM released_pseudos WHERE username = NEW.username;${RELEASE}
  END;

  CREATE TRIGGER IF NOT EXISTS pseudo_released_on_delete AFTER DELETE ON "user"
  WHEN OLD.username IS NOT NULL
  BEGIN${RELEASE}
  END;
`

/**
 * Avant Better Auth, sur le chemin qu'il a reconnu (`ctx.path`, quelle que soit l'écriture de
 * l'adresse). À la création et au changement de pseudo : un pseudo exigé (sans lui, ni connexion ni
 * Pokédex public), et `name` qui le reprend tel que tapé : une requête ne peut pas mettre autre
 * chose dans le titre de son Pokédex public ; un pseudo qu'un autre compte a quitté (`heldBy` : son
 * compte), refusé comme un pseudo pris (la base le refuse aussi, `PSEUDO_TRIGGERS` : ce contrôle-ci
 * donne seulement la bonne raison). À la création, l'adresse sans boîte du compte. La suppression
 * du compte exige son mot de passe (Better Auth s'en passerait pour une session ouverte depuis
 * moins d'un jour).
 */
const guard = (heldBy: (pseudo: string) => string | null) =>
  createAuthMiddleware(async (ctx) => {
    const body = (ctx.body ?? {}) as Record<string, unknown>
    const signUp = ctx.path === '/sign-up/email'
    if (signUp || (ctx.path === '/update-user' && ('name' in body || 'username' in body))) {
      if (typeof body.username !== 'string') {
        throw new APIError('BAD_REQUEST', { message: 'Pseudo manquant' })
      }
      const holder = heldBy(body.username.toLowerCase())
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

/** La connexion, une fois créées les tables du compte qui manquent. */
export async function createAuth(db: Database) {
  const holder = db.query('SELECT user_id FROM released_pseudos WHERE username = ?')
  const heldBy = (pseudo: string) =>
    (holder.get(pseudo) as { user_id: string } | null)?.user_id ?? null
  const options = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
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
    hooks: { before: guard(heldBy) },
    user: {
      deleteUser: {
        enabled: true,
        // Rien ne reste du compte sur le serveur (hors des sauvegardes, 90 jours au plus), que son
        // pseudo, réservé (`PSEUDO_TRIGGERS`).
        afterDelete: async (user) => {
          db.query('DELETE FROM collections WHERE user_id = ?').run(user.id)
          db.query('DELETE FROM collection_versions WHERE user_id = ?').run(user.id)
        },
      },
    },
    // Ses messages dans le journal de l'app, ses erreurs seulement : une connexion refusée y est
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
    // visiteur est dans cet en-tête : les limites valent pour lui, pas pour le tunnel.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // En production, par visiteur : 10 tentatives de création de compte et 10 changements de pseudo
    // par heure ; 5 tentatives de connexion, de changement du mot de passe ou de suppression du
    // compte par minute ; 100 requêtes pour le reste.
    rateLimit: {
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
  } satisfies BetterAuthOptions
  await (await getMigrations(options)).runMigrations()
  db.exec(PSEUDO_TRIGGERS)

  const count = db.query('SELECT COUNT(*) AS count FROM "user"')
  return {
    auth: betterAuth(options),
    /** L'origine publique du site, que doivent avoir les requêtes qui modifient des données. */
    origin: new URL(options.baseURL!).origin,
    /** Le nombre de comptes (le journal du démarrage). */
    count: () => (count.get() as { count: number }).count,
  }
}

export type Accounts = Awaited<ReturnType<typeof createAuth>>

/** Le pseudo tapé dans une requête (une copie), pour le journal (jamais le mot de passe). */
async function typedPseudo(request: { json: () => Promise<unknown> }) {
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
 * Une modification venue d'une autre origine (le cookie part avec toute requête vers le site) :
 * refusée dès la lecture du corps, avant même de le lire (`parse` de la macro `auth`), puis
 * répondue 403 par `app.ts`.
 */
export class ForeignOrigin extends Error {}

/**
 * Le compte dans l'API (`/api/…`) :
 * - `/api/auth/*` : Better Auth (création du compte, connexion, déconnexion, session, pseudo, mot
 *   de passe, suppression) ; une modification d'une autre origine, refusée (403) ;
 * - `GET /api/account` : `AccountState`, qui est connecté sur ce navigateur (`null` : personne) :
 *   une seule requête au démarrage ;
 * - la macro `auth` des routes réservées au compte : 401 sans session, 403 pour une modification
 *   venue d'une autre origine (le cookie part avec toute requête vers le site), jamais en cache ;
 *   la route reçoit `user`.
 */
export function accountRoutes({ auth, origin }: Accounts) {
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
        if (foreign(request)) return status(403, null)
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
        const session = await sessionOf(request, set)
        return { user: session && { id: session.user.id, name: session.user.name } }
      },
      { detail: { summary: 'Qui est connecté sur ce navigateur' } },
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
