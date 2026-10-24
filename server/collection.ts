/**
 * `/api/collection` : la collection et les achats du compte, gardés par le serveur seul
 * (`src/store/account.ts`). Un seul document, numéroté (`version`) :
 * - `GET` : `{ version, account, collection, shopping }` (`CollectionResponse`, `account` : l'id
 *   du compte ; `version` 0 et rien d'autre tant que rien n'a été enregistré) ; demandé depuis la
 *   version que l'appareil a déjà (`?version=N`) et inchangé, `{ version, account }` seuls ;
 * - `PUT` `{ account, baseVersion, collection, shopping }` : enregistré seulement si `account` est
 *   le compte de la session (sinon 401 : un envoi parti juste après une connexion à un autre compte
 *   n'écrase jamais sa collection) et `baseVersion` la version du serveur, et rend `{ version }`
 *   (`CollectionSaved`) ; sinon 409 : l'appareil relit la version du serveur, qu'il n'écrase
 *   jamais. Sauf un envoi renvoyé tel quel après une réponse perdue : parti de la version d'avant,
 *   le même document que celui enregistré, il rend cette version, sans rien écrire. Le document
 *   est contrôlé aux règles d'un fichier importé (`readSent` ; 400 sinon, la règle en cause au
 *   journal). Le site l'envoie compressé (`Content-Encoding: gzip`), décompressé ici en flux,
 *   seulement avec une session (401 sinon, avant de rien lire) : 413 au-delà de `MAX_DOCUMENT`
 *   octets décompressés.
 * Sans session : 401 ; jamais gardé en cache (`no-store`), ni par le navigateur ni par un relais
 * (macro `auth`, `auth.ts`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { DAY, HOUR } from '@/lib/time'
import { readCollection, readSent } from '@/lib/transfer'
import { MAX_DOCUMENT, type CollectionSaved, type ShoppingData } from '@/types'
import type { Accounts, accountRoutes } from './auth'
import { documentChanges, journal } from './journal'

interface Row {
  version: number
  collection: string
  shopping: string
}

const json = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'Content-Type': 'application/json' } })

/** La collection et les achats d'un document enregistré, en JSON, écrits sans les relire. */
const contents = (row: Row | null) =>
  `"collection":${row?.collection ?? 'null'},"shopping":${row?.shopping ?? 'null'}`

/**
 * Un corps compressé (`gzip`), décompressé en flux : `null` au-delà de `MAX_DOCUMENT` octets, sans
 * en décompresser plus (une « bombe » de quelques Ko ne devient jamais des Go en mémoire).
 */
async function gunzip(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new DecompressionStream('gzip')).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    size += next.value.length
    if (size > MAX_DOCUMENT) {
      void reader.cancel()
      return null
    }
    chunks.push(next.value)
  }
  return new Blob(chunks).text()
}

/**
 * Ce que `parse` refuse d'un corps compressé : sans session (401, avant de rien lire), trop gros
 * une fois décompressé (413). Elysia fait de toute erreur du `parse` un 400 : `error` les rend.
 */
const NO_SESSION = new Error('Sans session')
const TOO_LARGE = new Error(`Plus de ${MAX_DOCUMENT} octets une fois décompressé`)

export function collectionRoutes(
  app: Database,
  account: ReturnType<typeof accountRoutes>,
  auth: Accounts['auth'],
) {
  const read = app.query('SELECT version, collection, shopping FROM collections WHERE user_id = ?')

  /** Garde la version remplacée, si la dernière gardée a plus d'une heure ; oublie les vieilles. */
  const keep = (userId: string, row: Row, now: Date) => {
    const last = app
      .query('SELECT MAX(saved_at) AS at FROM collection_versions WHERE user_id = ?')
      .get(userId) as { at: string | null }
    if (last.at && now.getTime() - Date.parse(last.at) < HOUR) return
    app
      .query(
        'INSERT OR REPLACE INTO collection_versions (user_id, version, saved_at, body) VALUES (?, ?, ?, ?)',
      )
      .run(
        userId,
        row.version,
        now.toISOString(),
        Bun.gzipSync(`{"version":${row.version},${contents(row)}}`),
      )
    app
      .query('DELETE FROM collection_versions WHERE user_id = ? AND saved_at < ?')
      .run(userId, new Date(now.getTime() - 30 * DAY).toISOString())
  }

  return new Elysia({ name: 'collection' })
    .use(account)
    .get(
      '/collection',
      ({ user, query }) => {
        const row = read.get(user.id) as Row | null
        const version = row?.version ?? 0
        const head = `"version":${version},"account":${JSON.stringify(user.id)}`
        return json(query.version === version ? `{${head}}` : `{${head},${contents(row)}}`)
      },
      {
        auth: true,
        query: t.Object({ version: t.Optional(t.Integer({ minimum: 0 })) }),
        detail: { summary: 'La collection du compte, si elle a changé depuis `version`' },
      },
    )
    .put(
      '/collection',
      ({ user, body }) => {
        const compte = user.username ?? undefined
        /** Refusé : au journal, et la réponse, sans corps utile. */
        const refused = (status: number, level: 'warn' | 'error', raison?: string) => {
          journal({
            topic: 'collection',
            level,
            message: 'Envoi refusé',
            details: { compte, raison },
          })
          return json('null', status)
        }
        if (body.account !== user.id) return refused(401, 'warn', 'parti d’un autre compte')
        const { document, problem } = readSent(body)
        if (!document) return refused(400, 'error', problem)
        const { baseVersion } = body
        const collection = JSON.stringify(document.collection)
        const shopping = JSON.stringify(document.shopping)

        const now = new Date()
        const saved = app.transaction(() => {
          const row = read.get(user.id) as Row | null
          // Renvoyé après une réponse perdue : déjà enregistré tel quel (et noté au journal), de la
          // version d'avant.
          if (
            row?.version === baseVersion + 1 &&
            row.collection === collection &&
            row.shopping === shopping
          ) {
            return { version: row.version, previous: undefined }
          }
          if ((row?.version ?? 0) !== baseVersion) return null
          // Enregistré après ses contrôles, mais relu comme un fichier : un document d'avant les
          // collections d'extensions n'a pas de `series`, que le journal compare.
          const previous = row && {
            collection: readCollection(JSON.parse(row.collection))!,
            shopping: JSON.parse(row.shopping) as ShoppingData,
          }
          if (row) keep(user.id, row, now)
          const version = baseVersion + 1
          app
            .query(
              `INSERT INTO collections (user_id, version, collection, shopping, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT (user_id) DO UPDATE SET version = excluded.version,
                 collection = excluded.collection, shopping = excluded.shopping,
                 updated_at = excluded.updated_at`,
            )
            .run(user.id, version, collection, shopping, now.toISOString())
          return { version, previous }
        })
        // `immediate` : la version lue est encore celle du serveur au moment d'écrire.
        const result = saved.immediate()
        if (!result) return refused(409, 'warn', 'conflit, changée ailleurs entre-temps')
        if (result.previous !== undefined) {
          for (const change of documentChanges(result.previous, document)) {
            journal({ ...change, details: { compte, ...change.details } })
          }
        }
        const answer: CollectionSaved = { version: result.version }
        return json(JSON.stringify(answer))
      },
      {
        auth: true,
        // Compressé (le site) : décompressé ici ; sans compression, Elysia le lit lui-même.
        // Le `parse` passe avant la macro `auth` : sans session, rien n'est lu ni décompressé (pas
        // 5 Mo à décompresser pour quelques Ko envoyés par n'importe qui). La session est lue sans
        // être renouvelée : le renouvellement du jour reste à la macro, qui en renvoie le cookie.
        // Illisible (pas du gzip, pas du JSON) : Elysia fait de toute erreur ici un 400.
        async parse({ request }) {
          if (request.headers.get('content-encoding') !== 'gzip') return
          const session = await auth.api.getSession({
            headers: request.headers,
            query: { disableRefresh: true },
          })
          if (!session) throw NO_SESSION
          const text = await gunzip(request.body!)
          if (text === null) throw TOO_LARGE
          return JSON.parse(text) as unknown
        },
        error({ code, error }) {
          if (code !== 'PARSE') return
          if (error.cause === NO_SESSION) return json('null', 401)
          if (error.cause === TOO_LARGE) return json('null', 413)
        },
        body: t.Object({
          account: t.String(),
          baseVersion: t.Integer({ minimum: 0 }),
          collection: t.Unknown(),
          shopping: t.Unknown(),
        }),
        detail: { summary: 'Enregistre la collection, si l’appareil part de la dernière version' },
      },
    )
}
