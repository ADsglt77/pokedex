/**
 * Les prix Cardmarket, et TCGplayer pour les cartes sans id Cardmarket : des fichiers du site
 * lui-même (`/prices/`), écrits chaque jour par `scripts/prices.ts` (sur le VPS : le service
 * `prices` ; en local : `bun run prices`). Facultatifs : sans eux, `null`, et l'app s'affiche
 * sans prix.
 */

import { create } from 'zustand'
import { settled } from '@/lib/settled'
import type { CardPriceHistory, PriceFile, Prices, TcgplayerPriceFile } from '@/types'

/** Un fichier de `/prices/` ; `null` s'il manque, ou s'il n'arrive pas avant `timeout` (ms). */
const getJson = (url: string, timeout?: number) =>
  fetch(url, { signal: timeout ? AbortSignal.timeout(timeout) : undefined })
    .then((response) => response.json())
    .catch(() => null)

const usePriceStore = create<{ prices: Prices | null; loaded: boolean }>(() => ({
  prices: null,
  loaded: false,
}))

let requested = false

/**
 * Demande les prix du jour, une fois, au premier écran qui en affiche : le fichier de Cardmarket
 * couvre toutes ses cartes, l'accueil et le Pokédex s'en passent.
 */
function requestPrices() {
  if (requested) return
  requested = true
  Promise.all([getJson('/prices/latest.json'), getJson('/prices/tcgplayer.json')]).then(
    ([cardmarket, tcgplayer]: [PriceFile | null, TcgplayerPriceFile | null]) =>
      usePriceStore.setState({
        prices: cardmarket || tcgplayer ? { cardmarket, tcgplayer } : null,
        loaded: true,
      }),
  )
}

/** Les prix du jour ; `null` tant qu'ils ne sont pas arrivés, ou sans fichier de prix. */
export function usePrices() {
  requestPrices()
  return usePriceStore((state) => state.prices)
}

/** Les prix ont été demandés, et leurs fichiers manquent : on peut le dire (pas en chargement). */
export function usePricesMissing() {
  requestPrices()
  return usePriceStore((state) => state.loaded && !state.prices)
}

const histories = new Map<number, Promise<CardPriceHistory | null>>()

/**
 * L'historique d'une carte Cardmarket (son nom et ses prix), chargé à la demande ; `null` si le
 * serveur ne la connaît pas, ou ne répond pas en 10 s (l'enregistrement d'une carte l'attend : la
 * fenêtre ne doit pas rester bloquée). Toujours la même promesse pour un id, lue par `use()`.
 */
export function loadPriceHistory(cardmarket: number) {
  let history = histories.get(cardmarket)
  if (!history) {
    history = settled(getJson(`/prices/history/${cardmarket}.json`, 10_000))
    histories.set(cardmarket, history)
  }
  return history
}

const collections = new Map<string, Promise<CardPriceHistory[]>>()

/** Les historiques de plusieurs cartes (ceux que le serveur connaît) ; la même promesse par liste. */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  let all = collections.get(key)
  if (!all) {
    all = settled(
      Promise.all(cardmarkets.map(loadPriceHistory)).then((list) =>
        list.filter((history) => history !== null),
      ),
    )
    collections.set(key, all)
  }
  return all
}
