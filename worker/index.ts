/**
 * Le Worker du site (pokecodex.fr). Il reçoit toute requête (`run_worker_first`,
 * `wrangler.jsonc`) :
 * - l'API que lit le site (`/api/…`) : le compte (`auth.ts`), la collection et ce que le
 *   navigateur signale au journal (`collection.ts`), le Pokédex public (`vitrine.ts`), et les
 *   données de référence et les images, à l'API des données (`data.ts`) ;
 * - une adresse d'un seul segment (`/sacha`) : l'aperçu d'un lien partagé pour un robot
 *   (`linkPreview`) ;
 * - le reste : les fichiers de l'app, construits par Vite (`env.ASSETS`), `index.html` pour une
 *   adresse qui n'est pas un fichier (le routeur de l'app s'en charge) ; un fichier absent, 404
 *   (`FILES`).
 * Avant tout le reste : `http://` et `www.` mènent à `https://pokecodex.fr`, et chaque réponse
 * reçoit ses en-têtes
 * (sécurité, cache, moteurs de recherche : `headers.ts`) ; une route qu'un visiteur répète trop :
 * 429 (`limits.ts`) ; une modification venue d'une autre origine : 403 (`sameOrigin`). Une adresse
 * inconnue de l'API : 404 sans corps ; une erreur imprévue : dans le journal, et 500 sans corps
 * (rien de ses détails, une requête SQL par exemple, ne part vers le site).
 */

import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { accountRoutes, sameOrigin } from './auth'
import { collectionRoutes } from './collection'
import { dataRoutes } from './data'
import { canonicalHost, siteHeaders } from './headers'
import { journal } from './journal'
import { limits } from './limits'
import { linkPreview, vitrineRoutes } from './vitrine'

/**
 * Les adresses de fichiers : ceux de Vite, les icônes, et un nom à extension à la racine (un pseudo
 * n'a pas de point). Absent, un fichier ne reçoit pas la page de l'app (ce que rend `env.ASSETS`
 * pour toute adresse inconnue) : un onglet resté sur une version d'avant, qui demande un de ses
 * scripts, aurait du HTML à la place, gardé un an (`/assets/`).
 */
const FILES = /^\/(assets\/|icons\/|[^/]+\.\w+$)/

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
  .all('*', async (c) => {
    const response = await env.ASSETS.fetch(c.req.raw)
    const page = response.headers.get('Content-Type')?.startsWith('text/html')
    if (page && FILES.test(c.req.path) && !c.req.path.endsWith('.html')) {
      return c.body(null, 404, { 'Cache-Control': 'no-cache' })
    }
    return response
  })
  .onError((error, c) => {
    journal({
      topic: 'serveur',
      level: 'error',
      message: 'Erreur de l’API',
      details: { route: `${c.req.method} ${c.req.path}` },
    })
    console.error(error)
    return c.body(null, 500, { 'Cache-Control': 'no-store' })
  })
