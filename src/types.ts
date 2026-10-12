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
  name: string | null
  /** YYYY-MM-DD */
  releaseDate: string | null
}

/** Une carte telle que l'app l'affiche. */
export interface PokemonCard {
  /** `tcgdex:ja:<id de l'index>` ; `manual:<uuid>` pour une carte saisie dans une ancienne version. */
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
  illustrator: string | null
  image: CardImage | null
  /** Id du produit Cardmarket (`idProduct`), quand l'index le connaît. */
  cardmarket?: number
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
  /** Absent des exports faits avant le module d'achats (l'import le tolère). */
  shopping: ShoppingData
}

/* Achats : `localStorage` (`pokedex-collection.shopping`) et fichier d'export */

export type Priority = 'high' | 'normal' | 'low'

/** Ce que l'utilisateur pense d'une carte à l'achat ; indépendant de son statut. */
export interface PurchasePreference {
  /** `accepted` : dans la liste d'achats ; `excluded` : jamais proposée. */
  decision: 'accepted' | 'excluded'
  priority: Priority
  /** Prix maximum, en euros. */
  maxPrice?: number
  note?: string
  /** Page du produit sur Cardmarket, collée par l'utilisateur : l'app n'invente aucun lien. */
  link?: string
  updatedAt: string
}

export type Supplier = 'cardmarket' | 'myutsu' | 'hikaru' | 'other'

export type OrderState = 'pending' | 'received' | 'cancelled'

export interface OrderLine {
  cardId: string
  quantity: number
  /** Prix d'une carte, en euros, hors port et frais. */
  unitPrice: number
  /** La carte dans la collection avant la commande : rétablie si la commande est annulée. */
  previous: CardOwnership | null
}

export interface Order {
  id: string
  supplier: Supplier
  /** Le nom d'un fournisseur `other`. */
  supplierName?: string
  /** Date d'achat (YYYY-MM-DD) : la commande compte dans ce mois. */
  date: string
  reference?: string
  lines: OrderLine[]
  shipping: number
  /** Autres frais : frais de service, douane… */
  fees: number
  /** Montant remboursé (carte manquante, litige). Une commande annulée ne compte pas du tout. */
  refunded: number
  state: OrderState
  /** Date de réception (YYYY-MM-DD), pour une commande reçue. */
  receivedAt?: string
  note?: string
  link?: string
  updatedAt: string
}

export interface BudgetSettings {
  /** Budget habituel d'un mois, en euros. */
  monthly: number
  /** Ce qu'on s'autorise au plus dans un mois. */
  ceiling: number
  /** Ce qu'on garde de côté pour le port d'une commande. */
  shippingReserve: number
}

export interface ShoppingData {
  schemaVersion: 1
  updatedAt: string | null
  /** Clé : id de carte. */
  preferences: Record<string, PurchasePreference>
  /** La plus récente d'abord. */
  orders: Order[]
  budget: BudgetSettings
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
  /** Extension et numéro, à la façon de TCGdex : `SV2a-173` (aussi pour une carte qu'il n'a pas). */
  id: string
  /** Extension : clé de `CardIndexFile.sets`. */
  set: string
  number: string
  name: string | null
  /** Code de la classe de rareté. */
  rarity: string
  illustrator: string | null
  /** Base d'image TCGdex ou TCGplayer (voir `src/lib/images.ts`). */
  image: string | null
  dexIds: number[]
  /** Id du produit Cardmarket, pour les prix. */
  cardmarket?: number
}

export interface CardIndexFile {
  generatedAt: string
  sets: Record<string, { name: string; releaseDate: string }>
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
  /** Clé : id de l'index (`SV2a-173`). */
  cards: Record<string, CardPrice>
}

/** Un prix par carte et par jour : Cardmarket ne garde pas d'historique. */
export interface PriceHistoryFile {
  /** Du plus ancien au plus récent (YYYY-MM-DD). */
  days: string[]
  /** Clé : id de l'index ; une valeur par jour de `days`, `null` sans prix ce jour-là. */
  cards: Record<string, (number | null)[]>
}
