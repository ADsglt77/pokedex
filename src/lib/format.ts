import type { CardStatus, PokemonCard } from '@/types'

const integerFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimalFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

export const formatInteger = (value: number) => integerFormat.format(value)

export const formatDecimal = (value: number) => decimalFormat.format(value)

function toDate(iso: string | null | undefined): Date | null {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

export function formatDate(iso: string | null | undefined): string | null {
  const date = toDate(iso)
  return date && dateFormat.format(date)
}

const shortDateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** « 11 oct. » */
export function formatShortDate(iso: string | null | undefined): string | null {
  const date = toDate(iso)
  return date && shortDateFormat.format(date)
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
export const formatEuro = (value: number) => euroFormat.format(value)

/** « +12,00 € », « −3,50 € » : un gain ou une perte. */
export const formatEuroChange = (value: number) => signedEuroFormat.format(value)

/** Un montant saisi (« 12,50 », « 12.5 € ») ; `null` s'il est illisible. */
export function parseEuros(text: string): number | null {
  const input = text.replace(/[\s€]/g, '').replace(',', '.')
  return /^\d+(\.\d{1,2})?$/.test(input) ? Number(input) : null
}

/** Un montant à éditer : « 12,50 ». */
export const euroInput = (value: number) => value.toFixed(2).replace('.', ',')

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

/** « ポケモンカード151 (2023) » : l'extension d'une carte et son année. */
export function setLabel(card: Pick<PokemonCard, 'set'>): string | null {
  const name = card.set?.name
  const year = card.set?.releaseDate?.slice(0, 4)
  return name ? (year ? `${name} (${year})` : name) : null
}

/** Titre de l'onglet : « Pikachu – Mon Pokédex ». */
export const pageTitle = (name?: string) => (name ? `${name} – Mon Pokédex` : 'Mon Pokédex')
