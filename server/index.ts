/**
 * Le serveur de l'app : l'API que lit le site (`/api/…`) et les images copiées chez nous
 * (`/images/…`), derrière nginx sur le VPS, derrière le proxy de Vite en développement
 * (`bun run dev:server`). Il lit `data.db`, que remplissent les tâches d'ingestion (`ingest.ts`) ;
 * il n'écrit que `app.db` (le compte, la collection synchronisée) et les images copiées à la
 * demande. Les données de référence sont publiques ; la collection exige la connexion.
 */

import { appOrigin, createAuth } from './auth'
import { collectionRoutes } from './collection'
import { openApp, openData } from './db'
import { readHistory } from './history'
import { serveImage } from './images'
import { serveSnapshot } from './snapshots'

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL manque : l’adresse publique du site (voir server/auth.ts)')
}

const data = openData({ readonly: true })
const app = openApp()
const auth = await createAuth(app)
const collection = collectionRoutes(app, auth)

const notFound = () => Response.json(null, { status: 404 })

/** La dernière réussite et le dernier passage de chaque tâche d'ingestion. */
function status() {
  const runs = data
    .query(
      `SELECT job, MAX(CASE WHEN ok = 1 THEN finished_at END) AS lastSuccess,
              MAX(finished_at) AS lastRun
       FROM runs GROUP BY job`,
    )
    .all() as { job: string; lastSuccess: string | null; lastRun: string | null }[]
  return Object.fromEntries(runs.map(({ job, ...times }) => [job, times]))
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    '/api/status': () => Response.json(status(), { headers: { 'Cache-Control': 'no-cache' } }),
    // Le catalogue des cartes japonaises : extensions, et cartes par Pokémon.
    '/api/catalog': (request) => serveSnapshot(data, 'catalog', request),
    // Les prix du jour : Cardmarket, et TCGplayer pour les cartes sans prix Cardmarket.
    '/api/prices': (request) => serveSnapshot(data, 'prices', request),
    // L'historique d'une carte Cardmarket, par son id produit.
    '/api/prices/:id': ({ params }) => {
      const history = /^\d{1,9}$/.test(params.id) ? readHistory(data, Number(params.id)) : null
      return history
        ? Response.json(history, { headers: { 'Cache-Control': 'no-cache' } })
        : notFound()
    },
    // La connexion (Better Auth) et la collection synchronisée du compte connecté.
    '/api/auth/*': (request) => auth.handler(request),
    '/api/collection': collection,
    '/api/*': notFound,
    // Les images copiées chez nous (sur le VPS, nginx ne renvoie ici que celles qu'il n'a pas).
    '/images/*': (request) => serveImage(data, request),
  },
  fetch: notFound,
})

console.log(`API sur ${server.url} (site : ${appOrigin(auth)})`)
