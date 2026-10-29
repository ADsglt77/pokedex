/**
 * Les limites par visiteur (l'adresse que Cloudflare écrit, `cf-connecting-ip`), comptées par
 * Cloudflare (`ratelimits` de `wrangler.jsonc`, où est chaque limite), pour les routes qu'un
 * visiteur pourrait répéter à volonté : chacune loin de ce que demande une visite. Au-delà : 429
 * sans corps, avec `Retry-After` (l'app réessaie plus tard : `src/store/account.ts`,
 * `src/lib/prices.ts`), et une ligne au journal par minute au plus. Les espèces et l'état des
 * tâches n'en ont pas.
 */

import { env } from 'cloudflare:workers'
import type { MiddlewareHandler } from 'hono'
import { MINUTE } from '@/lib/time'
import { journalOnce } from './journal'

type Limit = 'COLLECTION_LIMIT' | 'ACCOUNT_LIMIT' | 'HEAVY_LIMIT' | 'DATA_LIMIT' | 'IMAGES_LIMIT'

/** Chaque groupe de routes et sa limite. */
const LIMITS: [routes: RegExp, limit: Limit][] = [
  // La collection du compte : des corps de 5 Mo, lus et contrôlés.
  [/^\/api\/collection\/?$/, 'COLLECTION_LIMIT'],
  // Le compte (Better Auth limite déjà ses tentatives, pas une déconnexion répétée), le Pokédex
  // public d'un compte et l'aperçu d'un lien partagé.
  [/^\/api\/(auth|vitrine)\//, 'ACCOUNT_LIMIT'],
  // Les routes coûteuses de l'API des données : jusqu'à 1 025 cartes par demande.
  [/^\/api\/(histories|wants)$/, 'HEAVY_LIMIT'],
  [/^\/api\/(catalog|prices)(\/|$)/, 'DATA_LIMIT'],
  [/^\/images\//, 'IMAGES_LIMIT'],
]

export const limits: MiddlewareHandler = async (c, next) => {
  const limit = LIMITS.find(([routes]) => routes.test(c.req.path))?.[1]
  // Sans adresse, pas de limite : les tests du Worker (en ligne, Cloudflare l'écrit toujours).
  const key = c.req.header('cf-connecting-ip')
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
    MINUTE,
  )
  return c.body(null, 429, { 'Cache-Control': 'no-store', 'Retry-After': '10' })
}
