/**
 * Le Worker du site (pokecodex.fr). Il reçoit toute requête (`run_worker_first`,
 * `wrangler.jsonc`) :
 * - l'API que lit le site (`/api/…`) : le compte (`auth.ts`), la collection et ce que le
 *   navigateur signale au journal (`collection.ts`), le Pokédex public (`vitrine.ts`), et les
 *   données de référence et les images, à l'API des données (`data.ts`) ;
 * - une adresse d'un seul segment (`/sacha`) : l'aperçu d'un lien partagé pour un robot
 *   (`linkPreview`) ;
 * - le reste : les fichiers de l'app, construits par Vite (`env.ASSETS`), `index.html` pour une
 *   adresse qui n'est pas un fichier (le routeur de l'app s'en charge).
 * Avant tout le reste : `www.pokecodex.fr` mène au site, et chaque réponse reçoit ses en-têtes
 * (sécurité, cache, moteurs de recherche : `headers.ts`) ; une route qu'un visiteur répète trop :
 * 429 (`limits.ts`) ; une modification venue d'une autre origine : 403 (`sameOrigin`). Une adresse
 * inconnue de l'API : 404 sans corps ; une erreur imprévue : dans le journal, et 500 sans corps
 * (rien de ses détails, une requête SQL par exemple, ne part vers le site).
 */

import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { accountRoutes, sameOrigin } from './auth'
import { collectionRoutes } from './collection'
import { dataRoutes } from './data'
import { canonicalHost, siteHeaders } from './headers'
import { journal } from './journal'
import { limits } from './limits'
import { linkPreview, vitrineRoutes } from './vitrine'

export default new Hono()
  .use(siteHeaders)
  .use(canonicalHost)
  .use(limits)
  .use(sameOrigin)
  .use(dataRoutes)
  .route('/api', accountRoutes)
  .route('/api', collectionRoutes)
  .route('/api', vitrineRoutes)
  .all('/api/*', (c) => c.body(null, 404, { 'Cache-Control': 'no-cache' }))
  .get('/:segment{[A-Za-z0-9_-]+}', linkPreview)
  .all('*', (c) => env.ASSETS.fetch(c.req.raw))
  .onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    journal({
      topic: 'serveur',
      level: 'error',
      message: 'Erreur de l’API',
      details: { route: `${c.req.method} ${c.req.path}` },
    })
    console.error(error)
    return c.body(null, 500, { 'Cache-Control': 'no-store' })
  })
