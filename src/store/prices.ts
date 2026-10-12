/**
 * Les prix Cardmarket : des fichiers du site lui-même (`/prices/`), écrits chaque jour par
 * `scripts/prices.ts` (sur le VPS : le service `prices` ; en local : `bun run prices`).
 * Facultatifs : sans eux, `null`, et l'app s'affiche sans prix.
 */

import { create } from 'zustand'
import type { PriceFile, PriceHistoryFile } from '@/types'

const getJson = (url: string) =>
  fetch(url)
    .then((response) => response.json())
    .catch(() => null)

const usePriceStore = create<{ prices: PriceFile | null; loaded: boolean }>(() => ({
  prices: null,
  loaded: false,
}))

// Demandés dès le chargement de l'app : ils arrivent pendant qu'on regarde la première page.
getJson('/prices/latest.json').then((prices: PriceFile | null) =>
  usePriceStore.setState({ prices, loaded: true }),
)

/** Les prix du jour ; `null` tant qu'ils ne sont pas arrivés, ou sans fichier de prix. */
export const usePrices = () => usePriceStore((state) => state.prices)

/** Le fichier des prix a été demandé, et il manque : on peut le dire (pas pendant le chargement). */
export const usePricesMissing = () => usePriceStore((state) => state.loaded && !state.prices)

let history: Promise<PriceHistoryFile | null> | undefined

/** L'historique, chargé au premier graphique ; toujours la même promesse, lue par `use()`. */
export const loadPriceHistory = () => (history ??= getJson('/prices/history.json'))
