/** Filtres de la page Pokédex : lecture/écriture de l'adresse et recherche. */

import { GENERATIONS, generationById, type Generation } from '@/config/pokedex'
import { SPECIES } from '@/lib/catalog'
import type { PokedexEntry } from '@/lib/pokedex'
import type { GenerationId } from '@/types'

export type PossessionFilter = 'all' | 'owned' | 'missing'

/** Une espèce a une carte candidate, ou son illustration reste à rechercher. */
export type IllustrationFilter = 'card' | 'no-card'

export interface PokedexFilters {
  search: string
  generation: GenerationId | null
  possession: PossessionFilter
  illustration: IllustrationFilter | null
  descending: boolean
}

const MAX_SEARCH_LENGTH = 60

/** Une recherche plus longue ne peut correspondre à aucun nom ; coupée par caractère, pas par unité UTF-16. */
const cleanSearch = (text: string) =>
  Array.from(text.trim()).slice(0, MAX_SEARCH_LENGTH).join('').trim()

// Valeur de l'adresse ↔ valeur du filtre.
const POSSESSION_PARAMS = new Map<string, PossessionFilter>([
  ['possedes', 'owned'],
  ['manquants', 'missing'],
])

const ILLUSTRATION_PARAMS = new Map<string, IllustrationFilter>([
  ['avec-carte', 'card'],
  ['a-rechercher', 'no-card'],
])

const paramOf = <T>(params: Map<string, T>, value: T) =>
  [...params].find(([, candidate]) => candidate === value)?.[0]

/** Tolérant : une valeur inconnue veut dire « par défaut ». */
export function parseFilters(params: URLSearchParams): PokedexFilters {
  return {
    search: cleanSearch(params.get('q') ?? ''),
    generation: generationById(Number(params.get('generation')))?.id ?? null,
    possession: POSSESSION_PARAMS.get(params.get('possession') ?? '') ?? 'all',
    illustration: ILLUSTRATION_PARAMS.get(params.get('illustration') ?? '') ?? null,
    descending: params.get('ordre') === 'desc',
  }
}

/** N'écrit que ce qui diffère du défaut : `/pokedex?generation=5&possession=manquants`. */
export function serializeFilters(filters: PokedexFilters): URLSearchParams {
  const entries = {
    q: cleanSearch(filters.search),
    generation: filters.generation ? String(filters.generation) : undefined,
    possession: paramOf(POSSESSION_PARAMS, filters.possession),
    illustration: paramOf(ILLUSTRATION_PARAMS, filters.illustration),
    ordre: filters.descending ? 'desc' : undefined,
  }
  return new URLSearchParams(
    Object.entries(entries).filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
}

/** Filtres qui masquent des espèces, hors recherche. */
export function activeFilterCount(filters: PokedexFilters): number {
  return (
    Number(filters.generation !== null) +
    Number(filters.possession !== 'all') +
    Number(filters.illustration !== null)
  )
}

/**
 * Forme de comparaison des noms : sans casse, accent, ligature, ponctuation ni espace, et une
 * seule écriture des kana. « M. Mime » = « mmime », « Nœunœuf » = « noeunoeuf », ぴかちゅう = ピカチュウ.
 */
function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[\u3041-\u3096]/g, (kana) => String.fromCharCode(kana.charCodeAt(0) + 0x60))
    .replace(/[^\p{L}\p{N}]/gu, '')
}

type SearchMatcher =
  { kind: 'all' } | { kind: 'number'; digits: string } | { kind: 'name'; needle: string }

/**
 * « 25 », « 025 », « #25 », « n°25 » cherchent les numéros qui commencent par ces chiffres
 * (« 025 » trouve 25 puis 250 à 259) ; le reste cherche dans les noms fr, en et ja.
 */
function parseSearch(text: string): SearchMatcher {
  const typed = text.normalize('NFKC').trim()
  if (typed === '' || /^(#|n\s*°)$/i.test(typed)) return { kind: 'all' }

  const digits = /^(?:#|n\s*°|n[o.]?)?\s*(\d+)$/i.exec(typed)?.[1]
  if (digits !== undefined) {
    const significant = digits.replace(/^0+/, '')
    return significant ? { kind: 'number', digits: significant } : { kind: 'all' }
  }
  const needle = normalizeSearchText(typed)
  return needle ? { kind: 'name', needle } : { kind: 'all' }
}

// Une ligne par nom : une recherche ne contient jamais de saut de ligne, donc ne chevauche pas deux noms.
const SEARCH_NAMES = new Map(
  SPECIES.map(({ id, names }) => [
    id,
    [names.fr, names.en, names.ja ?? ''].map(normalizeSearchText).join('\n'),
  ]),
)

export function filterEntries(entries: PokedexEntry[], filters: PokedexFilters): PokedexEntry[] {
  const matcher = parseSearch(filters.search)
  const kept = entries.filter(({ species, unlocked, representative }) => {
    if (filters.generation && species.generation !== filters.generation) return false
    if (filters.possession === 'owned' && !unlocked) return false
    if (filters.possession === 'missing' && unlocked) return false
    if (filters.illustration && (representative !== null) !== (filters.illustration === 'card'))
      return false
    if (matcher.kind === 'number') return String(species.id).startsWith(matcher.digits)
    if (matcher.kind === 'name') return SEARCH_NAMES.get(species.id)?.includes(matcher.needle)
    return true
  })
  return filters.descending ? kept.reverse() : kept
}

interface GenerationGroup {
  generation: Generation
  entries: PokedexEntry[]
}

/** Découpe une liste triée par numéro en un groupe par génération, dans l'ordre de la liste. */
export function groupByGeneration(entries: PokedexEntry[]): GenerationGroup[] {
  const groups: GenerationGroup[] = []
  for (const entry of entries) {
    const last = groups.at(-1)
    if (last?.generation.id === entry.species.generation) last.entries.push(entry)
    else groups.push({ generation: GENERATIONS[entry.species.generation - 1]!, entries: [entry] })
  }
  return groups
}
