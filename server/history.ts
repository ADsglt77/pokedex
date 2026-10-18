/**
 * L'historique des prix Cardmarket (Cardmarket n'en garde pas) : en base, un tableau par carte et
 * par année, à partir de son premier jour avec un prix ; pour l'app, la forme de toujours
 * (`CardPriceHistory`) : un prix par jour depuis le premier jour où la carte en a un.
 */

import type { Database } from 'bun:sqlite'
import { addDays, DAY, daysBetween } from '@/lib/time'
import type { CardPriceHistory } from '@/types'

/** `2026-10-14` → [2026, 286] : l'année et le jour de l'année (0 : 1er janvier). */
export function yearDay(date: string): [number, number] {
  const year = Number(date.slice(0, 4))
  return [year, (Date.parse(date) - Date.UTC(year, 0, 1)) / DAY]
}

/** Une année d'historique, telle qu'enregistrée : les prix à partir du jour de l'année `first`. */
export interface HistoryYear {
  year: number
  first: number
  prices: (number | null)[]
}

/**
 * L'année `year` avec le prix du jour `day` : `known` (l'année enregistrée) si elle l'avait déjà,
 * rien à réécrire ; sinon une copie, ou une nouvelle année sans `known`.
 */
export function withPrice(
  known: HistoryYear | undefined,
  year: number,
  day: number,
  price: number,
): HistoryYear {
  if (!known) return { year, first: day, prices: [price] }
  if (known.prices[day - known.first] === price) return known
  const first = Math.min(known.first, day)
  const prices = [...Array<null>(known.first - first).fill(null), ...known.prices]
  while (prices.length < day - first) prices.push(null)
  prices[day - first] = price
  return { year, first, prices }
}

/** Les années d'un historique (`from`, un prix par jour) : sa forme en base. */
export function splitYears({ from, prices }: Pick<CardPriceHistory, 'from' | 'prices'>) {
  const years = new Map<number, HistoryYear>()
  prices.forEach((price, index) => {
    if (price === null) return
    const [year, day] = yearDay(addDays(from, index))
    years.set(year, withPrice(years.get(year), year, day, price))
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
    const offset = daysBetween(from, addDays(`${year}-01-01`, first))
    while (prices.length < offset) prices.push(null)
    prices.push(...list)
  }
  return { from, prices }
}

/**
 * La lecture de l'historique d'une carte Cardmarket, requête préparée une fois (l'API en lit
 * jusqu'à 1 025 par demande) : `null` si elle n'en a pas.
 */
export function historyReader(db: Database) {
  // Chaque année de la carte, avec son nom chez Cardmarket (vide hors de la liste des produits).
  const years = db.query(
    `SELECT history.year, history.first, history.prices, products.name
     FROM cardmarket_history AS history
     LEFT JOIN cardmarket_products AS products ON products.id = history.id
     WHERE history.id = ? ORDER BY history.year`,
  )
  return (id: number): CardPriceHistory | null => {
    const rows = years.all(id) as {
      year: number
      first: number
      prices: string
      name: string | null
    }[]
    const joined = joinYears(
      rows.map(({ year, first, prices }) => ({ year, first, prices: JSON.parse(prices) })),
    )
    return joined && { name: rows[0]!.name, ...joined }
  }
}
