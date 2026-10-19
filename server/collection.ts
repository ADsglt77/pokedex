/**
 * `/api/collection` : la collection et les achats du compte, que ses appareils partagent
 * (`src/store/sync.ts`). Un seul document, numéroté (`version`), et son empreinte (`tag`, tirée de
 * ce qui est enregistré : après une restauration de la base, un numéro peut revenir pour un autre
 * document) :
 * - `GET` : `{ version, collection, shopping }` (`CollectionResponse` ; `version` 0 et rien d'autre
 *   tant qu'aucun appareil n'a rien envoyé), ETag `"v<version>-<tag>"` ; 304 si l'appareil a déjà
 *   cette version (`If-None-Match`).
 * - `PUT` `{ baseVersion, baseTag?, collection, shopping }` : enregistré seulement si `baseVersion`
 *   (et `baseTag`, s'il est donné) sont ceux du serveur, et rend `{ version, tag }`
 *   (`CollectionSaved`) ; sinon 409 : l'appareil relit la version du serveur, qu'il n'écrase
 *   jamais sans le demander. Le document est contrôlé aux règles d'un fichier importé (`readSent` ;
 *   400 sinon, la règle en cause au journal).
 * Sans session : 401 ; jamais gardé en cache (`no-store`), ni par le navigateur ni par Cloudflare
 * (macro `auth`, `auth.ts`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { DAY, HOUR } from '@/lib/time'
import { readSent } from '@/lib/transfer'
import type { CollectionData, CollectionSaved, ShoppingData } from '@/types'
import type { accountRoutes } from './auth'
import { documentChanges, journal } from './journal'
import { matchesEtag } from './snapshots'

interface Row {
  version: number
  collection: string
  shopping: string
}

const json = (text: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(text, { status, headers: { 'Content-Type': 'application/json', ...headers } })

/**
 * Le document tel que le lit l'appareil (`CollectionResponse`), écrit sans le relire : il est
 * enregistré en JSON.
 */
const documentText = (row: Row | null) =>
  `{"version":${row?.version ?? 0},"collection":${row?.collection ?? 'null'},"shopping":${row?.shopping ?? 'null'}}`

/** L'empreinte d'une version : de ce qui est enregistré, pas de son seul numéro. */
const tagOf = (collection: string, shopping: string) =>
  Bun.hash(`${collection}\n${shopping}`).toString(36)

export function collectionRoutes(app: Database, account: ReturnType<typeof accountRoutes>) {
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
      .run(userId, row.version, now.toISOString(), Bun.gzipSync(documentText(row)))
    app
      .query('DELETE FROM collection_versions WHERE user_id = ? AND saved_at < ?')
      .run(userId, new Date(now.getTime() - 30 * DAY).toISOString())
  }

  return new Elysia({ name: 'collection' })
    .use(account)
    .get(
      '/collection',
      ({ user, request }) => {
        const row = read.get(user.id) as Row | null
        const etag = row ? `"v${row.version}-${tagOf(row.collection, row.shopping)}"` : '"v0"'
        if (matchesEtag(request, etag)) {
          return new Response(null, { status: 304, headers: { ETag: etag } })
        }
        return json(documentText(row), 200, { ETag: etag })
      },
      { auth: true, detail: { summary: 'La collection du compte' } },
    )
    .put(
      '/collection',
      ({ user, body }) => {
        const { document, problem } = readSent(body)
        if (!document) {
          journal({
            topic: 'collection',
            level: 'error',
            message: 'Envoi refusé',
            details: { compte: user.username ?? undefined, raison: problem },
          })
          return json('null', 400)
        }
        const { baseVersion, baseTag } = body

        const now = new Date()
        const saved = app.transaction(() => {
          const row = read.get(user.id) as Row | null
          if ((row?.version ?? 0) !== baseVersion) return null
          if (row && baseTag !== undefined && tagOf(row.collection, row.shopping) !== baseTag) {
            return null
          }
          // Enregistré après ses contrôles : relu tel quel.
          const previous = row && {
            collection: JSON.parse(row.collection) as CollectionData,
            shopping: JSON.parse(row.shopping) as ShoppingData,
          }
          const version = baseVersion + 1
          const values = [JSON.stringify(document.collection), JSON.stringify(document.shopping)]
          if (row) {
            keep(user.id, row, now)
            app
              .query(
                'UPDATE collections SET version = ?, collection = ?, shopping = ?, updated_at = ? WHERE user_id = ?',
              )
              .run(version, ...values, now.toISOString(), user.id)
          } else {
            app
              .query(
                'INSERT INTO collections (user_id, version, collection, shopping, updated_at) VALUES (?, ?, ?, ?, ?)',
              )
              .run(user.id, version, ...values, now.toISOString())
          }
          return { version, tag: tagOf(values[0]!, values[1]!), previous }
        })
        // `immediate` : la version lue est encore celle du serveur au moment d'écrire.
        const result = saved.immediate()
        if (!result) {
          journal({
            topic: 'collection',
            level: 'warn',
            message: 'Envoi refusé',
            details: {
              compte: user.username ?? undefined,
              raison: 'conflit, changée ailleurs entre-temps',
            },
          })
          return json('null', 409)
        }
        for (const change of documentChanges(result.previous ?? null, document)) {
          journal({ ...change, details: { compte: user.username ?? undefined, ...change.details } })
        }
        const answer: CollectionSaved = { version: result.version, tag: result.tag }
        return json(JSON.stringify(answer))
      },
      {
        auth: true,
        body: t.Object({
          baseVersion: t.Integer({ minimum: 0 }),
          baseTag: t.Optional(t.String({ pattern: '^[0-9a-z]{1,16}$' })),
          collection: t.Unknown(),
          shopping: t.Unknown(),
        }),
        detail: { summary: 'Enregistre la collection, si l’appareil part de la dernière version' },
      },
    )
}
