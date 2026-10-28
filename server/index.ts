/**
 * Lance le serveur de l'app (`app.ts`), derrière nginx sur le VPS, derrière le proxy de Vite en
 * développement (`bun run dev:server`). Il n'écrit que `app.db` (les comptes, les collections
 * synchronisées), sans aucune copie de sauvegarde ; les données de référence sont à l'API des
 * données, qu'il ne joint que pour les prix d'un Pokédex public (`DATA_API_URL`,
 * `DATA_API_TOKEN`). Les Pokédex publics sont publics ; la collection exige la connexion. Au
 * démarrage, il le dit dans son journal (`banner`).
 */

import { createApp } from './app'
import { createAuth } from './auth'
import { openApp } from './db'
import { banner } from './journal'

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL manque : l’adresse publique du site (voir server/auth.ts)')
}
if (process.env.NODE_ENV === 'production') {
  // En http, les cookies ne seraient plus réservés au https, et l'origine attendue ne serait pas
  // celle du site : chaque modification serait refusée (403).
  if (!process.env.BETTER_AUTH_URL.startsWith('https://')) {
    throw new Error('BETTER_AUTH_URL doit être en https en production (voir server/auth.ts)')
  }
  // Une clé courte se devine : `openssl rand -base64 32` en donne une de 44 caractères.
  if ((process.env.BETTER_AUTH_SECRET ?? '').length < 32) {
    throw new Error('BETTER_AUTH_SECRET trop courte : 32 caractères au moins (voir server/auth.ts)')
  }
}

const app = openApp()
const accounts = await createAuth(app)
// Sur cette machine seulement, sauf `HOST` (`0.0.0.0` dans son conteneur, que nginx joint) : en
// développement, sur un Wi-Fi public, l'API ne s'ouvre pas aux autres appareils.
const server = createApp({ app, accounts }).listen({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? '127.0.0.1',
})

banner({
  api: String(server.server?.url),
  site: accounts.origin,
  accounts: accounts.count(),
})
