/**
 * Les filtres de la page Pokédex : leur place dans l'adresse, leur application aux Pokémon, la
 * recherche par nom ou numéro. Et les adresses de l'app : le Pokédex filtré (`pokedexUrl`), la
 * fiche d'un Pokémon (`speciesPath`), les onglets des Achats et les filtres de leur liste
 * d'achats (`parseShopping`, `shoppingUrl`), le Pokédex public d'un compte (`vitrinePath`,
 * `vitrinePseudo`).
 */

import { generationById, POKEMON_TYPES, type Generation } from '@/config/pokedex'
import { isPseudo } from '@/lib/account'
import { SPECIES } from '@/lib/species'
import type { PokedexEntry } from '@/lib/pokedex'
import type { GenerationId, PokemonSpecies, PokemonTypeId } from '@/types'

/** Débloqués (carte possédée), à débloquer (pas encore), ou carte commandée. */
export const POSSESSIONS = ['all', 'owned', 'ordered', 'missing'] as const
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

/** La fiche d'un Pokémon : `/pokemon/25`. */
export const speciesPath = (id: number) => `/pokemon/${id}`

/** Le Pokédex public d'un compte : `/sacha`, son pseudo en minuscules. */
export const vitrinePath = (pseudo: string) => `/${pseudo.toLowerCase()}`

/**
 * Le pseudo d'une adresse d'un seul segment (`/sacha` : « sacha ») ; `null` si ce n'en est pas un
 * (`isPseudo` : caractères, longueur, ni une adresse du site).
 */
export const vitrinePseudo = (segment: string) => (isPseudo(segment) ? segment : null)

/** Les onglets des Achats, dans l'adresse (`?vue=`) ; la liste d'achats est celui par défaut. */
const SHOPPING_VIEWS = ['liste', 'prochaine-commande', 'commandes', 'budget'] as const
export type ShoppingView = (typeof SHOPPING_VIEWS)[number]

/** Les tris de la liste d'achats, dans l'adresse (`?tri=`) ; par prix croissant par défaut. */
const WISHLIST_SORTS = ['price', 'price-desc', 'drop', 'dex'] as const
export type WishlistSort = (typeof WISHLIST_SORTS)[number]

/** Les filtres de la liste d'achats (`filterWishlist`), dans l'adresse comme ceux du Pokédex. */
export interface WishlistFilters {
  search: string
  generation: GenerationId | null
  sort: WishlistSort
}

export const DEFAULT_WISHLIST_FILTERS: WishlistFilters = {
  search: '',
  generation: null,
  sort: 'price',
}

/**
 * L'adresse des Achats → l'onglet ouvert et les filtres de la liste d'achats, avec les noms du
 * Pokédex (`q`, `generation`) et `tri`. Une valeur inconnue (adresse tapée à la main) vaut le
 * défaut.
 */
export function parseShopping(params: URLSearchParams): {
  view: ShoppingView
  filters: WishlistFilters
} {
  return {
    view: oneOf(SHOPPING_VIEWS, params.get('vue')) ?? 'liste',
    filters: {
      search: params.get('q') ?? '',
      generation: generationById(Number(params.get('generation')))?.id ?? null,
      sort: oneOf(WISHLIST_SORTS, params.get('tri')) ?? 'price',
    },
  }
}

/** L'onglet et les filtres → l'adresse, sans les valeurs par défaut : `?vue=commandes&q=pikachu`. */
export function serializeShopping(view: ShoppingView, filters: WishlistFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (view !== 'liste') params.set('vue', view)
  if (filters.search) params.set('q', filters.search)
  if (filters.generation) params.set('generation', String(filters.generation))
  if (filters.sort !== 'price') params.set('tri', filters.sort)
  return params
}

/** L'adresse des Achats : `shoppingUrl({ view: 'commandes' })` → `/achats?vue=commandes`. */
export function shoppingUrl({ view = 'liste' }: { view?: ShoppingView } = {}) {
  const search = serializeShopping(view, DEFAULT_WISHLIST_FILTERS).toString()
  return search ? `/achats?${search}` : '/achats'
}

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

/** « 25 », « #25 », « n°25 » : les numéros qui commencent par 25. Sinon : les noms. */
export function searchMatcher(search: string): (species: PokemonSpecies) => boolean {
  const digits = /^(?:#|n°)?\s*(\d+)$/i.exec(search.trim())?.[1]
  if (digits) return (species) => String(species.id).startsWith(String(Number(digits)))
  const needle = searchForm(search)
  const names = (searchNames ??= new Map(
    SPECIES.map(({ id, names }) => [
      id,
      [names.fr, names.en, names.ja ?? ''].map(searchForm).join('\n'),
    ]),
  ))
  return (species) => names.get(species.id)!.includes(needle)
}

/**
 * Les noms des espèces prêts pour la recherche, faits à la première recherche (les espèces arrivent
 * du serveur avant le premier affichage, une fois) : pour chacune, ses noms fr, en et ja, une ligne
 * chacun (une recherche ne déborde pas d'un nom sur le suivant).
 */
let searchNames: Map<number, string> | undefined

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
  return entries.filter(
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
