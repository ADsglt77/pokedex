/**
 * Les prix Cardmarket : l'API du site
 * (`/api/prices`), que la tâche d'ingestion `prices` met à jour (`server/jobs/prices.ts`), et leur
 * historique (`/api/prices/<id>` pour une carte, `/api/histories` pour la collection).
 * Facultatifs : sans eux (serveur arrêté, base encore vide), `null`, et l'app s'affiche sans prix.
 */

import { create } from 'zustand'
import { forget, getJson } from '@/lib/api'
import { historiesOf } from '@/lib/prices'
import { settled } from '@/lib/settled'
import type { CardPriceHistory, PriceFile, PriceHistories } from '@/types'

const usePriceStore = create<{ prices: PriceFile | null; loaded: boolean }>(() => ({
  prices: null,
  loaded: false,
}))

let requested: Promise<PriceFile | null> | null = null

/**
 * Demande les prix du jour au premier écran qui en affiche (ceux de Cardmarket couvrent toutes ses
 * cartes : l'accueil en affiche, avec la valeur de la collection ; le Pokédex s'en passe), et de
 * nouveau après une panne passagère.
 */
function requestPrices() {
  const response = getJson<PriceFile>('/api/prices')
  if (response === requested) return
  requested = response
  response.then((prices) => {
    // La réponse d'une demande refaite depuis ne compte plus.
    if (requested !== response) return
    // Une réponse d'une autre forme (un serveur pas encore à jour) compte comme pas de prix.
    usePriceStore.setState({ prices: prices?.cards ? prices : null, loaded: true })
  })
}

/** Les prix du jour ; `null` tant qu'ils ne sont pas arrivés, ou sans prix. */
export function usePrices() {
  requestPrices()
  return usePriceStore((state) => state.prices)
}

/** Les prix ont été demandés, et ils manquent : on peut le dire (pas en chargement). */
export function usePricesMissing() {
  requestPrices()
  return usePriceStore((state) => state.loaded && !state.prices)
}

/**
 * L'historique d'une carte Cardmarket (son nom et ses prix), chargé à la demande ; `null` si le
 * serveur ne la connaît pas, ou ne répond pas en 10 s (l'enregistrement d'une carte l'attend : la
 * fenêtre ne doit pas rester bloquée ; redemandé plus tard). La même promesse pour un id, lue par
 * `use()`.
 */
export const loadPriceHistory = (cardmarket: number) =>
  getJson<CardPriceHistory>(`/api/prices/${cardmarket}`, 10_000)

/** Les historiques d'une collection (`loadPriceHistories`). */
interface CollectionHistories {
  histories: CardPriceHistory[]
  /** Les cartes absentes de la réponse : celle gardée par le service worker, d'avant elles. */
  missing: number
}

/**
 * La dernière liste demandée, seule gardée : une liste d'avant (la collection a changé depuis) ne
 * revient pas, et sa réponse (les historiques de toute la collection) pèse plusieurs Mo.
 */
let last: {
  url: string
  key: string
  response: Promise<PriceHistories | null>
  histories: Promise<CollectionHistories | null>
} | null = null

/**
 * Les historiques des cartes `cardmarkets` (au moins une), ceux que le serveur connaît, en une
 * demande (`/api/histories`, chaque id une fois) relue dans l'ordre de la liste (`historiesOf`) ;
 * `null` si le serveur ne répond pas. Le serveur répond pour chaque id (`null` sans historique) : un
 * id absent vient d'une copie du service worker demandée avec d'autres ids (sans réseau, ou sans
 * réponse en 4 s), comptée dans `missing`. La même promesse pour la même liste, lue par `use()`,
 * refaite quand la réponse est redemandée après une panne (`getJson`).
 */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  const url = `/api/histories?ids=${[...new Set(cardmarkets)].join()}`
  if (last && last.url !== url) forget(last.url)
  const response = getJson<PriceHistories>(url)
  if (last?.key === key && last.response === response) return last.histories
  const histories = settled(
    response.then(
      (found) =>
        found && {
          histories: historiesOf(found, cardmarkets),
          missing: cardmarkets.filter((id) => !(id in found)).length,
        },
    ),
  )
  last = { url, key, response, histories }
  return histories
}
