/**
 * Les prix Cardmarket, et TCGplayer pour les cartes sans prix Cardmarket : l'API du site
 * (`/api/prices`), que la tâche d'ingestion `prices` met à jour (`server/jobs/prices.ts`).
 * Facultatifs : sans eux (serveur arrêté, base encore vide), `null`, et l'app s'affiche sans prix.
 */

import { create } from 'zustand'
import { getJson } from '@/lib/api'
import { settled } from '@/lib/settled'
import type { CardPriceHistory, Prices } from '@/types'

const usePriceStore = create<{ prices: Prices | null; loaded: boolean }>(() => ({
  prices: null,
  loaded: false,
}))

let requested: Promise<Prices | null> | null = null

/**
 * Demande les prix du jour au premier écran qui en affiche (ceux de Cardmarket couvrent toutes ses
 * cartes, l'accueil et le Pokédex s'en passent), et de nouveau après une panne passagère.
 */
function requestPrices() {
  const response = getJson<Prices>('/api/prices')
  if (response === requested) return
  requested = response
  response.then((prices) => {
    // La réponse d'une demande refaite depuis ne compte plus.
    if (requested !== response) return
    usePriceStore.setState({
      prices: prices?.cardmarket || prices?.tcgplayer ? prices : null,
      loaded: true,
    })
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

const collections = new Map<
  string,
  { parts: Promise<CardPriceHistory | null>[]; all: Promise<CardPriceHistory[]> }
>()

/**
 * Les historiques de plusieurs cartes (ceux que le serveur connaît) ; la même promesse par liste,
 * refaite si l'un d'eux est redemandé après une panne.
 */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  const parts = cardmarkets.map(loadPriceHistory)
  const known = collections.get(key)
  if (known && parts.every((part, index) => part === known.parts[index])) return known.all
  const all = settled(Promise.all(parts).then((list) => list.filter((history) => history !== null)))
  collections.set(key, { parts, all })
  return all
}
