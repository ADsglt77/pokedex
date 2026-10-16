/** Mise en forme française (nombres, dates, montants) et lecture des montants et liens saisis. */

import type { CardStatus } from '@/types'

const integerFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/**
 * Les nombres français séparent les milliers (et le symbole €) par une espace fine insécable, que
 * les polices de l'app n'ont pas : elle disparaîtrait (« 1025 »). L'espace insécable la remplace.
 */
const spaced = (text: string) => text.replaceAll(' ', ' ')

export const formatInteger = (value: number) => spaced(integerFormat.format(value))

export const formatDecimal = (value: number) => spaced(decimalFormat.format(value))

/** Le jour (YYYY-MM-DD) d'une date, dans le fuseau de l'utilisateur. */
const localDay = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-')

/** Aujourd'hui (YYYY-MM-DD), dans le fuseau de l'utilisateur. */
export const today = () => localDay(new Date())

/**
 * Le jour local d'un instant ISO (une date d'obtention, en UTC) : le 1er novembre à 0 h 30 à Paris
 * est enregistré le 31 octobre en UTC, mais compte en novembre.
 */
export const localDayOf = (iso: string) => localDay(new Date(iso))

/** Une date ISO ; un jour seul (`2026-10-09`) est lu à midi, heure locale : jamais la veille. */
function toDate(iso: string | null | undefined): Date | null {
  const date = iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

export function formatDate(iso: string | null | undefined): string | null {
  const date = toDate(iso)
  return date && dateFormat.format(date)
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

/** `2026-10` → « octobre 2026 » */
export const formatMonth = (month: string) => monthFormat.format(toDate(`${month}-01`)!)

const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const shortDateYearFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** « 11 oct. » ; `withYear` : « 11 oct. 2026 ». */
export function formatShortDate(iso: string | null | undefined, withYear = false): string | null {
  const date = toDate(iso)
  return date && (withYear ? shortDateYearFormat : shortDateFormat).format(date)
}

export function formatDateTime(iso: string | null | undefined): string | null {
  const date = toDate(iso)
  return date && dateTimeFormat.format(date)
}

const euroFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const signedEuroFormat = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'exceptZero',
})

/** « 1 234,50 € » */
export const formatEuro = (value: number) => spaced(euroFormat.format(value))

/** « +12,00 € », « −3,50 € » : un gain ou une perte. */
export const formatEuroChange = (value: number) => spaced(signedEuroFormat.format(value))

const percentChangeFormat = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})

/** « −18 % », « +5 % » : une variation (−0,18 → « −18 % »). */
export const formatPercent = (value: number) => spaced(percentChangeFormat.format(value))

/** Un montant saisi (« 12,50 », « 12.5 € ») ; `null` s'il est illisible. */
export function parseEuros(text: string): number | null {
  const input = text.replace(/[\s€]/g, '').replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(input) ? Number(input) : null
}

/** Une adresse web saisie ; `null` si ce n'en est pas une. */
export function parseLink(text: string): URL | null {
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/** Un montant à éditer : « 12,50 ». */
export const euroInput = (value: number) => value.toFixed(2).replace('.', ',')

/** « 3 cartes · payées 120,00 € » : les précisions d'une valeur, sans les vides. */
export const details = (...parts: (string | 0 | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' · ')

/** « 1 carte », « 3 cartes » ; « Pokémon » reste invariable. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatInteger(count)} ${count > 1 ? pluralForm : singular}`
}

/** « 37 débloqués sur 1 025 », « 37 Pokémon débloqués sur 1 025 » avec `noun`. */
export function unlockedOf({ unlocked, total }: { unlocked: number; total: number }, noun = '') {
  const word = unlocked > 1 ? 'débloqués' : 'débloqué'
  return `${formatInteger(unlocked)} ${noun ? `${noun} ${word}` : word} sur ${formatInteger(total)}`
}

/** « N° 0025 » */
export const formatDexNumber = (id: number) => `N°\u00a0${String(id).padStart(4, '0')}`

const STATUS_LABELS: Record<CardStatus | 'none', string> = {
  owned: 'Possédée',
  ordered: 'Commandée',
  wanted: 'Souhaitée',
  none: 'Non possédée',
}

export const statusLabel = (status: CardStatus | null) => STATUS_LABELS[status ?? 'none']

/** « Possédée depuis le 9 octobre 2026 », « Commandée »… */
export function statusCaption(status: CardStatus | null, acquiredAt: string | null): string {
  const date = status === 'owned' ? formatDate(acquiredAt) : null
  return date ? `Possédée depuis le ${date}` : statusLabel(status)
}

/** Des libellés → les options d'un `Select` ou d'un `SegmentedControl`, dans le même ordre. */
export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))

/** Titre de l'onglet : « Pikachu – Mon Pokédex ». */
export const pageTitle = (name?: string) => (name ? `${name} – Mon Pokédex` : 'Mon Pokédex')

/** Les mois de `first` à `last` compris (`YYYY-MM`) : « 2026-11 », « 2026-12 », « 2027-01 »… */
export function monthRange(first: string, last: string): string[] {
  const months: string[] = []
  for (let month = first; month <= last;) {
    months.push(month)
    const [year, index] = month.split('-').map(Number) as [number, number]
    month = index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`
  }
  return months
}
