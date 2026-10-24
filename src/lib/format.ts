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

const listFormat = new Intl.ListFormat('fr-FR', { type: 'conjunction' })

/** « Pikachu et Zekrom », « Pikachu, Zekrom et Mew » */
export const formatList = (items: readonly string[]) => listFormat.format(items)

export const formatDecimal = (value: number) => spaced(decimalFormat.format(value))

/** « 12,5 % » : une part, au dixième. */
export const formatShare = (percent: number) => `${formatDecimal(percent)}\u00a0%`

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

/** Une date ISO mise en forme par `format` ; `null` sans date lisible. */
const dateWith = (format: Intl.DateTimeFormat) => (iso: string | null | undefined) => {
  const date = toDate(iso)
  return date && format.format(date)
}

export const formatDate = dateWith(dateFormat)

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
export const formatShortDate = (iso: string | null | undefined, withYear = false) =>
  dateWith(withYear ? shortDateYearFormat : shortDateFormat)(iso)

export const formatDateTime = dateWith(dateTimeFormat)

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

/**
 * Un montant saisi (« 12,50 », « 12.5 € », « 1 234,50 ») ; `null` s'il est illisible. Une espace
 * seulement entre les milliers : « 12 50 » (une virgule oubliée) serait sinon lu 1 250 €.
 */
export function parseEuros(text: string): number | null {
  const input = text.replace(/€/g, '').trim().replace(/\s+/g, ' ').replace(',', '.')
  return /^(\d{1,3}( \d{3})+|\d+)(\.\d{1,2})?$/.test(input)
    ? Number(input.replaceAll(' ', ''))
    : null
}

/**
 * Une quantité saisie : un nombre entier, en chiffres seulement (« 1e1 » ou « 0x2 » ne valent pas
 * 10 ni 2) ; `null` sinon. Elle multiplie le prix d'une ligne de commande.
 */
export const parseQuantity = (text: string) =>
  /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null

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

/** « Le Pokédex de Sacha », « Le Pokédex d’Adrien » : l’élision devant une voyelle ou un h. */
export function pokedexTitle(owner: string): string {
  const elided = /^[aeiouyàâäéèêëîïôöùûüh]/i.test(owner)
  return `Le Pokédex ${elided ? 'd’' : 'de '}${owner}`
}

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
  none: 'À acheter',
}

/**
 * Le statut d'une carte, le même mot partout où l'utilisateur voit les siennes (la fiche d'un
 * Pokémon, la grille d'une collection d'extension et la fenêtre d'une de ses cartes, le
 * Catalogue) : « Possédée », « Commandée », et sans statut « À acheter », comme la liste d'achats
 * qui la compte et « Ajouter comme ».
 */
export const statusLabel = (status: CardStatus | null) => STATUS_LABELS[status ?? 'none']

/**
 * Le statut d'une carte pour un visiteur du Pokédex public, qui ne dit rien des achats (et ne
 * reçoit pas « commandée ») : « Possédée », sinon « À débloquer ».
 */
export const publicStatusLabel = (status: CardStatus | null) =>
  status === 'owned' ? STATUS_LABELS.owned : 'À débloquer'

/**
 * Ce que coûte de quitter « possédée » (`CardStatusControls`, retirer une carte possédée) : la date
 * d'obtention, et le prix payé sauf pour « commandée ».
 */
export const LEAVING_OWNED: Record<Exclude<CardStatus, 'owned'> | 'none', string> = {
  none: 'Son statut, sa date d’obtention et son prix payé seront effacés.',
  ordered: 'Sa date d’obtention sera effacée.',
}

/** « Possédée depuis le 9 octobre 2026 », « Commandée »… */
export function statusCaption(status: CardStatus | null, acquiredAt: string | null): string {
  const date = status === 'owned' ? formatDate(acquiredAt) : null
  return date ? `Possédée depuis le ${date}` : statusLabel(status)
}

/** Des libellés → les options d'un `Select` ou d'un `SegmentedControl`, dans le même ordre. */
export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))

/** Titre de l'onglet : « Pikachu – PokéCodex », le nom du site. */
export const pageTitle = (name?: string) => (name ? `${name} – PokéCodex` : 'PokéCodex')
