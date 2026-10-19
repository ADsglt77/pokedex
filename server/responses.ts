/**
 * Les réponses communes à l'API : le 404 sans corps (`notFound`), et une réponse JSON avec son
 * ETag, tiré de son contenu (`serveJson`) : un navigateur qui l'a déjà reçoit un 304, sans corps.
 */

/** 404, sans corps ni cache : ce qui manque peut arriver. */
export const notFound = () =>
  new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })

/**
 * Une réponse JSON et son ETag ; 304 si le navigateur a déjà ce contenu (`If-None-Match` ; un
 * relais, Cloudflare, peut affaiblir l'ETag en `W/"…"` : c'est le même).
 */
export function serveJson(request: Request, body: unknown) {
  const text = JSON.stringify(body)
  const etag = `"${Bun.hash(text).toString(36)}"`
  const headers = { 'Cache-Control': 'no-cache', ETag: etag }
  if (request.headers.get('if-none-match')?.replace(/^W\//, '') === etag) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(text, { headers: { ...headers, 'Content-Type': 'application/json' } })
}
