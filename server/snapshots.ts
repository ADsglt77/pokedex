/**
 * Les réponses volumineuses de l'API (prix du jour, catalogue, espèces) : calculées une fois en fin de tâche
 * d'ingestion et gardées compressées, avec leur ETag. L'API sert la ligne telle quelle : un
 * navigateur qui a déjà la version du jour reçoit un 304, sans corps. Aussi, pour toute l'API : le
 * 404 sans corps (`notFound`) et la comparaison des ETag (`matchesEtag`).
 */

import type { Database } from 'bun:sqlite'

/** Enregistre la réponse, avec son ETag, qui ne change qu'avec son contenu. */
export function saveSnapshot(db: Database, name: string, data: unknown) {
  const text = JSON.stringify(data)
  const etag = `"${Bun.hash(text).toString(36)}"`
  db.query(
    `INSERT INTO snapshots (name, etag, body) VALUES (?, ?, ?)
     ON CONFLICT (name) DO UPDATE SET etag = excluded.etag, body = excluded.body
     WHERE etag != excluded.etag`,
  ).run(name, etag, Bun.gzipSync(text))
}

/** 404, sans corps ni cache : ce qui manque peut arriver (une tâche, une image copiée). */
export const notFound = () =>
  new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })

/**
 * Le navigateur a-t-il déjà cette version (`If-None-Match`) ? Un relais (Cloudflare) peut affaiblir
 * l'ETag en `W/"…"` : c'est le même.
 */
export const matchesEtag = (request: Request, etag: string) =>
  request.headers.get('if-none-match')?.replace(/^W\//, '') === etag

/** La réponse HTTP d'un instantané ; 404 tant que sa tâche n'est jamais passée. */
export function serveSnapshot(db: Database, name: string, request: Request) {
  const row = db.query('SELECT etag, body FROM snapshots WHERE name = ?').get(name) as {
    etag: string
    body: Uint8Array<ArrayBuffer>
  } | null
  if (!row) return notFound()
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ETag: row.etag,
    Vary: 'Accept-Encoding',
  }
  if (matchesEtag(request, row.etag)) return new Response(null, { status: 304, headers })
  return /\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')
    ? new Response(row.body, { headers: { ...headers, 'Content-Encoding': 'gzip' } })
    : new Response(Bun.gunzipSync(row.body), { headers })
}
