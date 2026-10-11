/* Référence : espèces (PokéAPI) et cartes (TCGdex), embarquées dans `src/data` */

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
  /** Numéro du Pokédex national. */
  id: number
  names: { fr: string; en: string; ja: string | null }
  types: PokemonTypeId[]
  generation: GenerationId
}

/** Ce que dit le jeu d'une espèce : chargé à la première fiche ouverte. */
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
  /** Pour les vignettes. */
  small: string
  /** Pour la carte en grand. */
  large: string
}

export interface CardSet {
  id: string | null
  name: string | null
  /** YYYY-MM-DD */
  releaseDate: string | null
}

/** Une carte telle que l'app l'affiche. */
export interface PokemonCard {
  /** `tcgdex:ja:<id TCGdex>` ; `manual:<uuid>` pour une carte saisie dans une ancienne version. */
  id: string
  /** Les Pokémon de la carte : plusieurs pour une carte TAG TEAM. */
  dexIds: number[]
  /** Nom imprimé, en japonais. */
  name: string | null
  /** `SV2a 173` */
  reference: string
  set: CardSet | null
  /** Code de la classe de rareté (`AR`) ; libellé libre pour une carte d'une ancienne version. */
  rarity: string | null
  /** Classe déduite de la numérotation : TCGdex ne donne pas de rareté utilisable. */
  deduced?: boolean
  illustrator: string | null
  image: CardImage | null
}

/* Données de l'utilisateur : `localStorage` et fichier d'export */

export type CardStatus = 'wanted' | 'ordered' | 'owned'

/** L'illustration choisie pour un Pokémon. */
export interface CollectionEntry {
  speciesId: number
  favoriteCardId: string | null
  updatedAt: string
}

export interface CardOwnership {
  status: CardStatus
  updatedAt: string
  /** Date du passage à « possédée ». */
  acquiredAt: string | null
  /** Prix payé, en euros ; absent s'il n'a pas été noté. */
  paidPrice?: number
}

export interface CollectionData {
  schemaVersion: 1
  updatedAt: string | null
  /** Clé : numéro de Pokédex. */
  entries: Record<string, CollectionEntry>
  /** Clé : id de carte. Une carte sans statut n'y figure pas. */
  cards: Record<string, CardOwnership>
  /** Cartes ajoutées par une ancienne version (saisies à la main) : toujours candidates. */
  customCards: Record<string, PokemonCard>
}

export interface AppSettings {
  schemaVersion: 1
  /** Classes de rareté dont les cartes peuvent illustrer un Pokémon. */
  enabledRarityCodes: string[]
}

export interface CollectionExportFile {
  app: 'pokedex-collection'
  kind: 'collection-export'
  schemaVersion: 1
  exportedAt: string
  collection: CollectionData
  settings: AppSettings
}

/* Fichiers de `src/data`, écrits par `bun run data` */

export interface SpeciesFile {
  generatedAt: string
  species: PokemonSpecies[]
}

export interface SpeciesDetailsFile {
  details: PokemonSpeciesDetails[]
}

/** Une carte de l'index : déjà classée, avec la base de son image. */
export interface CardIndexRow {
  /** Id TCGdex : `SV2a-173`. */
  id: string
  /** Extension : clé de `CardIndexFile.sets`. */
  set: string
  number: string
  name: string | null
  /** Code de la classe de rareté. */
  rarity: string
  deduced?: true
  illustrator: string | null
  /** Base d'image TCGdex ou TCGplayer (voir `src/lib/images.ts`). */
  image: string | null
  dexIds: number[]
  /** Id du produit Cardmarket, pour les prix. */
  cardmarket?: number
}

export interface CardIndexFile {
  generatedAt: string
  sets: Record<string, { name: string; releaseDate: string | null }>
  cards: CardIndexRow[]
}

/* Prix Cardmarket : `/prices/`, écrits chaque jour par `scripts/prices.ts` */

export interface CardPrice {
  /** Prix du marché : la tendance Cardmarket, sinon sa moyenne sur 30 jours. */
  price: number
  low: number | null
  avg30: number | null
}

export interface PriceFile {
  /** Jour du guide des prix (YYYY-MM-DD). */
  date: string
  /** Clé : id TCGdex. */
  cards: Record<string, CardPrice>
}

/** Un prix par carte et par jour : Cardmarket ne garde pas d'historique. */
export interface PriceHistoryFile {
  /** Du plus ancien au plus récent (YYYY-MM-DD). */
  days: string[]
  /** Clé : id TCGdex ; une valeur par jour de `days`, `null` sans prix ce jour-là. */
  cards: Record<string, (number | null)[]>
}
