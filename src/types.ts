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
  /** « Bulbizarre (SV2a 166) » : son nom, puis le code de l'extension et le numéro (d'où l'image). */
  reference: string
  /** Son image : chez Pokécardex en deux tailles, ou l'adresse collée (la même pour les deux) ; `null` sans image. */
  image: CardImage | null
  /** Id du produit Cardmarket (`idProduct`), pour son prix et le lien vers sa page. */
  cardmarket?: number
  /** Sa page chez Cardmarket, collée ou reprise par le favori ; sans elle, le lien suit l'id. */
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
  /** `accepted` : dans la liste d'achats ; `excluded` (ancienne version) : compte comme non décidée. */
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

/**
 * Une carte de `catalog.json` : [extension, numéro, id Cardmarket (0 : inconnu), suffixe, produit
 * TCGplayer (0 : aucun), ses Pokémon s'ils sont plusieurs].
 */
export type CatalogRow = [string, string, number, string, number, number[]?]

/** `catalog.json` : les cartes Pokémon japonaises de TCGdex (`scripts/catalog.ts`). */
export interface CatalogFile {
  /** [nom japonais, date de sortie, groupes TCGplayer de ses cartes s'il y en a]. */
  sets: Record<string, [name: string, released: string, tcgplayerGroups?: number[]]>
  /** Clé : numéro du Pokémon ; ses cartes, des plus récentes aux plus anciennes. */
  cards: Partial<Record<string, CatalogRow[]>>
}

/* Prix : `/prices/`, écrits chaque jour par `scripts/prices.ts` */

/** D'où vient un prix : Cardmarket ; TCGplayer pour une carte sans id Cardmarket. */
export type PriceSource = 'cardmarket' | 'tcgplayer'

export interface CardPrice {
  /** Prix du marché, en euros : la tendance Cardmarket, sinon sa moyenne sur 30 jours. */
  price: number
  low: number | null
  /** Moyenne sur 30 jours (Cardmarket seulement). */
  avg30: number | null
  source: PriceSource
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

/** Le prix du jour d'une carte chez TCGplayer, converti en euros : prix du marché, plus bas. */
export type TcgplayerPriceRow = [price: number, low: number | null]

/**
 * `tcgplayer.json` : le prix du jour, chez TCGplayer, des cartes du catalogue sans id Cardmarket
 * (vieilles séries, decks), converti en euros.
 */
export interface TcgplayerPriceFile {
  /** Jour des prix (YYYY-MM-DD). */
  date: string
  /** Dollars pour un euro, au cours de référence de la Banque centrale européenne. */
  usdPerEur: number
  /** Clé : le code de la carte (`codeKey` : « E1 97 »). */
  cards: Record<string, TcgplayerPriceRow>
}

/** Les prix du jour, chacun `null` si son fichier manque. */
export interface Prices {
  cardmarket: PriceFile | null
  tcgplayer: TcgplayerPriceFile | null
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
