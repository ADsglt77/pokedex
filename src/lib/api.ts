/**
 * La lecture de l'API du site (`/api/…`, `server/app.ts` ; les données de référence : l'API des
 * données, que nginx joint) : les espèces, le catalogue, les prix et leur historique, les lignes
 * d'une liste de souhaits Cardmarket (`store/prices.ts`), l'état des tâches de l'API des données.
 * Facultative, sauf les espèces pour la coquille et le Pokédex public (`router.tsx`) : sans
 * serveur, ou base encore vide, l'app s'affiche sans ces données, et la connexion, l'inscription
 * et les mentions légales sans rien d'elle.
 */

import { settled } from '@/lib/settled'
import type { ServerStatus } from '@/types'

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
 * Une panne passagère (à `failedAt`, ms) redemandable : une minute après. Ni à chaque affichage,
 * ni jamais : la règle de `getJson`, des prix et des historiques (`store/prices.ts`).
 */
export const retryDue = (failedAt: number | undefined) =>
  failedAt !== undefined && Date.now() - failedAt > 60_000

/**
 * Une réponse de l'API, toujours la même promesse pour une adresse (lue par `use()`), tant qu'elle
 * n'est pas oubliée (`forget`) : `null` si elle manque (404). Une panne passagère (réseau, pas de
 * réponse en `timeout` ms, réponse illisible) donne aussi `null`, mais la réponse est redemandée la
 * prochaine fois qu'elle sert, une minute après au plus tôt : pas une requête à chaque affichage
 * tant que le serveur ne répond pas.
 */
export function getJson<T>(url: string, timeout?: number): Promise<T | null> {
  const known = requests.get(url)
  if (known && !retryDue(known.failedAt)) return known.response as Promise<T | null>

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

/** La réponse de `url` (`getJson`) manque-t-elle par une panne passagère, et non un 404 ? */
export const requestFailed = (url: string) => requests.get(url)?.failedAt !== undefined

/**
 * Compte la réponse de `url` (`getJson`), arrivée mais inutilisable, comme une panne passagère :
 * redemandée une minute après au plus tôt. Les prix du jour : un 404 tant que l'API des données
 * n'a jamais lu leur guide, une réponse d'une autre forme d'un serveur pas encore à jour ; rien ne
 * dit qu'ils manqueront encore. Une adresse oubliée depuis (`forget`) n'a plus rien à compter.
 */
export function markFailed(url: string) {
  const request = requests.get(url)
  if (request) request.failedAt ??= Date.now()
}

/**
 * Une réponse demandée à chaque appel, jamais celle d'un cache (« Réessayer » la redemande aussitôt,
 * pas une minute après comme `getJson`) : `null` si le serveur ne répond pas en 10 s, ou par une
 * erreur. Les lignes de la liste de souhaits (`loadWantsLines`, `store/prices.ts`), l'état des
 * tâches.
 */
export const fetchFresh = <T>(url: string): Promise<T | null> =>
  fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    .then((response) => (response.ok ? (response.json() as Promise<T>) : null))
    .catch(() => null)

/**
 * L'état des tâches de l'API des données (`/api/status`), demandé à chaque appel (`fetchFresh`) ;
 * `null` si elle ne répond pas, ou si sa réponse n'a pas la forme attendue. La cause d'un
 * échec n'est que dans son journal : elle peut nommer une source, et tout le monde peut avoir un
 * compte. Lu par `use()`.
 */
export const loadStatus = () =>
  settled(
    fetchFresh<ServerStatus>('/api/status').then((status) =>
      Array.isArray(status?.jobs) ? status : null,
    ),
  )

/** Ce que l'app a tiré de chaque réponse de `getJson` (`derived`), oublié avec elle. */
const derivations = new WeakMap<Promise<unknown>, Promise<unknown>>()

/**
 * Ce que l'app tire de la réponse de `url` (le catalogue lu, les détails par espèce…), calculé une
 * fois par réponse : toujours la même promesse tant que `getJson` rend la même (lue par `use()`),
 * une nouvelle quand la réponse est redemandée (panne, `forget`). Un seul calcul par adresse.
 * `timeout` : celui de `getJson`.
 */
export function derived<T, R>(
  url: string,
  compute: (response: T | null) => R,
  timeout?: number,
): Promise<R> {
  const response = getJson<T>(url, timeout)
  let value = derivations.get(response)
  if (!value) {
    value = settled(response.then(compute))
    derivations.set(response, value)
  }
  return value as Promise<R>
}
