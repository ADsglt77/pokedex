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
  /**
   * Les Pokémon dont c'est la carte : plusieurs pour une carte TAG TEAM, achetée une fois, qui les
   * débloque tous (`cardSpecies`).
   */
  dexIds: number[]
  /** « Bulbizarre (SV2a 166) » : son nom, puis le code de l'extension et le numéro (d'où l'image). */
  reference: string
  /**
   * Son image, en deux tailles : servie par le site à un chemin neutre
   * (`/images/cards/SV2A/166-md.webp`, `lib/card-images.ts`), ou l'adresse collée (la même pour
   * les deux) ; `null` sans image.
   */
  image: CardImage | null
  /** Id du produit Cardmarket (`idProduct`), pour son prix et le lien vers sa page. */
  cardmarket?: number
  /** Sa page chez Cardmarket, collée ; sans elle, le lien suit l'id. */
  page?: string
  /**
   * `'fr'` pour une carte française ; absent, elle est japonaise (`cardLanguage`) : les collections
   * et les exports d'avant les cartes françaises restent japonais, sans migration. Le japonais n'a
   * qu'une écriture, l'absence.
   */
  language?: 'fr'
}

/* Données de l'utilisateur : gardées par le serveur (`/api/collection`) et fichier d'export */

/** Commandée ou possédée ; une carte choisie sans statut est à débloquer. */
export type CardStatus = 'ordered' | 'owned'

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

/** Le document d'un compte : la collection et les achats, gardés ensemble par le serveur. */
export interface CollectionDocument {
  collection: CollectionData
  shopping: ShoppingData
}

export interface CollectionExportFile {
  app: 'pokedex-collection'
  kind: 'collection-export'
  schemaVersion: 1
  exportedAt: string
  collection: CollectionData
  shopping: ShoppingData
}

/* Achats : gardés avec la collection, et fichier d'export */

/** Ce qu'on fait d'une carte en l'ajoutant : rien (elle est à acheter), ou possédée. */
export type AddAs = 'none' | 'owned'

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
 * La langue des cartes : japonaises (`ja`) ou françaises (`fr`). Chaque réponse du catalogue est
 * dans sa langue, de même forme : `/api/catalog/…` pour les japonaises, `/api/catalog/fr/…` pour
 * les françaises, dont la « sortie » est celle en France (au Japon pour les japonaises).
 */
export type CardLanguage = 'ja' | 'fr'

/**
 * Une carte du catalogue : [série, numéro (sans numéro imprimé : son rang), id Cardmarket (0 :
 * aucun), nom français, numéro de son image chez Pokécardex (0 : aucune), sa rareté (0 : inconnue),
 * son type (`CARD_TYPES` ; 0 : inconnu), ses Pokémon s'ils sont plusieurs].
 */
type CatalogRow = [string, string, number, string, number, number, number, number[]?]

/**
 * `/api/catalog/species/<n°>` (`/api/catalog/fr/species/<n°>` pour les françaises) : les cartes
 * Pokémon d'un Pokémon chez Pokécardex dans sa langue, avec leurs séries et leurs raretés (la tâche
 * `catalog` de l'API des données) : la fenêtre d'ajout.
 */
export interface CatalogFile {
  /**
   * Clé : le code de la série chez Pokécardex (« SV2A ») ; [nom, date de sortie (au Japon, en
   * France pour une série française), 1 si son logo est chez nous ou pas encore cherché, 0 si
   * Pokécardex n'en a pas].
   */
  sets: Record<string, [name: string, released: string, logo: 0 | 1]>
  /** Clé : numéro du Pokémon ; ses cartes, des plus récentes aux plus anciennes. */
  cards: Partial<Record<string, CatalogRow[]>>
  /** Clé : le numéro d'une rareté de ces cartes ; [son nom chez Pokécardex, son rang]. */
  rarities: Record<string, [name: string, rank: number]>
}

/**
 * `/api/catalog/sets` (`/api/catalog/fr/sets` pour les françaises) : les séries du catalogue de sa
 * langue, pour la page Catalogue (tâche `catalog`).
 */
export interface CatalogSetsFile {
  /** Les blocs du menu de Pokécardex (« Scarlet & Violet »), des plus récents aux plus anciens. */
  blocks: string[]
  /**
   * Des plus récentes aux plus anciennes : [code (« SV2A »), nom, sortie (au Japon, en France pour
   * une série française ; YYYY-MM-DD, '' si inconnue), logo (comme `CatalogFile`), nombre de
   * cartes, rang de son bloc dans `blocks` (-1 : aucun), 1 pour un deck].
   */
  sets: [
    id: string,
    name: string,
    released: string,
    logo: 0 | 1,
    cards: number,
    block: number,
    deck: 0 | 1,
  ][]
}

/** Une carte d'une série, telle que la donne `/api/catalog/sets/<code>`. */
interface CatalogSetRow {
  /** Le numéro de sa référence (« 006 » ; sans numéro imprimé : son rang), unique dans la série. */
  number: string
  /** Le numéro tel qu'imprimé : « 006/165 », « R/RGB » ; '' sans numéro. */
  printed: string
  /** Son nom français ; '' si Pokécardex ne le donne pas. */
  name: string
  /** Ses noms anglais et allemand ; '' si inconnus. */
  en: string
  de: string
  /** Ses Pokémon ; aucun pour un dresseur ou une énergie. */
  dexIds: number[]
  /** 0 : aucun. */
  cardmarket: number
  /** Le numéro de son image chez Pokécardex ; 0 : aucune. */
  image: number
  /** 0 : inconnue. */
  rarity: number
  /** `CARD_TYPES` ; 0 : inconnu. */
  type: number
  /** '' : inconnu. */
  illustrator: string
  /** « Standard », « Reverse »… */
  versions: string[]
}

/**
 * `/api/catalog/sets/<code>` (`/api/catalog/fr/sets/<code>` pour les françaises) : toutes les
 * cartes d'une série, dans son ordre, et leurs raretés.
 */
export interface CatalogSetFile {
  cards: CatalogSetRow[]
  rarities: CatalogFile['rarities']
}

/* L'état des tâches d'ingestion de l'API des données : `/api/status` */

/**
 * Où en est une tâche : à jour, en retard (pas de réussite depuis deux de ses intervalles), en
 * échec (son dernier passage), jamais passée, ou, pour les prix, figés (le guide de Cardmarket
 * inchangé depuis plus de deux jours). Une tâche à la demande n'est jamais en retard.
 */
export type JobState = 'ok' | 'late' | 'failed' | 'never' | 'frozen'

export interface ServerStatus {
  /**
   * Chaque tâche, dans l'ordre de `INGEST_JOBS`. La cause d'un échec n'est pas rendue : elle est
   * dans la sortie de l'ingestion (le journal du service `ingest`, ou le terminal d'une tâche à la
   * demande) et dans `runs.message`.
   */
  jobs: { job: string; label: string; state: JobState }[]
}

/* Prix : `/api/prices?ids=…`, mis à jour par la tâche `prices` de l'API des données */

export interface CardPrice {
  /**
   * Prix du marché, en euros, la règle de Pokécardex (`guidePrice`) : la tendance Cardmarket pour
   * une série sortie depuis moins de 31 jours, sa moyenne sur 30 jours ensuite.
   */
  price: number
  low: number | null
  /** Son prix d'il y a 30 jours, d'après l'historique ; `null` sans. */
  monthAgo: number | null
}

/** Le prix du jour d'une carte, en court : prix du marché, plus bas, prix d'il y a 30 jours. */
type CardPriceRow = [price: number, low: number | null, monthAgo: number | null]

/**
 * Les prix Cardmarket du jour des cartes demandées (`/api/prices?ids=…`, et ceux des cartes
 * possédées de `/api/vitrine/<pseudo>` ; 404 tant que le guide n'a jamais été lu).
 */
export interface PriceFile {
  /** Jour du guide des prix (YYYY-MM-DD). */
  date: string
  /**
   * Clé : id Cardmarket (`idProduct`), une par carte demandée ; `null` : sans prix ce jour.
   */
  cards: Record<string, CardPriceRow | null>
}

/* Le compte (`/api/account`) et sa collection (`/api/collection`), `server/` */

/**
 * Le compte connecté : son id et son pseudo, tel que tapé (« Le Pokédex de Sacha ») ; en
 * minuscules, l'adresse de son Pokédex public (`/sacha`, `vitrinePath`).
 */
export interface AccountUser {
  id: string
  name: string
}

/** `GET /api/account` : une seule requête au démarrage (`loadAccount`). */
export interface AccountState {
  /** Qui est connecté sur ce navigateur ; `null` : personne. */
  user: AccountUser | null
}

/**
 * `GET /api/collection` : le document du compte, numéroté (`version`, que l'appareil renvoie avec
 * ses modifications) ; `version` 0 et le reste `null` tant que rien n'a été enregistré.
 * Enregistré tel que l'appareil l'a envoyé ; relu comme un fichier importé (`readCollection`,
 * `readShopping`).
 */
export interface CollectionResponse {
  version: number
  collection: CollectionData | null
  shopping: ShoppingData | null
}

/** `PUT /api/collection`, enregistré : la nouvelle version du document. */
export interface CollectionSaved {
  version: number
}

/** Le Pokédex public d'un compte (`/api/vitrine/<pseudo>`, `server/vitrine.ts`). */
export interface VitrineData {
  /** Le pseudo du compte, tel que tapé. */
  owner: string
  /** La collection, réduite à ce qui se montre (`shownCollection`). */
  collection: CollectionData
  /** Les prix du jour de ses seules cartes possédées ; `null` sans guide des prix. */
  prices: PriceFile | null
}

/**
 * `/api/wants?ids=…` : pour chaque id Cardmarket demandé (`idProduct`), sa ligne pour « Ajouter
 * une deck list » d'une liste de souhaits Cardmarket, ou `null` quand elle ne
 * désignerait pas sûrement cette carte-là (produit inconnu, extension ambiguë…).
 */
export type WantsLines = Record<string, string | null>

/** `/api/prices/<idProduct>` : l'historique d'une carte (Cardmarket n'en garde pas). */
export interface CardPriceHistory {
  /** Son nom chez Cardmarket : « Leafeon V [Greening Cells | Leaf Blade] ». */
  name: string | null
  /** Le premier jour (YYYY-MM-DD). */
  from: string
  /** Un prix par jour depuis `from` ; `null` sans prix ce jour-là. */
  prices: (number | null)[]
}

/**
 * `/api/histories?ids=…` : l'historique de chaque id Cardmarket demandé, en une demande (la courbe
 * de la valeur de la collection) ; `null` sans historique.
 */
export type PriceHistories = Record<string, CardPriceHistory | null>
