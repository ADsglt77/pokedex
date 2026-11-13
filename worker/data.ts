/**
 * Les données de référence (espèces, catalogue, prix, historiques, lignes de souhaits, état des
 * tâches, images) : le Worker des données (le dépôt `pokedex-data`), joint par sa liaison de
 * service (`DATA`, `services` de `wrangler.jsonc` : son entrée `SiteEntrypoint`), sans token ni
 * réseau entre les deux, et sans le cookie de la session (`dataFetch`, aussi pour les prix d'un
 * Pokédex public : `vitrine.ts`). Ses chemins sont sous `/v1` (`/api/x` → `/v1/x`, `/images/x` →
 * `/v1/images/x`). En développement, `bun run dev` dans `pokedex-data` : Wrangler relie les deux.
 */

import { env } from 'cloudflare:workers'
import type { MiddlewareHandler } from 'hono'

/** Une demande au Worker des données (`path`, sous `/v1`), sans cookie. */
export function dataFetch(path: string, init?: RequestInit) {
  // L'adresse ne sert qu'au chemin : la liaison mène toujours au même Worker.
  const request = new Request(`https://pokedex-data/v1${path}`, init)
  request.headers.delete('Cookie')
  return env.DATA.fetch(request)
}

const DATA = /^\/(api\/(species|catalog|prices|histories|wants|status|health)|images)(\/|$)/

/**
 * Relayées seulement en lecture (`GET`, `HEAD`) : l'API des données n'a que des routes de lecture,
 * et une route d'écriture qu'elle ajouterait ne serait pas ouverte d'office à tout visiteur. Une
 * autre méthode : 405, sans corps.
 */
export const dataRoutes: MiddlewareHandler = async (c, next) => {
  if (!DATA.test(c.req.path)) return next()
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    return c.body(null, 405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' })
  }
  const { pathname, search } = new URL(c.req.url)
  return dataFetch(`${pathname.replace(/^\/api/, '')}${search}`, c.req.raw)
}
