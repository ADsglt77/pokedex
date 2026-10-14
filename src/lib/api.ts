/**
 * La lecture de l'API du site (`/api/…`, `server/index.ts`) : le catalogue, les prix et leur
 * historique. Facultative : sans serveur, ou base encore vide, l'app s'affiche sans ces données.
 */

import { settled } from '@/lib/settled'

/** Une réponse demandée : sa promesse, et l'heure d'une panne passagère. */
interface Request {
  response: Promise<unknown>
  failedAt?: number
}

const requests = new Map<string, Request>()

/**
 * Une réponse de l'API, toujours la même promesse pour une adresse (lue par `use()`) : `null`
 * si elle manque (404). Une panne passagère (réseau, pas de réponse en `timeout` ms, réponse
 * illisible) donne aussi `null`, mais la réponse est redemandée la prochaine fois qu'elle sert, une
 * minute après au plus tôt : pas une requête à chaque affichage tant que le serveur ne répond pas.
 */
export function getJson<T>(url: string, timeout?: number): Promise<T | null> {
  const known = requests.get(url)
  if (known && !(known.failedAt && Date.now() - known.failedAt > 60_000)) {
    return known.response as Promise<T | null>
  }
  const request: Request = {
    response: settled(
      fetch(url, { signal: timeout ? AbortSignal.timeout(timeout) : undefined })
        .then((response) => {
          if (response.status === 404) return null
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json()
        })
        .catch(() => {
          request.failedAt = Date.now()
          return null
        }),
    ),
  }
  requests.set(url, request)
  return request.response as Promise<T | null>
}
