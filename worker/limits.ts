/**
 * Les limites par visiteur (l'adresse que Cloudflare écrit, `cf-connecting-ip`, ramenée à son
 * réseau /64 en IPv6 : `visitorOf`), comptées par Cloudflare (`ratelimits` de `wrangler.jsonc`, où
 * est chaque limite), pour les routes qu'un visiteur pourrait répéter à volonté : chacune loin de
 * ce que demande une visite. Au-delà : 429 sans corps, avec `Retry-After` (l'app réessaie plus
 * tard : `src/store/account.ts`, et `getJson` de `src/lib/api.ts`, une minute après), et une ligne
 * au journal par minute au plus. Seules les espèces n'en ont pas.
 */

import { env } from 'cloudflare:workers'
import type { MiddlewareHandler } from 'hono'
import { journalOnce, visitorOf } from './journal'

/**
 * Le nom d'une limite : une liaison `RateLimit` de `Env` (`env.d.ts`), sans répéter les noms
 * (`-?` : sans lui, une liaison facultative ajouterait `undefined`).
 */
type Limit = {
  [K in keyof Cloudflare.Env]-?: Cloudflare.Env[K] extends RateLimit ? K : never
}[keyof Cloudflare.Env]

/** Chaque groupe de routes et sa limite. */
const LIMITS: [routes: RegExp, limit: Limit][] = [
  // La collection du compte (des corps de 1,9 Mo, lus et contrôlés), le compte connecté et le
  // journal : trois routes qui lisent la session dans D1.
  [/^\/api\/(collection|account|journal)\/?$/, 'COLLECTION_LIMIT'],
  // Le compte (Better Auth limite déjà ses tentatives, pas une déconnexion répétée ; `/api/auth`
  // compris, que sa route reçoit aussi), le Pokédex public d'un compte et toute adresse d'un seul
  // segment : l'aperçu d'un lien partagé (`linkPreview`).
  [/^\/(api\/(auth|vitrine)(\/|$)|[A-Za-z0-9_-]+$)/, 'ACCOUNT_LIMIT'],
  // Les routes coûteuses de l'API des données : jusqu'à 1 025 cartes par demande. Les lignes de la
  // liste de souhaits, les plus lourdes pour sa base (tous les produits des extensions touchées),
  // ont la leur, plus basse.
  [/^\/api\/histories$/, 'HEAVY_LIMIT'],
  [/^\/api\/wants$/, 'WANTS_LIMIT'],
  // Le catalogue, les prix, l'état des tâches et la surveillance (qui parcourent les passages des
  // tâches, une table qui grandit) : loin d'une visite ou d'une surveillance toutes les 5 minutes.
  [/^\/api\/(catalog|prices|status|health)(\/|$)/, 'DATA_LIMIT'],
  [/^\/images\//, 'IMAGES_LIMIT'],
]

export const limits: MiddlewareHandler = async (c, next) => {
  const limit = LIMITS.find(([routes]) => routes.test(c.req.path))?.[1]
  // Sans adresse, pas de limite : les tests du Worker (en ligne, Cloudflare l'écrit toujours).
  const key = visitorOf(c.req.raw)
  if (!limit || !key || (await env[limit].limit({ key })).success) return next()
  journalOnce(
    `Débit ${limit} ${key}`,
    {
      topic: 'serveur',
      level: 'warn',
      message: 'Débit dépassé',
      details: { route: `${c.req.method} ${c.req.path}` },
    },
    c.req.raw,
  )
  return c.body(null, 429, { 'Cache-Control': 'no-store', 'Retry-After': '10' })
}
