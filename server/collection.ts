/**
 * `/api/collection` : la collection et les achats du compte, que ses appareils partagent
 * (`src/store/sync.ts`). Un seul document, numéroté (`version`) :
 * - `GET` : `{ version, collection, shopping }` (`version` 0 et rien d'autre tant qu'aucun appareil
 *   n'a rien envoyé) ; 304 si l'appareil a déjà cette version (`If-None-Match`).
 * - `PUT` `{ baseVersion, collection, shopping }` : enregistré seulement si `baseVersion` est la
 *   version du serveur, et rend `{ version }` ; sinon 409 : l'appareil relit la version du serveur,
 *   qu'il n'écrase jamais sans le demander. Le document est contrôlé aux règles d'un fichier
 *   importé (`readDocument`).
 * Sans session : 401 ; jamais gardé en cache (`no-store`), ni par le navigateur ni par Cloudflare
 * (macro `auth`, `auth.ts`).
 */

import type { Database } from 'bun:sqlite'
import { Elysia, t } from 'elysia'
import { DAY, HOUR } from '@/lib/time'
import { readDocument } from '@/lib/transfer'
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

/** Le document tel que le lit l'appareil, sans le relire : il est enregistré en JSON. */
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
    .get(
      '/collection',
      ({ user, request }) => {
        const row = read.get(user.id) as Row | null
        const etag = `"v${row?.version ?? 0}"`
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
        const document = readDocument(body)
        if (!document) {
          journal({
            topic: 'collection',
            level: 'error',
            message: 'Envoi refusé',
            details: { raison: 'ne passe pas les contrôles' },
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
            collection: JSON.parse(row.collection),
            shopping: JSON.parse(row.shopping),
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
            details: { raison: 'conflit, changée ailleurs entre-temps' },
          })
          return json('null', 409)
        }
        for (const change of documentChanges(result.previous ?? null, document)) journal(change)
        return json(JSON.stringify({ version: result.version }))
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
