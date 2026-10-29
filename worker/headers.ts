/**
 * Ce que le site ajoute à ses réponses (le travail de nginx et de Caddy sur l'ancien VPS) :
 * - `www.pokecodex.fr` mène au site (`canonicalHost`) ;
 * - sur chaque réponse, les en-têtes de sécurité (`SECURITY`) : le site en https seulement pendant
 *   un an, même tapé en http, ses sous-domaines compris (un engagement d'un an pour tout
 *   sous-domaine de `pokecodex.fr`) ; pas de type deviné pour un fichier ; l'adresse d'origine
 *   réduite au site quand on suit un lien externe (Cardmarket) ; le site jamais dans le cadre d'un
 *   autre ; une fenêtre d'un autre site, ouverte depuis le site ou qui l'ouvre, sans accès à lui ;
 *   ni caméra, ni micro, ni position. En ligne, la politique de sécurité du contenu (`CSP`) :
 *   scripts, polices, requêtes et cadres du site seulement (un script injecté ne s'exécuterait
 *   pas), plus les petites polices que Vite intègre (`data:`) ; les images aussi d'ailleurs en
 *   https, pour l'adresse d'image collée dans une carte ; les styles en ligne de React et de camply
 *   acceptés ; aucun service worker. Pas en développement : Vite y écrit ses propres scripts dans
 *   la page ;
 * - les fichiers produits par Vite (`/assets/`, au nom unique) gardés un an par les navigateurs
 *   (les autres, toujours revalidés : `env.ASSETS` le fait déjà) ;
 * - les images, pour les pages du site seulement (un autre site ne les affiche pas) ;
 * - la page de l'app : hors des moteurs de recherche, sauf les pages publiques (l'accueil, la
 *   connexion, l'inscription, les mentions légales ; le Pokédex public d'un compte n'en est pas) ;
 *   et, quand le navigateur a une session (le cookie de Better Auth), les espèces préchargées sans
 *   attendre le script (elles ne servent qu'une fois connecté : un visiteur sur la connexion ne
 *   les télécharge pas). `crossorigin` : la même demande que le `fetch` de l'app.
 */

import type { MiddlewareHandler } from 'hono'

const SECURITY = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

/** Les pages publiques, que les moteurs de recherche indexent. */
const PUBLIC_PAGES = /^\/(connexion|inscription|mentions-legales)?$/

/** `www.pokecodex.fr/x` : `pokecodex.fr/x`, pour de bon. */
export const canonicalHost: MiddlewareHandler = async (c, next) => {
  const url = new URL(c.req.url)
  if (!url.hostname.startsWith('www.')) return next()
  url.hostname = url.hostname.slice('www.'.length)
  return c.redirect(url.href, 301)
}

export const siteHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  // Une copie : les réponses d'une liaison (`env.ASSETS`, `env.DATA`) ne se modifient pas.
  c.res = new Response(c.res.body, c.res)
  const { headers } = c.res
  for (const [name, value] of Object.entries(SECURITY)) headers.set(name, value)
  if (process.env.NODE_ENV === 'production') headers.set('Content-Security-Policy', CSP)
  const { path } = c.req
  if (path.startsWith('/assets/') && c.res.ok) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }
  if (path.startsWith('/images/')) headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  if (headers.get('Content-Type')?.startsWith('text/html')) {
    if (!PUBLIC_PAGES.test(path)) headers.set('X-Robots-Tag', 'noindex')
    if (/better-auth\.session_token=/.test(c.req.header('cookie') ?? '')) {
      headers.set('Link', '</api/species>; rel=preload; as=fetch; crossorigin')
    }
  }
}
