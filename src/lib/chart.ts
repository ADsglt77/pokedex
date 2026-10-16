/**
 * Les courbes dans le temps, jour par jour : leur période (7 jours au moins : en deçà, ce n'est pas
 * une évolution), leurs points et leurs chiffres. Aucun point n'est inventé : un jour sans donnée
 * (une carte sans prix ce jour-là) n'en a pas ; un cumul (Pokémon débloqués, dépenses), lui, vaut
 * le jour même ce qu'il valait la veille.
 */

import { formatEuro, formatPercent } from '@/lib/format'
import type { PricePoint } from '@/lib/prices'
import { addDays, daysBetween } from '@/lib/time'

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
export const windowDays = ({ from, to }: ChartWindow) => daysBetween(from, to) + 1

/** Le nombre de semaines d'une période, pour un rythme « par semaine ». */
export const weeksOf = (window: ChartWindow) => windowDays(window) / 7

/** Les points d'une série tombés dans la période. */
export const inWindow = (points: readonly PricePoint[], { from, to }: ChartWindow) =>
  points.filter((point) => point.date >= from && point.date <= to)

const cents = (value: number) => Math.round(value * 100) / 100 + 0

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
  events.reduce<string | null>(
    (first, { date }) => (!date || (first && first < date) ? first : date),
    null,
  )

/**
 * Les chiffres d'une série sur sa période : le premier et le dernier point, l'écart entre eux
 * (`changePercent` : `null` si elle partait de 0), le plus bas, le plus haut, la moyenne ; `null`
 * sans aucun point.
 */
export function seriesStats(points: readonly PricePoint[]) {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return null
  const values = points.map((point) => point.value)
  return {
    first: first.value,
    last: last.value,
    change: cents(last.value - first.value),
    changePercent: first.value ? (last.value - first.value) / first.value : null,
    min: Math.min(...values),
    max: Math.max(...values),
    average: cents(values.reduce((sum, value) => sum + value, 0) / values.length),
  }
}

/** Un chiffre sous une courbe : « Plus haut », « 160,00 € ». */
export interface ChartStat {
  label: string
  value: string
}

/** L'écart, signé : « +12,50 € (+8 %) », « −3 € » ; le pourcentage, s'il y en a un. */
const signed = (value: number, format: (value: number) => string) =>
  value > 0 ? `+${format(value)}` : format(value)

/**
 * Les chiffres d'un prix (ou d'une valeur) sur sa période : son écart du premier au dernier jour,
 * son plus haut, son plus bas, sa moyenne.
 */
export function levelStats(points: readonly PricePoint[], format = formatEuro): ChartStat[] {
  const stats = seriesStats(points)
  if (!stats) return []
  const percent = stats.changePercent === null ? '' : ` (${formatPercent(stats.changePercent)})`
  return [
    { label: 'Évolution', value: `${signed(stats.change, format)}${percent}` },
    { label: 'Plus haut', value: format(stats.max) },
    { label: 'Plus bas', value: format(stats.min) },
    { label: 'Moyenne', value: format(stats.average) },
  ]
}
