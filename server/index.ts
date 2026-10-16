/**
 * Lance le serveur de l'app (`app.ts`), derrière nginx sur le VPS, derrière le proxy de Vite en
 * développement (`bun run dev:server`). Il lit `data.db`, que remplissent les tâches d'ingestion
 * (`ingest.ts`) ; il n'écrit que `app.db` (le compte, la collection synchronisée), les images
 * copiées à la demande et, à son démarrage, les étapes du schéma qui manquent aux deux bases. Les
 * données de référence sont publiques ; la collection exige la connexion. Au démarrage, il le dit
 * dans son journal (`banner`) ; en développement, il y écrit aussi chaque requête de l'API (pas les
 * images : une page du Pokédex en demande un millier).
 */

import { createApp, MAX_BODY } from './app'
import { appOrigin, createAuth } from './auth'
import { banner, journalRequest } from './journal'
import { openApp, openData } from './db'

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL manque : l’adresse publique du site (voir server/auth.ts)')
}

const data = openData({ readonly: true })
const app = openApp()
const accounts = await createAuth(app)
const api = createApp({ data, app, accounts })
const development = process.env.NODE_ENV !== 'production'

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  maxRequestBodySize: MAX_BODY,
  async fetch(request) {
    const start = performance.now()
    const response = await api.handle(request)
    if (development && !new URL(request.url).pathname.startsWith('/images/')) {
      journalRequest(request, response, performance.now() - start)
    }
    return response
  },
})

banner({
  api: String(server.url),
  site: appOrigin(accounts.auth),
  account: accounts.account(),
})
