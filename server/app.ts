/**
 * Le serveur de l'app (Elysia) : l'API que lit le site (`/api/…`), hors des données de référence
 * (espèces, catalogue, prix, images : l'API des données, que nginx et Vite joignent eux-mêmes).
 * Chaque domaine est un plugin : le compte (`auth.ts`), la collection synchronisée
 * (`collection.ts`), ce que le navigateur signale au journal (`journal.ts`), le Pokédex public
 * (`vitrine.ts`). Une modification venue d'une autre origine : 403 avant tout le reste (`auth.ts`).
 * Les paramètres et les corps des requêtes sont validés par leurs schémas (422 sinon ; 413 au-delà
 * de 5 Mo). Une adresse inconnue : 404 sans corps ; une erreur imprévue : dans le journal, et 500
 * sans corps. En développement, la documentation de l'API est à `/api/docs`.
 */

import { openapi } from '@elysiajs/openapi'
import type { Database } from 'bun:sqlite'
import { Elysia } from 'elysia'
import { MAX_DOCUMENT } from '@/types'
import { accountRoutes, type Accounts } from './auth'
import { collectionRoutes } from './collection'
import { journal, journalRoutes } from './journal'
import { vitrineRoutes } from './vitrine'

interface AppContext {
  /** Les comptes et les collections. */
  app: Database
  accounts: Accounts
}

export function createApp({ app, accounts }: AppContext) {
  const account = accountRoutes(accounts)
  return (
    // Le plus gros corps reçu : 413 au-delà. Le plus gros est la collection et les achats d'un
    // compte (`MAX_DOCUMENT`, le même plafond une fois décompressée : `collection.ts`). Une case
    // d'une collection d'extension pèse 320 octets pas encore obtenue, 463 possédée, 566 possédée
    // et achetée par une commande (mesuré, octobre 2026) : le Pokédex compris, le plafond tombe
    // vers 8 000 à 14 000 cases, soit 34 à 61 extensions de 230 cartes selon leur état
    // (`docs/compte-et-synchronisation.md`).
    new Elysia({ serve: { maxRequestBodySize: MAX_DOCUMENT } })
      .use(
        openapi({
          enabled: process.env.NODE_ENV !== 'production',
          path: '/api/docs',
          documentation: {
            info: {
              title: 'Pokédex',
              version: '1',
              description: 'L’API du Pokédex de cartes japonaises et françaises.',
            },
          },
        }),
      )
      // Une adresse inconnue : 404, sans corps. Laissés à Elysia : un corps illisible (400), refusé
      // par son schéma (422) et un statut levé exprès (`status(…)`, un code numérique). Tout le
      // reste est inattendu, même une erreur qui porte son propre code (base verrouillée
      // `SQLITE_BUSY`, fichier absent `ENOENT`…) : dans le journal du serveur, et 500 sans corps
      // (rien de ses détails, une requête SQL par exemple, ne part vers le site).
      .onError(({ code, error, request }) => {
        if (code === 'NOT_FOUND') {
          return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-cache' } })
        }
        if (code === 'VALIDATION' || code === 'PARSE' || typeof code === 'number') return
        const { pathname } = new URL(request.url)
        journal({
          topic: 'serveur',
          level: 'error',
          message: 'Erreur de l’API',
          details: { route: `${request.method} ${pathname}` },
        })
        console.error(error)
        return new Response(null, { status: 500, headers: { 'Cache-Control': 'no-store' } })
      })
      .group('/api', (api) =>
        api
          .use(account)
          .use(collectionRoutes(app, account, accounts.auth))
          .use(journalRoutes(account))
          .use(vitrineRoutes(app, accounts.origin)),
      )
  )
}
