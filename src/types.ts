/* Données de référence (PokéAPI, TCGdex) */

export type PokemonTypeId =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy'

export type GenerationId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface PokemonSpecies {
  id: number
  slug: string
  names: { fr: string; en: string; ja: string | null }
  types: PokemonTypeId[]
  generation: GenerationId
}

export interface PokemonSpeciesDetails {
  id: number
  genus: string | null
  description: string | null
  heightM: number | null
  weightKg: number | null
  isBaby: boolean
  isLegendary: boolean
  isMythical: boolean
}

export interface CardImage {
  /** ~245×337 */
  small: string
  /** ~600×825 */
  large: string
}

export interface CardSet {
  id: string | null
  name: string | null
  /** YYYY-MM-DD */
  releaseDate: string | null
}

export interface PokemonCard {
  /** `tcgdex:ja:<tcgdexId>` ou `manual:<uuid>` */
  id: string
  source: 'tcgdex' | 'manual'
  /** Plusieurs numéros pour une carte TAG TEAM. */
  dexIds: number[]
  name: string | null
  /** `SV6a 065`, ou ce que l'utilisateur a saisi. */
  reference: string
  set: CardSet | null
  number: string | null
  /** Libellé brut de la source (`Illustration rare`) ou code saisi (`AR`). */
  rarity: string | null
  /** Classe déduite de la numérotation quand la source n'a pas de rareté exploitable. */
  rarityHint?: string | null
  illustrator: string | null
  image: CardImage | null
  sourceUrl: string | null
  note: string | null
}

/* Données personnelles (localStorage, export JSON) */

export type CardStatus = 'wanted' | 'ordered' | 'owned'

export interface CollectionEntry {
  speciesId: number
  favoriteCardId: string | null
  updatedAt: string
}

export interface CardOwnership {
  status: CardStatus
  updatedAt: string
  acquiredAt: string | null
  /** Prix payé, en euros ; absent s'il n'a pas été noté. */
  paidPrice?: number
}

export interface CollectionData {
  schemaVersion: 1
  updatedAt: string | null
  /** Clé : numéro de Pokédex. */
  entries: Record<string, CollectionEntry>
  /** Clé : id de carte. Absente = aucun statut. */
  cards: Record<string, CardOwnership>
  /**
   * Cartes ajoutées à la main ou gardées depuis TCGdex par une version précédente de l'app : plus
   * modifiables, mais conservées et toujours candidates.
   */
  customCards: Record<string, PokemonCard>
  /** Image fournie par l'utilisateur dans une version précédente, par id de carte. */
  imageOverrides: Record<string, string>
}

export interface AppSettings {
  schemaVersion: 1
  enabledRarityCodes: string[]
}

/* Fichiers de `src/data/`, générés par `bun run data` */

export interface SpeciesFile {
  schemaVersion: 1
  generatedAt: string
  source: string
  species: PokemonSpecies[]
}

export interface SpeciesDetailsFile {
  schemaVersion: 1
  generatedAt: string
  source: string
  details: PokemonSpeciesDetails[]
}

/** Une carte de l'index, à plat et proche de ce que renvoie TCGdex. */
export interface CardIndexRow {
  /** Id TCGdex, `SV6a-065`. */
  id: string
  /** Clé de `CardIndexFile.sets`. */
  set: string
  number: string
  /** `''` quand TCGdex n'en donne pas. */
  name: string
  /** Libellé TCGdex tel quel ; `''` quand TCGdex n'en donne pas. */
  rarity: string
  /** Classe déduite, seulement quand la rareté manque ou est fausse. */
  rarityHint?: string
  illustrator: string | null
  /** Base d'image TCGdex ou TCGplayer (voir `cardImage`), `null` sans image. */
  image: string | null
  dexIds: number[]
  /** Identifiant du produit Cardmarket, quand TCGdex le connaît (prix : `scripts/prices.ts`). */
  cardmarket?: number
}

export interface CardIndexFile {
  schemaVersion: 1
  generatedAt: string
  source: string
  /** Libellés de rareté des cartes de l'index. */
  rarities: string[]
  sets: Record<string, { name: string; serieId: string | null; releaseDate: string | null }>
  cards: CardIndexRow[]
}

/* Prix Cardmarket, écrits chaque jour par `scripts/prices.ts` dans `/prices/` (servis par le VPS) */

export interface CardPrice {
  /** Prix du marché : la tendance Cardmarket, sinon sa moyenne sur 30 jours. */
  price: number
  low: number | null
  avg30: number | null
}

export interface PriceFile {
  schemaVersion: 1
  /** Jour du guide des prix Cardmarket (YYYY-MM-DD). */
  date: string
  /** Clé : id TCGdex de la carte (`SV2a-173`). */
  cards: Record<string, CardPrice>
}

/** Un prix par carte et par jour : Cardmarket ne garde pas d'historique. */
export interface PriceHistoryFile {
  schemaVersion: 1
  /** Jours, du plus ancien au plus récent (YYYY-MM-DD). */
  days: string[]
  /** Clé : id TCGdex ; une valeur par jour de `days`, `null` sans prix ce jour-là. */
  cards: Record<string, (number | null)[]>
}

export interface CollectionExportFile {
  app: 'pokedex-collection'
  kind: 'collection-export'
  schemaVersion: 1
  exportedAt: string
  collection: CollectionData
  settings: AppSettings | null
}
