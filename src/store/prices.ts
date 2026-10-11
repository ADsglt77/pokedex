/**
 * Prix Cardmarket, servis par le site lui-même (`/prices/`, écrits chaque jour par le service
 * `prices` du VPS ; en local, `bun run prices`). Facultatifs : sans eux, l'app marche à l'identique,
 * sans prix.
 */

import { create } from 'zustand'
import type { CardPrice, PriceFile, PriceHistoryFile } from '@/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const amount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  return response.ok ? response.json() : null
}

/** Lecture tolérante : une carte au prix illisible est ignorée. */
function readPrices(value: unknown): PriceFile | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.date !== 'string') return null
  if (!isRecord(value.cards)) return null
  const cards: Record<string, CardPrice> = {}
  for (const [id, raw] of Object.entries(value.cards)) {
    const price = isRecord(raw) ? amount(raw.price) : null
    if (isRecord(raw) && price)
      cards[id] = { price, low: amount(raw.low), avg30: amount(raw.avg30) }
  }
  return { schemaVersion: 1, date: value.date, cards }
}

function readHistory(value: unknown): PriceHistoryFile | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.days)) return null
  if (!isRecord(value.cards) || !value.days.every((day) => typeof day === 'string')) return null
  const cards: Record<string, (number | null)[]> = {}
  for (const [id, series] of Object.entries(value.cards)) {
    if (Array.isArray(series)) cards[id] = series.map(amount)
  }
  return { schemaVersion: 1, days: value.days as string[], cards }
}

const usePriceStore = create<{ prices: PriceFile | null }>(() => ({ prices: null }))

// Demandés dès le chargement : ils arrivent pendant qu'on regarde la première page.
getJson('/prices/latest.json')
  .then(readPrices)
  .then((prices) => usePriceStore.setState({ prices }))
  .catch(() => {})

/** Les prix du jour, `null` tant qu'ils ne sont pas arrivés (ou s'il n'y en a pas). */
export const usePrices = () => usePriceStore((state) => state.prices)

let history: Promise<PriceHistoryFile | null> | null = null

/** L'historique, chargé au premier graphique (lu par `use()`) ; un échec est réessayé ensuite. */
export function loadPriceHistory() {
  history ??= getJson('/prices/history.json')
    .then(readHistory)
    .catch(() => {
      history = null
      return null
    })
  return history
}
