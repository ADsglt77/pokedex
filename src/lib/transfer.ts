/** Export et import de la collection, et sa relecture depuis le stockage du navigateur. */

import type { AppSettings, CollectionData, CollectionExportFile } from '@/types'

export function buildExportFile(
  collection: CollectionData,
  settings: AppSettings,
): CollectionExportFile {
  return {
    app: 'pokedex-collection',
    kind: 'collection-export',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    collection,
    settings,
  }
}

/** Télécharge le fichier ; rend son nom. */
export function downloadExport(file: CollectionExportFile): string {
  const name = `pokedex-collection-${file.exportedAt.slice(0, 10)}.json`
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)]))
  // Firefox ne télécharge que par un lien présent dans la page, et lit le fichier après le clic.
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return name
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

/** Le contenu d'un fichier d'export ; `null` si ce n'en est pas un. */
export function parseImport(text: string) {
  try {
    const file: unknown = JSON.parse(text)
    if (!isRecord(file) || file.kind !== 'collection-export') return null
    const collection = readCollection(file.collection)
    const settings = readSettings(file.settings)
    return collection && settings && { collection, settings }
  } catch {
    return null
  }
}

export type ImportedFile = NonNullable<ReturnType<typeof parseImport>>
