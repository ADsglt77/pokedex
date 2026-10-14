/**
 * L'historique des prix Cardmarket (Cardmarket n'en garde pas) : en base, un tableau par carte et
 * par année, à partir de son premier jour avec un prix ; pour l'app, la forme de toujours
 * (`CardPriceHistory`) : un prix par jour depuis le premier jour où la carte en a un.
 */

import type { Database } from 'bun:sqlite'
import type { CardPriceHistory } from '@/types'

const DAY = 86_400_000

/** `2026-10-14` → [2026, 286] : l'année et le jour de l'année (0 : 1er janvier). */
export function yearDay(date: string): [number, number] {
  const year = Number(date.slice(0, 4))
  return [year, (Date.parse(date) - Date.UTC(year, 0, 1)) / DAY]
}

/** Le jour qui suit `date` de `days` jours. */
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10)

/** Une année d'historique, telle qu'enregistrée : les prix à partir du jour de l'année `first`. */
export interface HistoryYear {
  year: number
  first: number
  prices: (number | null)[]
}

/** L'année avec le prix du jour `day` : la même si elle l'avait déjà, sinon une copie. */
export function withPrice(known: HistoryYear, day: number, price: number): HistoryYear {
  if (known.prices[day - known.first] === price) return known
  const first = Math.min(known.first, day)
  const prices = [...Array<null>(known.first - first).fill(null), ...known.prices]
  while (prices.length < day - first) prices.push(null)
  prices[day - first] = price
  return { year: known.year, first, prices }
}

/** Les années d'un historique (`from`, un prix par jour) : sa forme en base. */
export function splitYears({ from, prices }: Pick<CardPriceHistory, 'from' | 'prices'>) {
  const years = new Map<number, HistoryYear>()
  prices.forEach((price, index) => {
    if (price === null) return
    const [year, day] = yearDay(addDays(from, index))
    const known = years.get(year)
    years.set(year, known ? withPrice(known, day, price) : { year, first: day, prices: [price] })
  })
  return [...years.values()]
}

/**
 * Les années, dans l'ordre, mises bout à bout : un prix par jour, du premier au dernier prix ;
 * `null` si aucune n'en a.
 */
export function joinYears(years: HistoryYear[]): Pick<CardPriceHistory, 'from' | 'prices'> | null {
  const [head] = years
  if (!head) return null
  const from = addDays(`${head.year}-01-01`, head.first)
  const prices: (number | null)[] = []
  for (const { year, first, prices: list } of years) {
    // Les jours sans prix entre deux années restent `null`.
    const offset = (Date.parse(addDays(`${year}-01-01`, first)) - Date.parse(from)) / DAY
    while (prices.length < offset) prices.push(null)
    prices.push(...list)
  }
  return { from, prices }
}

/** L'historique d'une carte Cardmarket ; `null` si elle n'en a pas. */
export function readHistory(db: Database, id: number): CardPriceHistory | null {
  const rows = db
    .query('SELECT year, first, prices FROM cardmarket_history WHERE id = ? ORDER BY year')
    .all(id) as { year: number; first: number; prices: string }[]
  const joined = joinYears(rows.map((row) => ({ ...row, prices: JSON.parse(row.prices) })))
  if (!joined) return null
  const product = db.query('SELECT name FROM cardmarket_products WHERE id = ?').get(id) as {
    name: string
  } | null
  return { name: product?.name ?? null, ...joined }
}
