/**
 * `/api/collection` : la collection et les achats du compte, gardés par le serveur seul
 * (`src/store/account.ts`). Un seul document, numéroté (`version`) :
 * - `GET` : `{ version, collection, shopping }` (`CollectionResponse` ; `version` 0 et rien d'autre
 *   tant que rien n'a été enregistré) ;
 * - `PUT` `{ baseVersion, collection, shopping }` : enregistré seulement si `baseVersion` est celle
 *   du serveur, et rend `{ version }` (`CollectionSaved`) ; sinon 409 : l'appareil relit la version
 *   du serveur, qu'il n'écrase jamais. Le document est contrôlé aux règles d'un fichier importé
 *   (`readSent` ; 400 sinon, la règle en cause au journal).
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

interface Row {
  version: number
  collection: string
  shopping: string
}

const json = (text: string, status = 200) =>
  new Response(text, { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Le document tel que le lit l'appareil (`CollectionResponse`), écrit sans le relire : il est
 * enregistré en JSON.
 */
const documentText = (row: Row | null) =>
  `{"version":${row?.version ?? 0},"collection":${row?.collection ?? 'null'},"shopping":${row?.shopping ?? 'null'}}`

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
    .get('/collection', ({ user }) => json(documentText(read.get(user.id) as Row | null)), {
      auth: true,
      detail: { summary: 'La collection du compte' },
    })
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
        const { baseVersion } = body

        const now = new Date()
        const saved = app.transaction(() => {
          const row = read.get(user.id) as Row | null
          if ((row?.version ?? 0) !== baseVersion) return null
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
          return { version, previous }
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
        const answer: CollectionSaved = { version: result.version }
        return json(JSON.stringify(answer))
      },
      {
        auth: true,
        body: t.Object({
          baseVersion: t.Integer({ minimum: 0 }),
          collection: t.Unknown(),
          shopping: t.Unknown(),
        }),
        detail: { summary: 'Enregistre la collection, si l’appareil part de la dernière version' },
      },
    )
}
