/**
 * Les prix Cardmarket : des fichiers du site lui-même (`/prices/`), écrits chaque jour par
 * `scripts/prices.ts` (sur le VPS : le service `prices` ; en local : `bun run prices`).
 * Facultatifs : sans eux, `null`, et l'app s'affiche sans prix.
 */

import { create } from 'zustand'
import type { CardPriceHistory, PriceFile } from '@/types'

const getJson = (url: string) =>
  fetch(url)
    .then((response) => response.json())
    .catch(() => null)

const usePriceStore = create<{ prices: PriceFile | null; loaded: boolean }>(() => ({
  prices: null,
  loaded: false,
}))

let requested = false

/**
 * Demande les prix du jour, une fois, au premier écran qui en affiche : le fichier couvre toutes
 * les cartes de Cardmarket, l'accueil et le Pokédex s'en passent.
 */
function requestPrices() {
  if (requested) return
  requested = true
  getJson('/prices/latest.json').then((prices: PriceFile | null) =>
    usePriceStore.setState({ prices, loaded: true }),
  )
}

/** Les prix du jour ; `null` tant qu'ils ne sont pas arrivés, ou sans fichier de prix. */
export function usePrices() {
  requestPrices()
  return usePriceStore((state) => state.prices)
}

/** Le fichier des prix a été demandé, et il manque : on peut le dire (pas pendant le chargement). */
export function usePricesMissing() {
  requestPrices()
  return usePriceStore((state) => state.loaded && !state.prices)
}

const histories = new Map<number, Promise<CardPriceHistory | null>>()

/**
 * L'historique d'une carte Cardmarket (son nom et ses prix), chargé à la demande ; `null` si le
 * serveur ne la connaît pas. Toujours la même promesse pour un id, lue par `use()`.
 */
export function loadPriceHistory(cardmarket: number) {
  let history = histories.get(cardmarket)
  if (!history) histories.set(cardmarket, (history = getJson(`/prices/history/${cardmarket}.json`)))
  return history
}

const collections = new Map<string, Promise<CardPriceHistory[]>>()

/** Les historiques de plusieurs cartes (ceux que le serveur connaît) ; la même promesse par liste. */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  let all = collections.get(key)
  if (!all) {
    all = Promise.all(cardmarkets.map(loadPriceHistory)).then((list) =>
      list.filter((history) => history !== null),
    )
    collections.set(key, all)
  }
  return all
}
