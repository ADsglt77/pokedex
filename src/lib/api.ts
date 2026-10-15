/**
 * La lecture de l'API du site (`/api/…`, `server/app.ts` ; les données de référence :
 * `server/reference.ts`) : les espèces, le catalogue, les prix et leur historique. Facultative,
 * sauf les espèces (`main.tsx`) : sans serveur, ou base encore vide, l'app s'affiche sans ces
 * données.
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

/**
 * Ce que l'app tire d'une réponse de l'API (le catalogue lu, les détails par espèce…), calculé
 * une fois par réponse : toujours la même promesse tant que `getJson` rend la même (lue par
 * `use()`), une nouvelle quand la réponse est redemandée après une panne.
 */
export function derived<T, R>(url: string, compute: (response: T | null) => R) {
  let last: { response: Promise<T | null>; value: Promise<R> } | null = null
  return () => {
    const response = getJson<T>(url)
    if (last?.response !== response) last = { response, value: settled(response.then(compute)) }
    return last.value
  }
}
