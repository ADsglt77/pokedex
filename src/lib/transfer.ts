/** Lecture, export et import de la collection. */

import { TOTAL_SPECIES } from '@/config/pokedex'
import { CARD_STATUSES } from '@/lib/collection'
import { normalizeRarityCodes } from '@/lib/rarity'
import type {
  AppSettings,
  CardOwnership,
  CollectionData,
  CollectionEntry,
  CollectionExportFile,
  PokemonCard,
} from '@/types'

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

export function downloadExport(file: CollectionExportFile): string {
  const name = `pokedex-collection-${file.exportedAt.slice(0, 10)}.json`
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
  )
  // Certains navigateurs n'ouvrent un lien de téléchargement que s'il est dans la page, et
  // lisent le fichier après le clic : l'adresse reste valable un moment.
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return name
}

/* Lecture tolérante : un enregistrement illisible est écarté, un champ secondaire mal typé est
   ramené à `null`. Rien de ce qui est gardé ne peut faire planter l'app. */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown) => (typeof value === 'string' ? value : null)

const isDexId = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= TOTAL_SPECIES

function readCard(id: string, value: unknown): PokemonCard | null {
  if (!isRecord(value) || value.id !== id || typeof value.reference !== 'string') return null
  const source = value.source === 'tcgdex' || value.source === 'manual' ? value.source : null
  if (source === null || !id.startsWith(`${source}:`)) return null
  const { dexIds, image, set } = value
  if (!Array.isArray(dexIds) || dexIds.length === 0 || !dexIds.every(isDexId)) return null

  return {
    id,
    source,
    dexIds: [...new Set(dexIds)],
    name: text(value.name),
    reference: value.reference,
    set: isRecord(set)
      ? { id: text(set.id), name: text(set.name), releaseDate: text(set.releaseDate) }
      : null,
    number: text(value.number),
    rarity: text(value.rarity),
    illustrator: text(value.illustrator),
    image:
      isRecord(image) && typeof image.small === 'string' && typeof image.large === 'string'
        ? { small: image.small, large: image.large }
        : null,
    sourceUrl: text(value.sourceUrl),
    note: text(value.note),
  }
}

function readEntry(key: string, value: unknown): CollectionEntry | null {
  if (!isRecord(value) || !isDexId(value.speciesId) || String(value.speciesId) !== key) return null
  if (typeof value.updatedAt !== 'string') return null
  return {
    speciesId: value.speciesId,
    favoriteCardId: text(value.favoriteCardId),
    updatedAt: value.updatedAt,
  }
}

function readOwnership(_key: string, value: unknown): CardOwnership | null {
  if (!isRecord(value) || typeof value.updatedAt !== 'string') return null
  const status = CARD_STATUSES.find((candidate) => candidate === value.status)
  if (!status) return null
  // Une carte possédée sans date d'obtention prend celle de sa dernière modification.
  const acquiredAt = status === 'owned' ? (text(value.acquiredAt) ?? value.updatedAt) : null
  return { status, updatedAt: value.updatedAt, acquiredAt }
}

const readImageUrl = (_key: string, value: unknown) =>
  typeof value === 'string' && value.startsWith('https://') ? value : null

interface ReadResult {
  collection: CollectionData
  /** Enregistrements écartés parce qu'illisibles. */
  dropped: number
}

/** Lit une collection stockée ou importée ; `null` si le document n'en est pas une. */
function parseCollection(value: unknown): ReadResult | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null
  const { entries, cards, customCards, imageOverrides } = value
  if (![entries, cards, customCards, imageOverrides].every(isRecord)) return null

  let dropped = 0
  function readSection<T>(section: unknown, read: (key: string, value: unknown) => T | null) {
    const kept: [string, T][] = []
    for (const [key, raw] of Object.entries(section as Record<string, unknown>)) {
      const item = read(key, raw)
      if (item === null) dropped++
      else kept.push([key, item])
    }
    // `fromEntries` crée des propriétés propres, même pour une clé comme `__proto__`.
    return Object.fromEntries(kept)
  }

  const collection: CollectionData = {
    schemaVersion: 1,
    updatedAt: text(value.updatedAt),
    entries: readSection(entries, readEntry),
    cards: readSection(cards, readOwnership),
    customCards: readSection(customCards, readCard),
    imageOverrides: readSection(imageOverrides, readImageUrl),
  }
  return { collection, dropped }
}

export const readCollection = (value: unknown) => parseCollection(value)?.collection ?? null

export function readSettings(value: unknown): AppSettings | null {
  if (!isRecord(value) || !Array.isArray(value.enabledRarityCodes)) return null
  return { schemaVersion: 1, enabledRarityCodes: normalizeRarityCodes(value.enabledRarityCodes) }
}

export type ParsedImport =
  | { ok: true; collection: CollectionData; settings: AppSettings | null; dropped: number }
  | { ok: false; error: string }

/** Accepte un fichier d'export ou un document de collection seul. */
export function parseImport(text: string): ParsedImport {
  let json: unknown
  try {
    // Un fichier enregistré avec une marque d'ordre des octets (BOM) reste lisible.
    json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas un fichier JSON valide.' }
  }

  const exported = isRecord(json) && json.kind === 'collection-export' ? json : null
  const result = parseCollection(exported ? exported.collection : json)
  if (result === null) {
    return { ok: false, error: 'Ce fichier ne contient pas une collection de Pokédex.' }
  }
  return {
    ok: true,
    ...result,
    settings: exported ? readSettings(exported.settings) : null,
  }
}
