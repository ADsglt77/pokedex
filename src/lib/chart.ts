/**
 * Les courbes dans le temps, jour par jour : leur période (7 jours au moins : en deçà, ce n'est pas
 * une évolution), leurs points et leurs chiffres. Aucun point n'est inventé : un jour sans donnée
 * (une carte sans prix ce jour-là) n'en a pas ; un cumul (Pokémon débloqués, dépenses), lui, vaut
 * le jour même ce qu'il valait la veille.
 */

import { formatEuro, formatEuroChange, formatPercent } from '@/lib/format'
import { cents } from '@/lib/orders'
import { addDays, daysBetween } from '@/lib/time'

/** Un point d'une courbe : un jour (YYYY-MM-DD) et sa valeur. */
export interface PricePoint {
  date: string
  value: number
}

export type ChartPeriod = 'week' | 'month' | 'year' | 'all'

export const CHART_PERIOD_LABELS: Record<ChartPeriod, string> = {
  week: '7 jours',
  month: '30 jours',
  year: '1 an',
  all: 'Tout',
}

const PERIOD_DAYS: Record<Exclude<ChartPeriod, 'all'>, number> = { week: 7, month: 30, year: 365 }

/** Le moins de jours d'une courbe. */
const MIN_DAYS = 7

/** Les jours d'une courbe, du premier au dernier inclus (YYYY-MM-DD). */
export interface ChartWindow {
  from: string
  to: string
}

/**
 * La période qui finit `to` (aujourd'hui) : 7, 30 ou 365 jours ; « Tout » depuis `first`, le jour
 * de la première donnée (7 jours au moins).
 */
export function periodWindow(period: ChartPeriod, to: string, first: string | null): ChartWindow {
  const days =
    period === 'all'
      ? Math.max(MIN_DAYS, first ? daysBetween(first, to) + 1 : 0)
      : PERIOD_DAYS[period]
  return { from: addDays(to, 1 - days), to }
}

/** Le nombre de jours d'une période. */
const windowDays = ({ from, to }: ChartWindow) => daysBetween(from, to) + 1

/** Le nombre de semaines d'une période, pour un rythme « par semaine ». */
export const weeksOf = (window: ChartWindow) => windowDays(window) / 7

/** Les points d'une série tombés dans la période. */
export const inWindow = (points: readonly PricePoint[], { from, to }: ChartWindow) =>
  points.filter((point) => point.date >= from && point.date <= to)

/**
 * Un cumul, un point par jour de la période : la somme des montants (`events` : un jour, un
 * montant ; sans jour, « », avant toute période) jusqu'à ce jour. `carried` : ceux d'avant la
 * période comptent dès son premier jour (un total, les Pokémon débloqués) ; sinon le cumul part de
 * zéro (ce qui a été dépensé depuis).
 */
export function runningTotal(
  events: readonly PricePoint[],
  window: ChartWindow,
  carried: boolean,
): PricePoint[] {
  const byDay = new Map<string, number>()
  let total = 0
  for (const { date, value } of events) {
    if (date < window.from) {
      if (carried) total += value
    } else if (date <= window.to) byDay.set(date, (byDay.get(date) ?? 0) + value)
  }
  return Array.from({ length: windowDays(window) }, (_, day) => {
    const date = addDays(window.from, day)
    total += byDay.get(date) ?? 0
    return { date, value: cents(total) }
  })
}

/** Le premier jour d'une série d'évènements (`null` sans aucun daté). */
export const firstDate = (events: readonly PricePoint[]) =>
  events.flatMap(({ date }) => date || []).sort()[0] ?? null

/** Un chiffre sous une courbe : « Plus haut », « 160,00 € ». */
export interface ChartStat {
  label: string
  value: string
}

/**
 * Les chiffres d'un prix (ou d'une valeur) sur sa période : son écart du premier au dernier jour,
 * signé (« +12,50 € (+8 %) » ; sans pourcentage si elle partait de 0), son plus haut, son plus
 * bas, sa moyenne ; aucun sans point.
 */
export function levelStats(points: readonly PricePoint[]): ChartStat[] {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return []
  const values = points.map((point) => point.value)
  const change = last.value - first.value
  const percent = first.value ? ` (${formatPercent(change / first.value)})` : ''
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return [
    { label: 'Évolution', value: `${formatEuroChange(cents(change))}${percent}` },
    { label: 'Plus haut', value: formatEuro(Math.max(...values)) },
    { label: 'Plus bas', value: formatEuro(Math.min(...values)) },
    { label: 'Moyenne', value: formatEuro(cents(average)) },
  ]
}
