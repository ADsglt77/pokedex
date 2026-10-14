/**
 * Export et import de la collection, et sa relecture depuis le stockage du navigateur ; les CSV
 * pour un tableur (liste d'achats, registre des commandes).
 */

import { ORDER_STATE_LABELS, PRIORITY_LABELS, SUPPLIER_LABELS } from '@/config/shopping'
import { parseCardmarketLink } from '@/lib/cardmarket'
import { euroInput, parseLink, today } from '@/lib/format'
import { cardCount, linesTotal, orderSpent, refundFits, supplierLabel } from '@/lib/orders'
import type { CollectionData, CollectionExportFile, Order, ShoppingData } from '@/types'

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
function downloadFile(name: string, content: string, type: string) {
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

/* CSV pour un tableur : séparateur `;`, décimales à virgule */

/** « 12,50 » ; vide sans montant. */
export const csvNumber = (value: number | null | undefined) =>
  value == null ? '' : euroInput(value)

/** `2026-10-05` → « 05/10/2026 » ; vide sans date. */
const csvDay = (day: string | undefined) => (day ? day.split('-').reverse().join('/') : '')

const csvCell = (value: string | number) => {
  const text = String(value)
  return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Les lignes (la première : les titres des colonnes) → le CSV. */
export const toCsv = (lines: readonly (readonly (string | number)[])[]) =>
  lines.map((line) => line.map(csvCell).join(';')).join('\r\n')

/** Le BOM UTF-8 : sans lui, Excel lit mal les accents d'un CSV. */
const BOM = String.fromCharCode(0xfeff)

/** Télécharge un CSV, daté du jour de l'utilisateur (`name-2026-10-13.csv`) ; rend son nom. */
export function downloadCsv(name: string, csv: string): string {
  const file = `${name}-${today()}.csv`
  downloadFile(file, BOM + csv, 'text/csv;charset=utf-8')
  return file
}

/** Le registre des commandes : une ligne par commande, dans l'ordre de `orders`. */
export function ordersCsv(orders: readonly Order[]): string {
  const header = [
    'Date d’achat',
    'Fournisseur',
    'Référence',
    'État',
    'Cartes',
    'Prix des cartes (€)',
    'Port (€)',
    'Autres frais (€)',
    'Remboursé (€)',
    'Total (€)',
    'Reçue le',
    'Lien',
  ]
  const lines = orders.map((order) => [
    csvDay(order.date),
    supplierLabel(order),
    order.reference ?? '',
    ORDER_STATE_LABELS[order.state],
    cardCount(order.lines),
    csvNumber(linesTotal(order.lines)),
    csvNumber(order.shipping),
    csvNumber(order.fees),
    csvNumber(order.refunded),
    csvNumber(orderSpent(order)),
    csvDay(order.receivedAt),
    order.link ?? '',
  ])
  return toCsv([header, ...lines])
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

/** Un texte : l'app le lit comme tel (`trim`, tri), un nombre la ferait planter. */
const isText = (value: unknown) => typeof value === 'string'

/**
 * Un jour qui existe (YYYY-MM-DD, pas `2026-13-45`) : le budget en tire le mois, la réception la
 * date d'obtention.
 */
function isDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  // Un jour qui n'existe pas déborde sur le suivant (le 30 février devient le 2 mars).
  return new Date(Date.UTC(year, month - 1, day)).toISOString().startsWith(value)
}

/** Un instant (ISO), lisible comme une date : la date d'obtention, triée et affichée. */
const isTime = (value: unknown) => isText(value) && !Number.isNaN(Date.parse(value as string))

const isOwnership = (ownership: Record<string, unknown>) =>
  ['owned', 'ordered', 'wanted'].includes(ownership.status as string) &&
  isText(ownership.updatedAt) &&
  (ownership.acquiredAt == null || isTime(ownership.acquiredAt)) &&
  isOptional(ownership.paidPrice, isAmount)

const isCard = (card: Record<string, unknown>) =>
  typeof card.id === 'string' &&
  Array.isArray(card.dexIds) &&
  card.dexIds.every(Number.isInteger) &&
  isText(card.reference) &&
  (card.image == null ||
    (isRecord(card.image) && isText(card.image.small) && isText(card.image.large))) &&
  isOptional(card.cardmarket, Number.isInteger) &&
  isOptional(card.page, (page) => isText(page) && parseCardmarketLink(page as string) !== null)

const isPreference = (preference: Record<string, unknown>) =>
  isText(preference.decision) &&
  Object.hasOwn(PRIORITY_LABELS, preference.priority as string) &&
  isText(preference.updatedAt) &&
  isOptional(preference.maxPrice, isAmount) &&
  isOptional(preference.note, isText)

const isLine = (line: Record<string, unknown>) =>
  isText(line.cardId) &&
  Number.isInteger(line.quantity) &&
  (line.quantity as number) >= 1 &&
  isAmount(line.unitPrice) &&
  (line.previous === null || (isRecord(line.previous) && isOwnership(line.previous)))

const isOrder = (order: Record<string, unknown>) =>
  isText(order.id) &&
  order.id !== '' &&
  isDay(order.date) &&
  isOptional(order.receivedAt, isDay) &&
  isText(order.updatedAt) &&
  Object.hasOwn(SUPPLIER_LABELS, order.supplier as string) &&
  isOptional(order.supplierName, isText) &&
  isOptional(order.reference, isText) &&
  isOptional(order.note, isText) &&
  Object.hasOwn(ORDER_STATE_LABELS, order.state as string) &&
  isAmount(order.shipping) &&
  isAmount(order.fees) &&
  isAmount(order.refunded) &&
  isOptional(order.link, (link) => isText(link) && parseLink(link as string) !== null) &&
  Array.isArray(order.lines) &&
  all(order.lines, isLine) &&
  // Comme à la saisie : un remboursé plus grand que la commande ferait une dépense négative.
  refundFits(order as unknown as Order)

const isBudget = (budget: Record<string, unknown>) =>
  ['monthly', 'ceiling', 'shippingReserve'].every((key) => isAmount(budget[key]))

/** Une date de dernière modification : absente ou `null` avant la première. */
const isUpdatedAt = (value: unknown) => value == null || isText(value)

/**
 * Les enregistrements d'un fichier, là où l'app les lit sans garde : un fichier retouché à la main
 * ne doit ni faire planter les pages une fois importé (puis enregistré), ni fausser le budget
 * (un montant en texte, une commande en double), ni glisser un lien qui ne serait pas une
 * adresse web.
 */
const readable = (collection: CollectionData, shopping: ShoppingData | null) =>
  isUpdatedAt(collection.updatedAt) &&
  all(collection.cards, isOwnership) &&
  all(collection.customCards, isCard) &&
  (!shopping ||
    (isUpdatedAt(shopping.updatedAt) &&
      all(shopping.preferences, isPreference) &&
      all(shopping.orders, isOrder) &&
      // Une commande est retrouvée par son id : deux du même id se confondraient.
      new Set(shopping.orders.map((order) => order.id)).size === shopping.orders.length &&
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

/**
 * La collection et les achats qu'un navigateur envoie au serveur (synchronisation) ; `null` s'ils
 * sont abîmés : le serveur les refuse, aux mêmes règles qu'un fichier importé.
 */
export function readDocument(value: unknown) {
  if (!isRecord(value)) return null
  const collection = readCollection(value.collection)
  const shopping = readShopping(value.shopping)
  return collection && shopping && readable(collection, shopping) ? { collection, shopping } : null
}
