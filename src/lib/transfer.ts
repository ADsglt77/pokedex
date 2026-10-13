/** Export et import de la collection, et sa relecture depuis le stockage du navigateur. */

import { PRIORITY_LABELS } from '@/config/shopping'
import { today } from '@/lib/format'
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

/**
 * Les enregistrements d'un fichier, là où l'app les lit sans garde : un fichier retouché à la main
 * ne doit pas faire planter toutes les pages une fois importé (puis enregistré).
 */
const readable = (collection: CollectionData, shopping: ShoppingData | null) =>
  all(collection.cards, (card) => ['owned', 'ordered', 'wanted'].includes(card.status as string)) &&
  all(
    collection.customCards,
    (card) =>
      Array.isArray(card.dexIds) &&
      typeof card.reference === 'string' &&
      (card.image == null ||
        (isRecord(card.image) &&
          typeof card.image.small === 'string' &&
          typeof card.image.large === 'string')),
  ) &&
  (!shopping ||
    (all(
      shopping.preferences,
      (preference) =>
        typeof preference.decision === 'string' &&
        Object.hasOwn(PRIORITY_LABELS, preference.priority as string),
    ) &&
      all(
        shopping.orders,
        (order) => typeof order.date === 'string' && Array.isArray(order.lines) && all(order.lines),
      )))

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
