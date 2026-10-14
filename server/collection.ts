/**
 * `/api/collection` : la collection et les achats du compte connecté, que ses appareils partagent
 * (`src/store/sync.ts`). Un seul document par compte, numéroté (`version`) :
 * - `GET` : `{ version, collection, shopping }` (`version` 0 et rien d'autre tant qu'aucun appareil
 *   n'a rien envoyé) ; 304 si l'appareil a déjà cette version (`If-None-Match`).
 * - `PUT` `{ baseVersion, collection, shopping }` : enregistré seulement si `baseVersion` est la
 *   version du serveur ; sinon 409 et la version du serveur, que l'appareil n'écrase jamais sans le
 *   demander. Le document est contrôlé aux règles d'un fichier importé (`readDocument`).
 * Sans session : 401. Jamais gardé en cache (`no-store`), ni par le navigateur ni par Cloudflare.
 */

import type { Database } from 'bun:sqlite'
import { parseStored, readDocument } from '@/lib/transfer'
import { appOrigin, type Auth } from './auth'

/** Bien au-delà d'une collection de 1 025 cartes et de ses commandes. */
const MAX_BODY = 5_000_000
const HOUR = 3_600_000

interface Row {
  version: number
  collection: string
  shopping: string
}

const json = (text: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

/** Le document tel que le lit l'appareil, sans le relire : il est enregistré en JSON. */
const documentText = (row: Row | null) =>
  `{"version":${row?.version ?? 0},"collection":${row?.collection ?? 'null'},"shopping":${row?.shopping ?? 'null'}}`

export function collectionRoutes(app: Database, auth: Auth) {
  const read = app.query('SELECT version, collection, shopping FROM collections WHERE user_id = ?')
  const userOf = async (request: Request) =>
    (await auth.api.getSession({ headers: request.headers }))?.user ?? null

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
      .run(userId, new Date(now.getTime() - 30 * 24 * HOUR).toISOString())
  }

  return {
    async GET(request: Request) {
      const user = await userOf(request)
      if (!user) return json('null', 401)
      const row = read.get(user.id) as Row | null
      const etag = `"v${row?.version ?? 0}"`
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, {
          status: 304,
          headers: { ETag: etag, 'Cache-Control': 'no-store' },
        })
      }
      return json(documentText(row), 200, { ETag: etag })
    },

    async PUT(request: Request) {
      // Le cookie de session part avec toute requête vers le site : seule une page du site peut
      // modifier la collection.
      if (request.headers.get('origin') !== appOrigin(auth)) return json('null', 403)
      const user = await userOf(request)
      if (!user) return json('null', 401)
      const text = await request.text()
      if (text.length > MAX_BODY) return json('null', 413)
      const input = parseStored(text) as { baseVersion?: unknown } | null
      const document = readDocument(input)
      const baseVersion = input?.baseVersion
      if (!document || typeof baseVersion !== 'number' || !Number.isInteger(baseVersion)) {
        return json('null', 400)
      }

      const now = new Date()
      const saved = app.transaction(() => {
        const row = read.get(user.id) as Row | null
        if ((row?.version ?? 0) !== baseVersion) return { conflict: row }
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
        return { version }
      })
      // `immediate` : la version lue est encore celle du serveur au moment d'écrire.
      const result = saved.immediate()
      return 'version' in result
        ? json(JSON.stringify({ version: result.version }), 200, { ETag: `"v${result.version}"` })
        : json(documentText(result.conflict), 409)
    },
  }
}
