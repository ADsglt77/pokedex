/**
 * Le serveur de l'app (Elysia) : l'API que lit le site (`/api/…`) et les images copiées chez nous
 * (`/images/…`). Chaque domaine est un plugin : les données de référence (`reference.ts`), le
 * compte (`auth.ts`), la collection synchronisée (`collection.ts`), le Pokédex public
 * (`vitrine.ts`). Les paramètres et les corps des requêtes sont validés par leurs schémas (422
 * sinon) ; en développement, la documentation de l'API est à `/api/docs`.
 */

import { openapi } from '@elysiajs/openapi'
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { accountRoutes, type Accounts } from './auth'
import { collectionRoutes } from './collection'
import { serveImage } from './images'
import { referenceRoutes } from './reference'
import { vitrineRoutes } from './vitrine'
import { notFound } from './snapshots'

/** Bien au-delà d'une collection de 1 025 cartes et de ses commandes : 413 au-delà. */
const MAX_BODY = 5_000_000

interface AppContext {
  /** Les données de référence, en lecture seule. */
  data: Database
  /** Le compte et la collection. */
  app: Database
  accounts: Accounts
}

export function createApp({ data, app, accounts }: AppContext) {
  const account = accountRoutes(accounts)
  return (
    new Elysia({ serve: { maxRequestBodySize: MAX_BODY } })
      .use(
        openapi({
          enabled: process.env.NODE_ENV !== 'production',
          path: '/api/docs',
          documentation: {
            info: { title: 'Pokédex', version: '1', description: 'L’API du Pokédex japonais.' },
          },
        }),
      )
      // Une adresse inconnue : 404, sans corps. Une erreur inattendue : dans le journal du serveur,
      // et 500 sans corps (rien de ses détails, une requête SQL par exemple, ne part vers le site).
      .onError(({ code, error }) => {
        if (code === 'NOT_FOUND') return notFound()
        if (code === 'UNKNOWN' || code === 'INTERNAL_SERVER_ERROR') {
          console.error('Erreur de l’API :', error)
          return new Response(null, { status: 500, headers: { 'Cache-Control': 'no-store' } })
        }
      })
      .group('/api', (api) =>
        api
          .use(account)
          .use(referenceRoutes(data))
          .use(collectionRoutes(app, account))
          .use(vitrineRoutes(app)),
      )
      // Les images copiées chez nous (sur le VPS, nginx ne renvoie ici que celles qu'il n'a pas).
      .get('/images/*', ({ request }) => serveImage(data, request), { detail: { hide: true } })
  )
}
