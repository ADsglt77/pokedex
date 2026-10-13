/** Les filtres de la page Pokédex : leur place dans l'adresse, et la recherche par nom ou numéro. */

import { generationById, POKEMON_TYPES, type Generation } from '@/config/pokedex'
import { SPECIES } from '@/lib/species'
import type { PokedexEntry } from '@/lib/pokedex'
import type { GenerationId, PokemonSpecies, PokemonTypeId } from '@/types'

/** Débloqués (carte possédée), à débloquer (pas encore), ou carte commandée, souhaitée. */
const POSSESSIONS = ['all', 'owned', 'ordered', 'wanted', 'missing'] as const
export type PossessionFilter = (typeof POSSESSIONS)[number]

/**
 * Avec une carte ajoutée, ou sans carte ; ou une carte à compléter : sans image, sans id Cardmarket
 * (pas de prix ni de lien Cardmarket), possédée sans prix payé (la valeur ne dit pas le gain).
 */
const CARD_FILTERS = ['with', 'without', 'no-image', 'no-cardmarket', 'no-paid'] as const
export type CardFilter = (typeof CARD_FILTERS)[number]

export interface PokedexFilters {
  search: string
  generation: GenerationId | null
  possession: PossessionFilter
  card: CardFilter | null
  type: PokemonTypeId | null
  descending: boolean
}

export const DEFAULT_FILTERS: PokedexFilters = {
  search: '',
  generation: null,
  possession: 'all',
  card: null,
  type: null,
  descending: false,
}

const oneOf = <T extends string>(values: readonly T[], value: string | null) =>
  values.find((known) => known === value)

/** L'adresse → les filtres. Une valeur inconnue (adresse tapée à la main) vaut le défaut. */
export function parseFilters(params: URLSearchParams): PokedexFilters {
  return {
    search: params.get('q') ?? '',
    generation: generationById(Number(params.get('generation')))?.id ?? null,
    possession: oneOf(POSSESSIONS, params.get('possession')) ?? 'all',
    card: oneOf(CARD_FILTERS, params.get('card')) ?? null,
    type: oneOf(Object.keys(POKEMON_TYPES) as PokemonTypeId[], params.get('type')) ?? null,
    descending: params.get('order') === 'desc',
  }
}

/** Les filtres → l'adresse, sans les valeurs par défaut : `/pokedex?generation=5&possession=missing`. */
export function serializeFilters(filters: PokedexFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('q', filters.search)
  if (filters.generation) params.set('generation', String(filters.generation))
  if (filters.possession !== 'all') params.set('possession', filters.possession)
  if (filters.card) params.set('card', filters.card)
  if (filters.type) params.set('type', filters.type)
  if (filters.descending) params.set('order', 'desc')
  return params
}

/** L'adresse du Pokédex filtré : `pokedexUrl({ generation: 5 })` → `/pokedex?generation=5`. */
export function pokedexUrl(filters: Partial<PokedexFilters>): string {
  const search = serializeFilters({ ...DEFAULT_FILTERS, ...filters }).toString()
  return search ? `/pokedex?${search}` : '/pokedex'
}

/** Les filtres actifs, recherche exclue (le compteur du bouton « Filtres »). */
export const activeFilterCount = (filters: PokedexFilters) =>
  Number(filters.generation !== null) +
  Number(filters.possession !== 'all') +
  Number(filters.card !== null) +
  Number(filters.type !== null)

/** Sans casse, accent ni ligature : « Nœunœuf » → « noeunoeuf », « Éli » → « eli ». */
const fold = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')

/**
 * Un nom sous sa forme de recherche : replié (`fold`), sans ponctuation ni espace, et les hiragana
 * écrits en katakana. « M. Mime » → « mmime », ぴかちゅう → ピカチュウ.
 */
export const searchForm = (text: string) =>
  fold(text)
    .replace(/[\u3041-\u3096]/g, (kana) => String.fromCharCode(kana.charCodeAt(0) + 0x60))
    .replace(/[^\p{L}\p{N}]/gu, '')

// Les noms fr, en et ja de chaque espèce, une ligne chacun : une recherche ne déborde pas d'un nom
// sur le suivant.
const SEARCH_NAMES = new Map(
  SPECIES.map(({ id, names }) => [
    id,
    [names.fr, names.en, names.ja ?? ''].map(searchForm).join('\n'),
  ]),
)

/** « 25 », « #25 », « n°25 » : les numéros qui commencent par 25. Sinon : les noms. */
export function searchMatcher(search: string): (species: PokemonSpecies) => boolean {
  const digits = /^(?:#|n°)?\s*(\d+)$/i.exec(search.trim())?.[1]
  if (digits) return (species) => String(species.id).startsWith(String(Number(digits)))
  const needle = searchForm(search)
  return (species) => SEARCH_NAMES.get(species.id)!.includes(needle)
}

/**
 * En mots simples : replié (`fold`), ponctuation changée en espaces ; ♀ et ♂ sont des mots
 * (Nidoran♀ n'est pas Nidoran♂). « Mr. Mime » → « mr mime », « Nidoran♀ » → « nidoran ♀ ».
 */
const words = (text: string) =>
  ` ${fold(text)
    .replace(/[♀♂]/g, ' $& ')
    .replace(/[^\p{L}\p{N}♀♂]+/gu, ' ')
    .trim()} `

const SPECIES_WORDS = SPECIES.flatMap(({ id, names }) =>
  [names.fr, names.en].map((name) => ({ id, name: words(name) })),
)

/**
 * Le Pokémon d'un nom de carte (« Lillie's Clefairy ex », « Pikachu (30C 034) ») : celui dont le
 * nom français ou anglais y figure en entier, le plus long s'il y en a plusieurs (Porygon-Z avant
 * Porygon) ; `null` si aucun. Le code et le numéro entre parenthèses n'en font pas partie : « (MEW
 * 166) » n'est pas Mew.
 */
export function speciesInName(name: string): number | null {
  const text = words(name.replace(/\([^()]*\)\s*$/, ''))
  const found = SPECIES_WORDS.filter((species) => text.includes(species.name))
  return found.sort((a, b) => b.name.length - a.name.length)[0]?.id ?? null
}

function cardMatches(card: PokedexEntry['card'], filter: CardFilter) {
  switch (filter) {
    case 'with':
      return card !== null
    case 'without':
      return card === null
    case 'no-image':
      return card !== null && card.card.image === null
    case 'no-cardmarket':
      return card !== null && card.card.cardmarket === undefined
    case 'no-paid':
      return card?.status === 'owned' && card.paidPrice === null
  }
}

export function filterEntries(entries: PokedexEntry[], filters: PokedexFilters): PokedexEntry[] {
  const matches = searchMatcher(filters.search)
  const kept = entries.filter(
    ({ species, unlocked, card }) =>
      (!filters.generation || species.generation === filters.generation) &&
      (filters.possession === 'all' ||
        (filters.possession === 'owned' && unlocked) ||
        (filters.possession === 'missing' && !unlocked) ||
        card?.status === filters.possession) &&
      (!filters.card || cardMatches(card, filters.card)) &&
      (!filters.type || species.types.includes(filters.type)) &&
      matches(species),
  )
  return filters.descending ? kept.reverse() : kept
}

/** Une liste triée par numéro, découpée en un groupe par génération. */
export function groupByGeneration(entries: PokedexEntry[]) {
  const groups: { generation: Generation; entries: PokedexEntry[] }[] = []
  for (const entry of entries) {
    const last = groups.at(-1)
    if (last?.generation.id === entry.species.generation) last.entries.push(entry)
    else groups.push({ generation: generationById(entry.species.generation)!, entries: [entry] })
  }
  return groups
}
