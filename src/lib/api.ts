/**
 * La lecture de l'API du site (`/api/…`, `server/app.ts` ; les données de référence :
 * `server/reference.ts`) : les espèces, le catalogue, les prix et leur historique, les lignes d'une
 * liste de souhaits Cardmarket, l'état des tâches du serveur. Facultative, sauf les espèces
 * (`main.tsx`) : sans serveur, ou base encore vide, l'app s'affiche sans ces données.
 */

import { settled } from '@/lib/settled'
import type { ServerStatus, WantsLines } from '@/types'

/**
 * Note dans le journal du serveur ce que le navigateur fait seul (`server/journal.ts`) : un export,
 * un import. Sans réponse, tant pis : ce n'est qu'un journal.
 */
export function report(event: 'export' | 'import') {
  fetch('/api/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {})
}

/** Une réponse demandée : sa promesse, et l'heure d'une panne passagère. */
interface Request {
  response: Promise<unknown>
  failedAt?: number
}

const requests = new Map<string, Request>()

/**
 * Une réponse de l'API, toujours la même promesse pour une adresse (lue par `use()`), tant qu'elle
 * n'est pas oubliée (`forget`) : `null` si elle manque (404). Une panne passagère (réseau, pas de
 * réponse en `timeout` ms, réponse illisible) donne aussi `null`, mais la réponse est redemandée la
 * prochaine fois qu'elle sert, une minute après au plus tôt : pas une requête à chaque affichage
 * tant que le serveur ne répond pas.
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
 * Oublie la réponse d'une adresse qui ne reviendra pas (les historiques d'une collection qui a
 * changé depuis) : `getJson` ne la garde plus en mémoire, et la redemanderait.
 */
export function forget(url: string) {
  requests.delete(url)
}

/**
 * Une réponse demandée à chaque appel, jamais celle d'un cache (« Réessayer » la redemande aussitôt,
 * pas une minute après comme `getJson`) : `null` si le serveur ne répond pas en 10 s, ou par une
 * erreur.
 */
const fetchFresh = <T>(url: string): Promise<T | null> =>
  fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    .then((response) => (response.ok ? (response.json() as Promise<T>) : null))
    .catch(() => null)

/**
 * Les lignes des produits Cardmarket `ids` pour « Ajouter une deck list » d'une liste de souhaits
 * (`/api/wants`), demandées à chaque appel (`fetchFresh`). Lue par `use()`.
 */
export const loadWantsLines = (ids: readonly number[]) =>
  settled(fetchFresh<WantsLines>(`/api/wants?ids=${ids.join()}`))

/**
 * L'état des tâches du serveur (`/api/status`), demandé à chaque appel (`fetchFresh`) ; `null` s'il
 * ne répond pas, ou s'il n'est pas de la même version que le site (pas encore redémarré après une
 * mise à jour). Lu par `use()`.
 */
export const loadStatus = () =>
  settled(fetchFresh<ServerStatus>('/api/status').then((status) => (status?.jobs ? status : null)))

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
