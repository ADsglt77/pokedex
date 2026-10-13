/** Export et import de la collection, et sa relecture depuis le stockage du navigateur. */

import { ORDER_STATE_LABELS, PRIORITY_LABELS, SUPPLIER_LABELS } from '@/config/shopping'
import { parseCardmarketLink } from '@/lib/cardmarket'
import { parseLink, today } from '@/lib/format'
import type { CollectionData, CollectionExportFile, ShoppingData } from '@/types'

export function buildExportFile(
  collection: CollectionData,
  shopping: ShoppingData,
): CollectionExportFile {
  return {
    app: 'pokedex-collection',
    kind: 'collection-export',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    collection,
    shopping,
  }
}

/** Fait télécharger un fichier au navigateur. */
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  // Firefox ne télécharge que par un lien présent dans la page, et lit le fichier après le clic.
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Télécharge le fichier d'export, daté du jour de l'utilisateur ; rend son nom. */
export function downloadExport(file: CollectionExportFile): string {
  const name = `pokedex-collection-${today()}.json`
  downloadFile(name, JSON.stringify(file, null, 2), 'application/json')
  return name
}

/** Le JSON d'une valeur enregistrée ou d'un fichier ; `null` s'il est absent ou illisible. */
export function parseStored(text: string | null): unknown {
  try {
    return JSON.parse(text ?? 'null')
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Une collection, telle qu'enregistrée ; `null` si ce n'en est pas une (mauvais fichier). Ce
 * qu'une ancienne version y gardait en plus (illustrations choisies) est ignoré.
 */
export function readCollection(value: unknown): CollectionData | null {
  const isCollection = isRecord(value) && isRecord(value.cards) && isRecord(value.customCards)
  return isCollection ? (value as unknown as CollectionData) : null
}

/** Les achats (liste, commandes, budget) ; `null` si ce n'en sont pas. */
export function readShopping(value: unknown): ShoppingData | null {
  const isShopping =
    isRecord(value) &&
    isRecord(value.preferences) &&
    Array.isArray(value.orders) &&
    isRecord(value.budget)
  return isShopping ? (value as unknown as ShoppingData) : null
}

/** Chaque valeur d'un dictionnaire (ou d'une liste) est un objet qui passe `ok`. */
const all = (values: object, ok: (value: Record<string, unknown>) => boolean = () => true) =>
  Object.values(values).every((value) => isRecord(value) && ok(value))

/** Un montant en euros : un nombre, positif ou nul (pas « 5 » en texte, qui fausserait les sommes). */
const isAmount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isOptional = (value: unknown, ok: (value: unknown) => boolean) =>
  value === undefined || ok(value)

/** Un jour (YYYY-MM-DD) : le budget en tire le mois, la réception la date d'obtention. */
const isDay = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

const isOwnership = (ownership: Record<string, unknown>) =>
  ['owned', 'ordered', 'wanted'].includes(ownership.status as string) &&
  isOptional(ownership.paidPrice, isAmount)

const isCard = (card: Record<string, unknown>) =>
  typeof card.id === 'string' &&
  Array.isArray(card.dexIds) &&
  card.dexIds.every(Number.isInteger) &&
  typeof card.reference === 'string' &&
  (card.image == null ||
    (isRecord(card.image) &&
      typeof card.image.small === 'string' &&
      typeof card.image.large === 'string')) &&
  isOptional(card.cardmarket, Number.isInteger) &&
  isOptional(card.page, (page) => typeof page === 'string' && parseCardmarketLink(page) !== null)

const isPreference = (preference: Record<string, unknown>) =>
  typeof preference.decision === 'string' &&
  Object.hasOwn(PRIORITY_LABELS, preference.priority as string) &&
  typeof preference.updatedAt === 'string' &&
  isOptional(preference.maxPrice, isAmount)

const isLine = (line: Record<string, unknown>) =>
  typeof line.cardId === 'string' &&
  Number.isInteger(line.quantity) &&
  (line.quantity as number) >= 1 &&
  isAmount(line.unitPrice) &&
  (line.previous === null || (isRecord(line.previous) && isOwnership(line.previous)))

const isOrder = (order: Record<string, unknown>) =>
  isDay(order.date) &&
  isOptional(order.receivedAt, isDay) &&
  typeof order.updatedAt === 'string' &&
  Object.hasOwn(SUPPLIER_LABELS, order.supplier as string) &&
  Object.hasOwn(ORDER_STATE_LABELS, order.state as string) &&
  isAmount(order.shipping) &&
  isAmount(order.fees) &&
  isAmount(order.refunded) &&
  isOptional(order.link, (link) => typeof link === 'string' && parseLink(link) !== null) &&
  Array.isArray(order.lines) &&
  all(order.lines, isLine)

const isBudget = (budget: Record<string, unknown>) =>
  ['monthly', 'ceiling', 'shippingReserve'].every((key) => isAmount(budget[key]))

/**
 * Les enregistrements d'un fichier, là où l'app les lit sans garde : un fichier retouché à la main
 * ne doit ni faire planter les pages une fois importé (puis enregistré), ni fausser le budget
 * (un montant en texte), ni glisser un lien qui ne serait pas une adresse web.
 */
const readable = (collection: CollectionData, shopping: ShoppingData | null) =>
  all(collection.cards, isOwnership) &&
  all(collection.customCards, isCard) &&
  (!shopping ||
    (all(shopping.preferences, isPreference) &&
      all(shopping.orders, isOrder) &&
      isRecord(shopping.budget) &&
      isBudget(shopping.budget)))

/**
 * Le contenu d'un fichier d'export ; `null` si ce n'en est pas un, ou s'il est abîmé. `shopping`
 * est `null` pour un export fait avant le module d'achats (sans bloc `shopping`).
 */
export function parseImport(text: string) {
  const file = parseStored(text)
  if (!isRecord(file) || file.kind !== 'collection-export') return null
  const collection = readCollection(file.collection)
  const shopping = readShopping(file.shopping)
  if (!collection || (file.shopping !== undefined && !shopping)) return null
  return readable(collection, shopping) ? { collection, shopping } : null
}

export type ImportedFile = NonNullable<ReturnType<typeof parseImport>>
