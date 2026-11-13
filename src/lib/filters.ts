/**
 * Les filtres de la page Pokédex : leur place dans l'adresse, leur application aux Pokémon, la
 * recherche par nom ou numéro. Et les adresses de l'app : le Pokédex filtré (`pokedexUrl`), la
 * fiche d'un Pokémon (`speciesPath`), les onglets des Achats et les filtres de leur liste
 * d'achats (`parseShopping`, `shoppingUrl`), le Pokédex public d'un compte et son API
 * (`vitrinePath`, `vitrineUrl`), la langue et l'extension du Catalogue (`catalogLanguage`,
 * `catalogSet`, `catalogParams`) et ce qu'on y regarde (`parseCatalogView`, `catalogViewParams`),
 * la page d'une collection d'extension et la carte dont elle ouvre
 * la fenêtre (`seriesPath`, `seriesCard`), où mène le lien d'une carte (`cardPath`) ; et la façon
 * d'y changer les filtres (`filterUpdate`).
 * Les paramètres d'adresse sont mi-anglais (`generation`, `possession`, `card`, `order`),
 * mi-français (`vue`, `tri`, `langue`, `carte`) : les anciens restent tels quels (des liens gardés
 * y mènent), les prochains sont nommés en français.
 */

import type { NavigateOptions } from 'react-router'
import { generationById, POKEMON_TYPES, type Generation } from '@/config/pokedex'
import type { CatalogFilter, CatalogSets } from '@/lib/card-catalog'
import { cardLanguage } from '@/lib/collection'
import { SPECIES } from '@/lib/species'
import type { CardView, PokedexEntry } from '@/lib/pokedex'
import type {
  CardLanguage,
  GenerationId,
  PokemonCard,
  PokemonSpecies,
  PokemonTypeId,
  SeriesCollection,
} from '@/types'

/**
 * Débloqués (une de leurs cartes est possédée), à débloquer (pas encore), ou dont une carte est
 * commandée (et aucune possédée).
 */
export const POSSESSIONS = ['all', 'owned', 'ordered', 'missing'] as const
export type PossessionFilter = (typeof POSSESSIONS)[number]

/**
 * Une carte à compléter : sans image, sans id Cardmarket (pas de prix ; un lien seulement si sa
 * page est notée), possédée sans prix payé (la valeur ne dit pas le gain).
 */
const CARD_NEEDS = ['no-image', 'no-cardmarket', 'no-paid'] as const
export type CardNeed = (typeof CARD_NEEDS)[number]

/**
 * Avec des cartes, ou sans carte ; ou dont une des cartes est à compléter (`cardNeeds`) : un
 * Pokémon qui en a plusieurs passe dès qu'une seule l'est.
 */
const CARD_FILTERS = ['with', 'without', ...CARD_NEEDS] as const
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

const generationParam = (params: URLSearchParams) =>
  generationById(Number(params.get('generation')))?.id ?? null

/** Un chemin et ses paramètres, sans `?` s'il n'y en a pas. */
const withParams = (path: string, params: URLSearchParams) => {
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

/** L'adresse → les filtres. Une valeur inconnue (adresse tapée à la main) vaut le défaut. */
export function parseFilters(params: URLSearchParams): PokedexFilters {
  return {
    search: params.get('q') ?? '',
    generation: generationParam(params),
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

/**
 * Un filtre est-il appliqué ? Tout ce que l'adresse en dit, sauf l'ordre (qui ne retire aucun
 * Pokémon) et une recherche faite d'espaces.
 */
export const isFiltering = (filters: PokedexFilters) =>
  serializeFilters({ ...filters, search: filters.search.trim(), descending: false }).size > 0

/** L'adresse du Pokédex filtré : `pokedexUrl({ generation: 5 })` → `/pokedex?generation=5`. */
export function pokedexUrl(filters: Partial<PokedexFilters>): string {
  return withParams('/pokedex', serializeFilters({ ...DEFAULT_FILTERS, ...filters }))
}

/** La fiche d'un Pokémon : `/pokemon/25`. */
export const speciesPath = (id: number) => `/pokemon/${id}`

/**
 * Les Réglages : `/reglages` (`/donnees` jusqu'en novembre 2026, redirigée : `router.tsx`) ; `hash` :
 * une de leurs sections (`#importer`, `#compte`).
 */
export const settingsPath = (hash = '') => `/reglages${hash}`

/** Le Pokédex public d'un compte : `/sacha`, son pseudo en minuscules. */
export const vitrinePath = (pseudo: string) => `/${pseudo.toLowerCase()}`

/**
 * Le Pokédex public d'un compte à l'API (`worker/vitrine.ts`) : `/api/vitrine/sacha`, le pseudo en
 * minuscules lui aussi, pour une seule réponse gardée par `getJson` quelle que soit la casse tapée.
 */
export const vitrineUrl = (pseudo: string) => `/api/vitrine${vitrinePath(pseudo)}`

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
      generation: generationParam(params),
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
  return withParams('/achats', serializeShopping(view, DEFAULT_WISHLIST_FILTERS))
}

/**
 * Comment changer les filtres gardés dans l'adresse (Pokédex, Achats) : pas une entrée
 * d'historique par onglet, par filtre ou par frappe ; la recherche changée (`search`), hors de la
 * transition où le routeur passe ses mises à jour (le champ, qui lit l'adresse, suivrait la frappe
 * en retard) ; sans relancer le chargement de la route, le compte (une navigation qui charge est
 * asynchrone : le champ, remis un instant à l'ancienne valeur, enverrait le curseur au bout du
 * texte).
 */
export const filterUpdate = (search: boolean): NavigateOptions => ({
  replace: true,
  preventScrollReset: true,
  flushSync: search,
  defaultShouldRevalidate: false,
})

/**
 * L'adresse du Catalogue (ou des Collections) → sa langue (`?langue=fr`) ; sans elle, ou inconnue :
 * le japonais.
 */
export const catalogLanguage = (params: URLSearchParams): CardLanguage =>
  params.get('langue') === 'fr' ? 'fr' : 'ja'

/**
 * L'adresse du Catalogue → son extension (`?set=`) parmi ses séries ; `undefined` sans elle, ou si
 * elles ne l'ont pas (la page montre alors la plus récente, et sa route ne demande rien d'avance).
 */
export const catalogSet = (params: URLSearchParams, catalog: CatalogSets) =>
  catalog.sets.find((known) => known.id === params.get('set'))

/**
 * La langue et l'extension du Catalogue → l'adresse, sans la langue par défaut (le japonais) :
 * `?langue=fr&set=MEG`. Sans extension, la plus récente de la langue.
 */
export function catalogParams(lang: CardLanguage, set?: string): URLSearchParams {
  const params = new URLSearchParams()
  if (lang === 'fr') params.set('langue', 'fr')
  if (set) params.set('set', set)
  return params
}

/**
 * Ce qu'on regarde dans l'extension du Catalogue, gardé dans son adresse (NAV-05 : une vue se
 * partage, et se retrouve au retour d'une fiche de Pokémon) : la recherche (`recherche`), les
 * raretés et les types choisis (`raretes`, `types` : leurs ids, séparés par des virgules) et la
 * carte dont la fiche est ouverte (`carte` : son numéro, unique dans l'extension et sa langue).
 */
export interface CatalogView {
  search: string
  filter: CatalogFilter
  card: string | null
}

/** Des ids lus dans l'adresse (`1,8,33`) : seulement des nombres, chacun une fois. */
const idList = (value: string | null) => [
  ...new Set(
    (value ?? '')
      .split(',')
      .filter((id) => /^\d{1,4}$/.test(id))
      .map(Number),
  ),
]

/** L'adresse du Catalogue → ce qu'on y regarde (`CatalogView`) ; rien de mal écrit n'en sort. */
export function parseCatalogView(params: URLSearchParams): CatalogView {
  return {
    search: params.get('recherche') ?? '',
    filter: { rarities: idList(params.get('raretes')), types: idList(params.get('types')) },
    card: params.get('carte') || null,
  }
}

/**
 * La vue changée de `patch`. Une autre recherche ou d'autres filtres ferment la fiche (`carte`) :
 * ouverte, elle couvre la page ; une adresse qui l'oublierait la rouvrirait d'un coup, quand un
 * filtre ramène sa carte.
 */
export function changeCatalogView(view: CatalogView, patch: Partial<CatalogView>): CatalogView {
  const filtering = 'search' in patch || 'filter' in patch
  return { ...view, ...(filtering && { card: null }), ...patch }
}

/**
 * L'adresse du Catalogue (`params` : sa langue et son extension, gardées) avec la vue `view` ; une
 * vue vide n'y ajoute rien (`?langue=fr&set=MEG&recherche=pika&raretes=1,8&carte=025`).
 */
export function catalogViewParams(params: URLSearchParams, view: CatalogView): URLSearchParams {
  const next = catalogParams(catalogLanguage(params), params.get('set') ?? undefined)
  if (view.search) next.set('recherche', view.search)
  if (view.filter.rarities.length) next.set('raretes', view.filter.rarities.join())
  if (view.filter.types.length) next.set('types', view.filter.types.join())
  if (view.card) next.set('carte', view.card)
  return next
}

/**
 * La page de la collection d'une extension : `/collections/M6A`, `/collections/MEG?langue=fr` pour
 * une française (un même code existe dans les deux langues) ; avec `card` (son id), la fenêtre de
 * cette carte ouverte d'emblée (`?carte=`, `seriesCard`).
 */
export function seriesPath(set: string, language: CardLanguage, card?: string): string {
  const params = catalogParams(language)
  if (card) params.set('carte', card)
  return withParams(`/collections/${encodeURIComponent(set)}`, params)
}

/**
 * L'adresse de la page d'une collection → la carte dont la fenêtre s'ouvre d'emblée (`?carte=`,
 * `seriesPath`), si c'est une de ses cases ; sinon aucune (`null`).
 */
export function seriesCard(params: URLSearchParams, series: SeriesCollection): string | null {
  const card = params.get('carte')
  return card !== null && series.cards.includes(card) ? card : null
}

/**
 * Où mène le lien d'une carte (`series` : la collection d'extension dont elle est une case,
 * `seriesOf`). Une case pas encore obtenue (`seriesOnly`), absente de la fiche de ses Pokémon, ou
 * une carte sans Pokémon (un dresseur, une énergie) : la page de sa collection, sa fenêtre ouverte.
 * Une autre carte : la fiche de son Pokémon (le premier d'une carte TAG TEAM). Ni Pokémon ni
 * collection : nulle part (`null`).
 */
export function cardPath(card: PokemonCard, series: SeriesCollection | null): string | null {
  const [speciesId] = card.dexIds
  if (series && (card.seriesOnly || speciesId === undefined)) {
    return seriesPath(series.set, cardLanguage(series), card.id)
  }
  return speciesId === undefined ? null : speciesPath(speciesId)
}

/** Sans casse, accent ni ligature : « Nœunœuf » → « noeunoeuf », « Éli » → « eli ». */
export const fold = (text: string) =>
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

/** Cette carte est-elle à compléter ? (`CardNeed`) */
export function cardNeeds(view: CardView, need: CardNeed) {
  switch (need) {
    case 'no-image':
      return view.card.image === null
    case 'no-cardmarket':
      return view.card.cardmarket === undefined
    case 'no-paid':
      return view.status === 'owned' && view.paidPrice === null
  }
}

const cardMatches = (cards: readonly CardView[], filter: CardFilter) =>
  filter === 'with'
    ? cards.length > 0
    : filter === 'without'
      ? cards.length === 0
      : cards.some((view) => cardNeeds(view, filter))

export function filterEntries(entries: PokedexEntry[], filters: PokedexFilters): PokedexEntry[] {
  const matches = searchMatcher(filters.search)
  return entries.filter(
    ({ species, unlocked, status, cards }) =>
      (!filters.generation || species.generation === filters.generation) &&
      (filters.possession === 'all' ||
        (filters.possession === 'owned' && unlocked) ||
        (filters.possession === 'missing' && !unlocked) ||
        status === filters.possession) &&
      (!filters.card || cardMatches(cards, filters.card)) &&
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
