/**
 * Les prix Cardmarket, et TCGplayer pour les cartes sans prix Cardmarket : des fichiers du site
 * lui-même (`/prices/`), écrits chaque jour par `scripts/prices.ts` (sur le VPS : le service
 * `prices` ; en local : `bun run prices`). Facultatifs : sans eux, `null`, et l'app s'affiche
 * sans prix.
 */

import { create } from 'zustand'
import { settled } from '@/lib/settled'
import type { CardPriceHistory, PriceFile, Prices, TcgplayerPriceFile } from '@/types'

/** Un fichier demandé : sa promesse, et l'heure d'une panne passagère. */
interface FileRequest {
  file: Promise<unknown>
  failedAt?: number
}

const requests = new Map<string, FileRequest>()

/**
 * Un fichier de `/prices/`, toujours la même promesse pour une adresse (lue par `use()`) : `null`
 * s'il manque (404). Une panne passagère (réseau, pas de réponse en `timeout` ms, réponse
 * illisible) donne aussi `null`, mais le fichier est redemandé la prochaine fois qu'il sert, une
 * minute après au plus tôt : pas une requête à chaque affichage tant que le serveur ne répond pas.
 */
function getJson<T>(url: string, timeout?: number): Promise<T | null> {
  const known = requests.get(url)
  if (known && !(known.failedAt && Date.now() - known.failedAt > 60_000)) {
    return known.file as Promise<T | null>
  }
  const request: FileRequest = {
    file: settled(
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
  return request.file as Promise<T | null>
}

const usePriceStore = create<{ prices: Prices | null; loaded: boolean }>(() => ({
  prices: null,
  loaded: false,
}))

let requested: readonly Promise<unknown>[] = []

/**
 * Demande les prix du jour au premier écran qui en affiche (le fichier de Cardmarket couvre toutes
 * ses cartes, l'accueil et le Pokédex s'en passent), et de nouveau après une panne passagère.
 */
function requestPrices() {
  const files = [
    getJson<PriceFile>('/prices/latest.json'),
    getJson<TcgplayerPriceFile>('/prices/tcgplayer.json'),
  ] as const
  if (files.every((file, index) => file === requested[index])) return
  requested = files
  Promise.all(files).then(([cardmarket, tcgplayer]) => {
    // Les réponses d'une demande refaite depuis ne comptent plus.
    if (requested !== files) return
    usePriceStore.setState({
      prices: cardmarket || tcgplayer ? { cardmarket, tcgplayer } : null,
      loaded: true,
    })
  })
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

/**
 * L'historique d'une carte Cardmarket (son nom et ses prix), chargé à la demande ; `null` si le
 * serveur ne la connaît pas, ou ne répond pas en 10 s (l'enregistrement d'une carte l'attend : la
 * fenêtre ne doit pas rester bloquée ; redemandé plus tard). La même promesse pour un id, lue par
 * `use()`.
 */
export const loadPriceHistory = (cardmarket: number) =>
  getJson<CardPriceHistory>(`/prices/history/${cardmarket}.json`, 10_000)

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
