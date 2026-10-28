/**
 * Export et import de la collection, sa relecture (celle du serveur, celle d'un fichier : seuls ses
 * champs connus), et les règles d'un document (un fichier importé, la collection envoyée au
 * serveur) : ce qui le fait refuser, dit en clair.
 */

import { TOTAL_SPECIES } from '@/config/pokedex'
import { ORDER_STATE_LABELS, SUPPLIER_LABELS } from '@/config/shopping'
import { parseCardmarketLink, readCardmarketId } from '@/lib/cardmarket'
import { completeFavorites } from '@/lib/collection'
import { formatDate, parseLink } from '@/lib/format'
import { refundFits } from '@/lib/orders'
import { seriesId } from '@/lib/series'
import type {
  BudgetSettings,
  CollectionData,
  CollectionDocument,
  CollectionExportFile,
  Order,
  PokemonCard,
  ShoppingData,
} from '@/types'

export function buildExportFile(
  collection: CollectionData,
  shopping: ShoppingData,
): CollectionExportFile {
  return {
    app: 'pokedex-collection',
    kind: 'collection-export',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    collection,
    shopping,
  }
}

/** Le JSON d'un fichier ; `null` s'il est illisible. */
function parseFile(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Une collection, telle qu'enregistrée ; `null` si ce n'en est pas une (mauvais fichier). Seuls
 * ses champs connus sont gardés. Une relecture de sa forme seulement : ses statuts, ses cartes, ses
 * favorites et ses collections d'extensions ne sont contrôlés qu'à l'import et par le serveur
 * (`documentProblem`) ; un document d'avant les collections (sans `series`) n'en a aucune. Les
 * favorites sont complétées : un document d'avant les favorites (ou un fichier auquel il en manque)
 * donne à chaque Pokémon sa première carte, celle que le Pokédex montrait ; celles notées restent.
 * Une carte abîmée (pas un objet à `dexIds` en liste) n'en donne pas : `documentProblem` la refuse,
 * la lecture ne plante jamais.
 */
export function readCollection(value: unknown): CollectionData | null {
  if (!isRecord(value) || !isRecord(value.cards) || !isRecord(value.customCards)) return null
  const cards = Object.values(value.customCards).filter(
    (card): card is PokemonCard => isRecord(card) && Array.isArray(card.dexIds),
  )
  const favorites = (isRecord(value.favorites) ? value.favorites : {}) as Record<number, string>
  return {
    schemaVersion: 1,
    updatedAt: value.updatedAt ?? null,
    cards: value.cards,
    customCards: value.customCards,
    favorites: completeFavorites(favorites, cards),
    series: Array.isArray(value.series) ? value.series : [],
  } as CollectionData
}

/**
 * Les achats (commandes, budget) ; `null` si ce n'en sont pas. Seuls leurs champs connus sont
 * gardés. Une relecture de leur forme seulement, comme `readCollection`.
 */
export function readShopping(value: unknown): ShoppingData | null {
  if (!isRecord(value) || !Array.isArray(value.orders) || !isRecord(value.budget)) return null
  return {
    schemaVersion: 1,
    updatedAt: value.updatedAt ?? null,
    orders: value.orders,
    budget: value.budget,
  } as unknown as ShoppingData
}

/** Aucune valeur en double. */
const distinct = (values: readonly unknown[]) => new Set(values).size === values.length

/** Un montant en euros : un nombre, positif ou nul (pas « 5 » en texte, qui fausserait les sommes). */
const isAmount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isOptional = (value: unknown, ok: (value: unknown) => boolean) =>
  value === undefined || ok(value)

/** Un texte : l'app le lit comme tel (`trim`, tri), un nombre la ferait planter. */
const isText = (value: unknown) => typeof value === 'string'

/**
 * Un jour qui existe (YYYY-MM-DD, pas `2026-13-45`) : le budget en tire le mois, la réception la
 * date d'obtention. Pas d'avant l'an 100 : `Date.UTC` lit les années 0 à 99 comme 1900 à 1999 (une
 * année tapée en deux chiffres, « 05/10/26 », donne l'an 26). Le formulaire de commande refuse les
 * mêmes jours, sans quoi le serveur refuserait le document.
 */
export function isDay(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  // Un jour qui n'existe pas déborde sur le suivant (le 30 février devient le 2 mars).
  return new Date(Date.UTC(year, month - 1, day)).toISOString().startsWith(value)
}

/** Un instant (ISO), lisible comme une date : la date d'obtention, triée et affichée. */
const isTime = (value: unknown) => isText(value) && !Number.isNaN(Date.parse(value as string))

const isOwnership = (ownership: Record<string, unknown>) =>
  ['owned', 'ordered'].includes(ownership.status as string) &&
  isText(ownership.updatedAt) &&
  (ownership.acquiredAt == null || isTime(ownership.acquiredAt)) &&
  isOptional(ownership.paidPrice, isAmount)

/**
 * Une carte, rangée sous son id (l'app la retrouve par sa clé et l'enregistre sous son id : deux
 * différents la dédoubleraient), de Pokémon du Pokédex (aucun : un dresseur ou une énergie, une
 * carte d'extension ; au plus autant que le Pokédex en compte : une vraie carte en porte un à trois,
 * et sans borne, les favorites, `isFavorite`, parcourraient des millions de numéros), de langue
 * française (`'fr'`) ou sans langue : le japonais n'a qu'une écriture, l'absence (un « ja » ferait
 * deux écritures d'une même langue), et `seriesOnly` (une case pas encore obtenue) absent ou vrai :
 * à l'obtention le champ disparaît, il ne devient pas faux.
 */
const isCard = (card: Record<string, unknown>, key: string) =>
  card.id === key &&
  Array.isArray(card.dexIds) &&
  card.dexIds.length <= TOTAL_SPECIES &&
  card.dexIds.every((id) => Number.isInteger(id) && id >= 1 && id <= TOTAL_SPECIES) &&
  isText(card.reference) &&
  (card.image === null ||
    (isRecord(card.image) && isText(card.image.small) && isText(card.image.large))) &&
  // Comme à la saisie : un id 0, négatif ou trop long ferait un lien et une requête de prix vains.
  isOptional(card.cardmarket, (id) => readCardmarketId(String(id)) === id) &&
  isOptional(card.page, (page) => isText(page) && parseCardmarketLink(page as string) !== null) &&
  isOptional(card.language, (language) => language === 'fr') &&
  isOptional(card.seriesOnly, (seriesOnly) => seriesOnly === true)

/**
 * Une collection d'extension : son extension (`set`, le code du catalogue), son nom, sa langue
 * (`'fr'` ou aucune, comme une carte), le jour où elle a été commencée, et ses cases : l'id d'une
 * carte du document chacune, une seule fois (les pages lisent la carte de chaque case sans garde).
 */
const isSeries = (series: Record<string, unknown>, customCards: Record<string, PokemonCard>) =>
  isText(series.set) &&
  series.set !== '' &&
  isText(series.name) &&
  isOptional(series.language, (language) => language === 'fr') &&
  isTime(series.startedAt) &&
  Array.isArray(series.cards) &&
  series.cards.every((id) => typeof id === 'string' && Object.hasOwn(customCards, id)) &&
  distinct(series.cards)

const isLine = (line: Record<string, unknown>) =>
  isText(line.cardId) &&
  Number.isInteger(line.quantity) &&
  (line.quantity as number) >= 1 &&
  isAmount(line.unitPrice) &&
  (line.previous === null || (isRecord(line.previous) && isOwnership(line.previous)))

const isOrder = (order: Record<string, unknown>) =>
  isText(order.id) &&
  order.id !== '' &&
  isDay(order.date) &&
  isOptional(order.receivedAt, isDay) &&
  isText(order.updatedAt) &&
  Object.hasOwn(SUPPLIER_LABELS, order.supplier as string) &&
  isOptional(order.supplierName, isText) &&
  isOptional(order.reference, isText) &&
  isOptional(order.note, isText) &&
  Object.hasOwn(ORDER_STATE_LABELS, order.state as string) &&
  isAmount(order.shipping) &&
  isAmount(order.fees) &&
  isAmount(order.refunded) &&
  isOptional(order.link, (link) => isText(link) && parseLink(link as string) !== null) &&
  Array.isArray(order.lines) &&
  !firstBad(order.lines, isLine) &&
  // Une carte par ligne : deux lignes d'une même carte, la seconde effacerait le report de la
  // première sur la collection.
  distinct(order.lines.map((line: { cardId: string }) => line.cardId)) &&
  // Comme à la saisie : un remboursé plus grand que la commande ferait une dépense négative.
  refundFits(order as unknown as Order)

const isBudget = (budget: BudgetSettings) =>
  isAmount(budget.monthly) && isAmount(budget.ceiling) && isAmount(budget.shippingReserve)

/** Une date de dernière modification : absente ou `null` avant la première. */
const isUpdatedAt = (value: unknown) => value == null || isText(value)

/** La première entrée d'un dictionnaire (ou d'une liste) qui ne passe pas `ok`. */
const firstBad = (values: object, ok: (value: Record<string, unknown>, key: string) => boolean) =>
  Object.entries(values).find(([key, value]) => !(isRecord(value) && ok(value, key)))

/**
 * Une favorite : l'id d'une carte du document (`id`, texte, propre à `customCards`) qui porte le
 * Pokémon `key` (son numéro, écrit comme l'app l'écrit : « 025 » n'est pas le 25), et qui est déjà
 * une de ses cartes : une case d'extension pas encore obtenue (`seriesOnly`) ne l'est pas encore.
 */
const isFavorite = (customCards: Record<string, PokemonCard>, key: string, id: unknown) =>
  typeof id === 'string' &&
  Object.hasOwn(customCards, id) &&
  !customCards[id]!.seriesOnly &&
  customCards[id]!.dexIds.some((dexId) => String(dexId) === key)

/** Une carte, pour l'utilisateur : sa référence, sinon son id. */
const cardName = (card: unknown, key: string) =>
  isRecord(card) && isText(card.reference) && card.reference !== '' ? card.reference : key

/** Une collection, pour l'utilisateur : son nom entre guillemets, sinon « sans nom ». */
const seriesName = (series: unknown) =>
  isRecord(series) && isText(series.name) && series.name !== ''
    ? `« ${series.name as string} »`
    : 'sans nom'

/** Une commande, pour l'utilisateur : sa référence, sinon son jour. */
function orderName(order: unknown) {
  if (!isRecord(order)) return 'sans date'
  if (isText(order.reference) && order.reference !== '') return `« ${order.reference as string} »`
  return isDay(order.date) ? `du ${formatDate(order.date as string)}` : 'sans date'
}

/**
 * Une case d'extension pas encore obtenue (`seriesOnly`) qui n'est pas dans une seule collection,
 * dite en clair ; `null` sans. Dans aucune, rien ne la montrerait ni ne la retirerait ; dans deux,
 * supprimer l'une la retirerait à l'autre. Une carte qui n'est pas `seriesOnly` (possédée, ajoutée
 * seule) peut être la case de plusieurs collections, ou d'aucune.
 */
function lostSlot(collection: CollectionData) {
  const counts = new Map<string, number>()
  for (const id of collection.series.flatMap(({ cards }) => cards)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const slot = Object.values(collection.customCards).find(
    (card) => card.seriesOnly && counts.get(card.id) !== 1,
  )
  if (!slot) return null
  const where = counts.has(slot.id)
    ? 'est dans plusieurs collections'
    : 'n’est dans aucune collection'
  return `la carte « ${slot.reference} » ${where}`
}

/**
 * La première règle que ne passe pas un document, dite en clair (« la carte « SV2a 165 » est
 * abîmée ») ; `null` s'il les passe toutes. Ses enregistrements, là où l'app les lit sans garde :
 * un fichier retouché à la main ne doit ni faire planter les pages une fois importé (puis
 * enregistré), ni fausser le budget (un montant en texte, une commande en double), ni glisser un
 * lien qui ne serait pas une adresse web. Les mêmes règles pour un fichier importé et pour la
 * collection envoyée au serveur, relues par le navigateur quand le serveur la refuse.
 */
export function documentProblem({ collection, shopping }: CollectionDocument): string | null {
  if (!isUpdatedAt(collection.updatedAt)) return 'la date de la collection est illisible'
  const ownership = firstBad(collection.cards, isOwnership)
  if (ownership) return `le statut de la carte ${ownership[0]} est abîmé`
  const card = firstBad(collection.customCards, isCard)
  if (card) return `la carte « ${cardName(card[1], card[0])} » est abîmée`
  // Après les cartes : `isFavorite` lit leur `dexIds`, qu'elles passent.
  const favorite = Object.entries(collection.favorites).find(
    ([key, id]) => !isFavorite(collection.customCards, key, id),
  )
  if (favorite) return `la carte favorite du Pokémon n° ${favorite[0]} n’est pas une de ses cartes`
  // Après les cartes : `isSeries` cherche les cases parmi elles.
  const series = firstBad(collection.series, (series) => isSeries(series, collection.customCards))
  if (series) return `la collection ${seriesName(series[1])} est abîmée`
  // Une collection se retrouve par son extension et sa langue (`seriesId`) : en une passe. Chercher
  // chacune dans toute la liste coûtait le carré de leur nombre (90 000 collections vides, quelques
  // Ko compressés : 10 s pendant lesquelles le serveur ne répondait plus à personne).
  const seen = new Set<string>()
  const twice = collection.series.find((series) => {
    const id = seriesId(series)
    if (seen.has(id)) return true
    seen.add(id)
    return false
  })
  if (twice) return `deux collections de l’extension ${twice.set}`
  const lost = lostSlot(collection)
  if (lost) return lost
  if (!isUpdatedAt(shopping.updatedAt)) return 'la date des achats est illisible'
  const order = firstBad(shopping.orders, isOrder)
  if (order) return `la commande ${orderName(order[1])} est abîmée`
  // Une commande est retrouvée par son id : deux du même id se confondraient.
  if (!distinct(shopping.orders.map((order) => order.id))) return 'deux commandes ont le même id'
  if (!isBudget(shopping.budget)) return 'le budget est abîmé'
  return null
}

/** Ce qu'on lit d'un fichier ou d'un envoi : son contenu, ou la raison de son refus. */
type Read<T> = { document: T; problem: null } | { document: null; problem: string }

const refusal = (problem: string) => ({ document: null, problem })

/** La collection et ses achats, lus et contrôlés. */
function readParts(collectionValue: unknown, shoppingValue: unknown): Read<CollectionDocument> {
  const collection = readCollection(collectionValue)
  if (!collection) return refusal('ce n’est pas une collection')
  const shopping = readShopping(shoppingValue)
  if (!shopping) return refusal('ses achats sont illisibles')
  const problem = documentProblem({ collection, shopping })
  return problem ? refusal(problem) : { document: { collection, shopping }, problem: null }
}

/** Le contenu d'un fichier d'export, ou la raison de son refus (pas un export, ou abîmé). */
export function readImport(text: string) {
  const file = parseFile(text)
  if (!isRecord(file) || file.kind !== 'collection-export') {
    return refusal('ce n’est pas un export de collection de ce Pokédex')
  }
  return readParts(file.collection, file.shopping)
}

/**
 * La collection et les achats qu'un navigateur envoie au serveur, ou la raison
 * de leur refus : le serveur les contrôle aux mêmes règles qu'un fichier importé.
 */
export function readSent(value: unknown): Read<CollectionDocument> {
  if (!isRecord(value)) return refusal('ce n’est pas une collection')
  return readParts(value.collection, value.shopping)
}
