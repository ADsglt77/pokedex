/* Référence : les espèces (PokéAPI), lues sur le serveur (`/api/species`) */

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
  /** Sa page chez Cardmarket, collée ; sans elle, le lien suit l'id. */
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

/* Réponses de l'API : les espèces (`/api/species`, `/api/species/details`) et le catalogue */

export interface SpeciesFile {
  species: PokemonSpecies[]
}

export interface SpeciesDetailsFile {
  details: PokemonSpeciesDetails[]
}

/**
 * Une carte du catalogue : [série, numéro (sans numéro imprimé : son rang), id Cardmarket (0 :
 * aucun), nom français, numéro de son image chez Pokécardex (0 : aucune), ses Pokémon s'ils sont
 * plusieurs].
 */
export type CatalogRow = [string, string, number, string, number, number[]?]

/** `/api/catalog` : les cartes Pokémon japonaises de Pokécardex (tâche `catalog`, `server/jobs/catalog.ts`). */
export interface CatalogFile {
  /** Clé : le code de la série chez Pokécardex (« SV2A ») ; [nom, date de sortie au Japon]. */
  sets: Record<string, [name: string, released: string]>
  /** Clé : numéro du Pokémon ; ses cartes, des plus récentes aux plus anciennes. */
  cards: Partial<Record<string, CatalogRow[]>>
}

/* État du serveur : `/api/status`, d'après le journal des tâches d'ingestion (`server/ingest.ts`) */

/** Les passages d'une tâche (ISO) ; une tâche qui tourne encore n'en compte pas. */
export interface JobStatus {
  /** La fin du dernier passage réussi ; `null` s'il n'y en a pas eu. */
  lastSuccess: string | null
  /** La fin du dernier passage, réussi ou non : après `lastSuccess`, il a échoué. */
  lastRun: string | null
}

export interface ServerStatus {
  /** Clé : la tâche (`INGEST_JOBS`, `config/jobs.ts`) ; absente tant qu'elle n'est jamais passée. */
  jobs: Partial<Record<string, JobStatus>>
  /** Le jour du guide des prix Cardmarket en base ; `null` sans prix. */
  pricesDate: string | null
}

/* Prix : `/api/prices`, mis à jour par la tâche d'ingestion `prices` (`server/jobs/prices.ts`) */

export interface CardPrice {
  /** Prix du marché, en euros : la tendance Cardmarket, sinon sa moyenne sur 30 jours. */
  price: number
  low: number | null
  /** Moyenne sur 30 jours. */
  avg30: number | null
}

/** Le prix du jour d'une carte, en court : prix du marché, plus bas, moyenne sur 30 jours. */
export type CardPriceRow = [price: number, low: number | null, avg30: number | null]

/** Les prix Cardmarket du jour : toutes les cartes Pokémon à l'unité de Cardmarket. */
export interface PriceFile {
  /** Jour du guide des prix (YYYY-MM-DD). */
  date: string
  /** Clé : id Cardmarket (`idProduct`). */
  cards: Record<string, CardPriceRow>
}

/** Les prix du jour (`/api/prices`) : `null` tant que le guide n'a jamais été lu. */
export interface Prices {
  cardmarket: PriceFile | null
}

/** `/api/prices/<idProduct>` : l'historique d'une carte (Cardmarket n'en garde pas). */
export interface CardPriceHistory {
  /** Son nom chez Cardmarket : « Leafeon V [Greening Cells | Leaf Blade] ». */
  name: string | null
  /** Le premier jour (YYYY-MM-DD). */
  from: string
  /** Un prix par jour depuis `from` ; `null` sans prix ce jour-là. */
  prices: (number | null)[]
}
