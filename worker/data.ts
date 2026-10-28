/**
 * Les données de référence (espèces, catalogue, prix, historiques, lignes de souhaits, état des
 * tâches, images) : l'API des données (le dépôt `pokedex-data`), jointe par le Worker avec le
 * token du site (`DATA_API_TOKEN`), que le navigateur ne voit jamais, et sans le cookie de la
 * session (`dataFetch`, aussi pour les prix d'un Pokédex public : `vitrine.ts`). Ses chemins sont
 * sous `/v1` (`/api/x` → `/v1/x`, `/images/x` → `/v1/images/x`). Pour l'instant à son adresse
 * (`DATA_API_URL` : en développement, `bun run dev` dans `pokedex-data`) ; en ligne, ce sera le
 * Worker des données, par une liaison de service.
 */

import { env } from 'cloudflare:workers'
import type { MiddlewareHandler } from 'hono'

/** Une demande à l'API des données (`path`, sous `/v1`), avec le token du site, sans cookie. */
export function dataFetch(path: string, init?: RequestInit) {
  const request = new Request(`${env.DATA_API_URL}/v1${path}`, init)
  request.headers.set('Authorization', `Bearer ${env.DATA_API_TOKEN}`)
  request.headers.delete('Cookie')
  return fetch(request)
}

const DATA = /^\/(api\/(species|catalog|prices|histories|wants|status|health)|images)(\/|$)/

export const dataRoutes: MiddlewareHandler = async (c, next) => {
  if (!DATA.test(c.req.path)) return next()
  const { pathname, search } = new URL(c.req.url)
  return dataFetch(`${pathname.replace(/^\/api/, '')}${search}`, c.req.raw)
}
