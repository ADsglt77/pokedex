/**
 * Les réponses communes à toute l'API : le 404 sans corps (`notFound`), la comparaison des ETag
 * (`matchesEtag`) et une réponse calculée à la demande dont l'ETag se connaît d'avance
 * (`serveTagged`).
 */

import { API_FORMAT } from '@/config/api'

/** 404, sans corps ni cache : ce qui manque peut arriver. */
export const notFound = () =>
  new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })

/**
 * Le navigateur a-t-il déjà cette version (`If-None-Match`) ? Un relais (Cloudflare) peut affaiblir
 * l'ETag en `W/"…"` : c'est le même.
 */
export const matchesEtag = (request: Request, etag: string) =>
  request.headers.get('if-none-match')?.replace(/^W\//, '') === etag

/**
 * La forme des réponses calculées à la demande (`API_FORMAT`) : changée avec elle, leur ETag change,
 * et un navigateur ne garde pas une réponse de l'ancienne forme.
 */
const TAGGED_FORMAT = API_FORMAT

/**
 * Une réponse JSON calculée à la demande (`read`), dont l'ETag se tire de ce dont elle dépend
 * (`version` : le jour des prix et ce qui est demandé, par exemple), connu sans la calculer : 304
 * sans rien lire si le navigateur l'a déjà ; 404 si `read` ne rend rien.
 */
export function serveTagged(request: Request, version: string, read: () => unknown) {
  const etag = `"${Bun.hash(`${TAGGED_FORMAT}|${version}`).toString(36)}"`
  const headers = { 'Cache-Control': 'no-cache', ETag: etag }
  if (matchesEtag(request, etag)) return new Response(null, { status: 304, headers })
  const body = read()
  return body === null ? notFound() : Response.json(body, { headers })
}
