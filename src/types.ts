/* Référence : les espèces (PokéAPI), embarquées dans `src/data` */

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

/** La carte qu'un Pokémon attend : c'est l'utilisateur qui l'ajoute, une par Pokémon. */
export interface PokemonCard {
  /** `manual:<uuid>`. */
  id: string
  /** Le Pokémon de la carte (plusieurs pour une carte TAG TEAM d'une ancienne version). */
  dexIds: number[]
  /** Ce qu'on en dit : « SV4a 349 », le nom Cardmarket… */
  reference: string
  /** L'adresse de l'image collée (la même pour les deux tailles) ; `null` sans image. */
  image: CardImage | null
  /** Id du produit Cardmarket (`idProduct`), pour son prix. */
  cardmarket?: number
  /** Sa page chez Cardmarket, collée ou reprise par le favori : l'app n'invente aucun lien. */
  page?: string
}

/* Données de l'utilisateur : `localStorage` et fichier d'export */

export type CardStatus = 'wanted' | 'ordered' | 'owned'

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
  /** Clé : id de carte. Une carte sans statut n'y figure pas. */
  cards: Record<string, CardOwnership>
  /** Les cartes ajoutées par l'utilisateur, une par Pokémon. Clé : id de carte. */
  customCards: Record<string, PokemonCard>
}

export interface CollectionExportFile {
  app: 'pokedex-collection'
  kind: 'collection-export'
  schemaVersion: 1
  exportedAt: string
  collection: CollectionData
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

/* Prix Cardmarket : `/prices/`, écrits chaque jour par `scripts/prices.ts` */

export interface CardPrice {
  /** Prix du marché : la tendance Cardmarket, sinon sa moyenne sur 30 jours. */
  price: number
  low: number | null
  avg30: number | null
}

/** Le prix du jour d'une carte, en court : prix du marché, plus bas, moyenne sur 30 jours. */
export type CardPriceRow = [price: number, low: number | null, avg30: number | null]

/** `latest.json` : le prix du jour de toutes les cartes Pokémon à l'unité de Cardmarket. */
export interface PriceFile {
  /** Jour du guide des prix (YYYY-MM-DD). */
  date: string
  /** Clé : id Cardmarket (`idProduct`). */
  cards: Record<string, CardPriceRow>
}

/** `history/<idProduct>.json` : l'historique d'une carte (Cardmarket n'en garde pas). */
export interface CardPriceHistory {
  /** Son nom chez Cardmarket : « Leafeon V [Greening Cells | Leaf Blade] ». */
  name: string | null
  /** Le premier jour (YYYY-MM-DD). */
  from: string
  /** Un prix par jour depuis `from` ; `null` sans prix ce jour-là. */
  prices: (number | null)[]
}
