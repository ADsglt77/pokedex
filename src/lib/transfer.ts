/** Export et import de la collection, et sa relecture depuis le stockage du navigateur. */

import type { AppSettings, CollectionData, CollectionExportFile, ShoppingData } from '@/types'

export function buildExportFile(
  collection: CollectionData,
  settings: AppSettings,
  shopping: ShoppingData,
): CollectionExportFile {
  return {
    app: 'pokedex-collection',
    kind: 'collection-export',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    collection,
    settings,
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

/** Télécharge le fichier d'export ; rend son nom. */
export function downloadExport(file: CollectionExportFile): string {
  const name = `pokedex-collection-${file.exportedAt.slice(0, 10)}.json`
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

/** Une collection, telle qu'enregistrée ; `null` si ce n'en est pas une (mauvais fichier). */
export function readCollection(value: unknown): CollectionData | null {
  const isCollection =
    isRecord(value) &&
    isRecord(value.entries) &&
    isRecord(value.cards) &&
    isRecord(value.customCards)
  return isCollection ? (value as unknown as CollectionData) : null
}

export function readSettings(value: unknown): AppSettings | null {
  return isRecord(value) && Array.isArray(value.enabledRarityCodes)
    ? (value as unknown as AppSettings)
    : null
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

/**
 * Le contenu d'un fichier d'export ; `null` si ce n'en est pas un. `shopping` est `null` pour un
 * export fait avant le module d'achats.
 */
export function parseImport(text: string) {
  const file = parseStored(text)
  if (!isRecord(file) || file.kind !== 'collection-export') return null
  const collection = readCollection(file.collection)
  const settings = readSettings(file.settings)
  const shopping = readShopping(file.shopping)
  return collection && settings && { collection, settings, shopping }
}

export type ImportedFile = NonNullable<ReturnType<typeof parseImport>>
