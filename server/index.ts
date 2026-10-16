/**
 * Lance le serveur de l'app (`app.ts`), derrière nginx sur le VPS, derrière le proxy de Vite en
 * développement (`bun run dev:server`). Il lit `data.db`, que remplissent les tâches d'ingestion
 * (`ingest.ts`) ; il n'écrit que `app.db` (le compte, la collection synchronisée), les images
 * copiées à la demande et, à son démarrage, les étapes du schéma qui manquent aux deux bases. Les
 * données de référence sont publiques ; la collection exige la connexion. Tant que le compte
 * n'existe pas, il le rappelle dans son journal.
 */

import { createApp } from './app'
import { appOrigin, createAuth } from './auth'
import { openApp, openData } from './db'

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL manque : l’adresse publique du site (voir server/auth.ts)')
}

const data = openData({ readonly: true })
const app = openApp()
const accounts = await createAuth(app)
const server = createApp({ data, app, accounts }).listen(Number(process.env.PORT ?? 3000))

const site = appOrigin(accounts.auth)
console.log(`API sur ${server.server?.url} (site : ${site})`)
if (!accounts.account()) console.log(`Pas encore de compte : ouvrez ${site} pour créer le vôtre.`)
