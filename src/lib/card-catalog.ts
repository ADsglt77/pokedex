/**
 * Le catalogue des cartes japonaises, que l'API des données construit d'après Pokécardex :
 * - `/api/catalog/species/<n°>` : les cartes d'un Pokémon, des plus récentes aux plus anciennes,
 *   avec leur rareté, leur type et leurs séries (nom, date de sortie, logo) ; chargées par la
 *   fenêtre d'ajout, et préparées d'avance par la fiche d'un Pokémon sans carte (quand le
 *   navigateur est libre) ;
 * - `/api/catalog/sets` et `/api/catalog/sets/<code>` : les séries, puis toutes les cartes d'une
 *   série, dresseurs et énergies compris, avec tout ce qu'on en sait (la page Catalogue) ; elles
 *   donnent aussi l'image exacte d'une carte (`findCardImage`).
 * Aucun tri ni détection : l'utilisateur choisit, l'app ne propose rien seule.
 */

import { CARD_TYPES } from '@/config/catalog'
import { derived } from '@/lib/api'
import { codeKey, numberKey, referenceCode, setKey } from '@/lib/card-code'
import { cardImage, catalogImage } from '@/lib/card-images'
import { settled } from '@/lib/settled'
import { getSpecies } from '@/lib/species'
import type { CardImage, CatalogFile, CatalogSetFile, CatalogSetsFile, PokemonCard } from '@/types'

/** Une série du catalogue. */
export interface CatalogSet {
  /** Son code chez Pokécardex : « SV2A ». */
  id: string
  /** Son nom : « Pokémon Card 151 ». */
  name: string
  /** Son année de sortie ; `null` si Pokécardex ne la donne pas. */
  year: string | null
  /** Son logo japonais est chez nous (`setLogo`), ou pas encore cherché ; faux si aucun. */
  logo: boolean
}

/** Une rareté, telle que Pokécardex la nomme (« SAR », « Commune »…), et son rang. */
export interface Rarity {
  id: number
  name: string
  rank: number
}

/** Une carte du catalogue : de quoi la montrer et la reprendre dans la saisie. */
export interface CatalogCard {
  /** « SV2A 166 » : la série et le numéro, uniques. */
  key: string
  /** « 166 » : le numéro, sans la série. */
  number: string
  set: CatalogSet
  /** Ses Pokémon : un seul, sauf une carte TAG TEAM. */
  dexIds: number[]
  /** L'id Cardmarket, pour le prix et le lien ; absent si Pokécardex ne le connaît pas. */
  cardmarket?: number
  /** « Pikachu ex (SV8 033) », « Pikachu & Zekrom GX (SM9 031) » : son nom et son code. */
  reference: string
  /** Son image ; `null` si la source ne l'a pas. */
  image: CardImage | null
  /** Sa rareté ; `null` tant que Pokécardex ne la donne pas. */
  rarity: Rarity | null
  /** Son type (`CARD_TYPES`) ; `null` s'il n'en est pas un. */
  type: number | null
}

/** Les raretés d'une réponse, par numéro. */
const readRarities = (rarities: CatalogFile['rarities']) =>
  new Map(
    Object.entries(rarities).map(([id, [name, rank]]) => [
      Number(id),
      { id: Number(id), name, rank },
    ]),
  )

/** Le nom d'une carte ; sans nom connu, ses Pokémon : « Pikachu & Zekrom ». */
const cardName = (name: string, dexIds: number[]) =>
  name || dexIds.map((dexId) => getSpecies(dexId)!.names.fr).join(' & ')

/** Une carte, d'après ce qu'en disent les deux réponses du catalogue. */
function toCard<S extends CatalogSet>(
  set: S,
  row: { number: string; name: string; dexIds: number[]; cardmarket: number; image: number },
  rarity: Rarity | null,
  type: number,
) {
  const { number, dexIds } = row
  const name = cardName(row.name, dexIds)
  return {
    key: `${set.id} ${number}`,
    number,
    set,
    dexIds,
    cardmarket: row.cardmarket || undefined,
    reference: `${name} (${set.id} ${number})`,
    image: row.image ? catalogImage(set.id, row.image) : null,
    rarity,
    type: CARD_TYPES.has(type) ? type : null,
  }
}

/** Les cartes d'un Pokémon, d'après sa réponse (`/api/catalog/species/<n°>`). */
function readSpeciesCards(file: CatalogFile, speciesId: number): CatalogCard[] {
  const sets = new Map(
    Object.entries(file.sets).map(([id, [name, released, logo]]) => [
      id,
      { id, name, year: released.slice(0, 4) || null, logo: logo === 1 },
    ]),
  )
  const rarities = readRarities(file.rarities)
  return (file.cards[speciesId] ?? []).map(
    ([set, number, cardmarket, name, image, rarity, type, dexIds = [speciesId]]) =>
      toCard(
        sets.get(set)!,
        { number, name, dexIds, cardmarket, image },
        rarities.get(rarity) ?? null,
        type,
      ),
  )
}

const speciesLoaders = new Map<number, () => Promise<CatalogCard[] | null>>()

/**
 * Les cartes japonaises d'un Pokémon, des plus récentes aux plus anciennes ; `null` si le catalogue
 * n'est pas disponible (serveur arrêté, base encore vide : redemandé une minute après au plus tôt,
 * `getJson`). Toujours la même promesse pour un Pokémon, lue par `use()`.
 */
export function loadSpeciesCards(speciesId: number) {
  let load = speciesLoaders.get(speciesId)
  if (!load) {
    load = derived<CatalogFile, CatalogCard[] | null>(
      `/api/catalog/species/${speciesId}`,
      (file) => file && readSpeciesCards(file, speciesId),
    )
    speciesLoaders.set(speciesId, load)
  }
  return load()
}

/** Une série de la page Catalogue (`/api/catalog/sets`) : ce que disent sa tuile et son en-tête. */
export interface SetSummary extends CatalogSet {
  /** Sa sortie au Japon (YYYY-MM-DD) ; `null` si inconnue. */
  released: string | null
  /** Ses cartes au catalogue, dresseurs et énergies compris. */
  count: number
  /** Son bloc (« Scarlet & Violet ») ; `null` si inconnu. */
  block: string | null
  /** Un deck, pas une série en boosters. */
  deck: boolean
}

/** Les séries de la page Catalogue, des plus récentes aux plus anciennes, et leurs blocs. */
export interface CatalogSets {
  sets: SetSummary[]
  /** Des plus récents aux plus anciens. */
  blocks: string[]
}

/** L'adresse des séries du catalogue (oubliée pour « Réessayer », `CatalogPage`). */
export const CATALOG_SETS = '/api/catalog/sets'

/** Les séries de la page Catalogue ; `null` si elles ne sont pas disponibles (comme `loadCatalog`). */
export const loadSets = derived<CatalogSetsFile, CatalogSets | null>(
  CATALOG_SETS,
  (file) =>
    file && {
      blocks: file.blocks,
      sets: file.sets.map(([id, name, released, logo, count, block, deck]) => ({
        id,
        name,
        year: released.slice(0, 4) || null,
        released: released || null,
        logo: logo === 1,
        count,
        block: file.blocks[block] ?? null,
        deck: deck === 1,
      })),
    },
)

/** Une carte de la page Catalogue : celle du catalogue, et tout ce qu'on en sait de plus. */
export interface SetCard extends CatalogCard {
  set: SetSummary
  /** Son nom français (anglais s'il manque) ; « Pikachu & Zekrom » s'il n'a ni l'un ni l'autre. */
  name: string
  /** Ses noms anglais et allemand ; `null` si inconnus. */
  english: string | null
  german: string | null
  /** Son numéro tel qu'imprimé : « 006/165 » ; `null` sans numéro. */
  printed: string | null
  /** Numérotée au-delà du nombre imprimé de cartes de sa série (« 166/165 ») : une « secrète ». */
  secret: boolean
  illustrator: string | null
  /** « Standard », « Reverse »… */
  versions: string[]
}

/** « 166/165 » : le numéro dépasse le nombre de cartes imprimé. */
function isSecret(printed: string) {
  const [, number, total] = /^(\d+)\/(\d+)$/.exec(printed) ?? []
  return number !== undefined && Number(number) > Number(total)
}

function readSet(set: SetSummary, file: CatalogSetFile): SetCard[] {
  const rarities = readRarities(file.rarities)
  return file.cards.map((row) => {
    const card = toCard(set, row, rarities.get(row.rarity) ?? null, row.type)
    return {
      ...card,
      name: cardName(row.name, row.dexIds),
      english: row.en || null,
      german: row.de || null,
      printed: row.printed || null,
      secret: isSecret(row.printed),
      illustrator: row.illustrator || null,
      versions: row.versions,
    }
  })
}

const setLoaders = new Map<string, () => Promise<SetCard[] | null>>()

/**
 * Toutes les cartes d'une série, dans son ordre ; `null` si elles ne sont pas disponibles. Chaque
 * série est lue une fois : la même promesse, lue par `use()`.
 */
/** L'adresse des cartes d'une série (oubliée pour « Réessayer », `CatalogPage`). */
export const setCardsUrl = (set: SetSummary) => `/api/catalog/sets/${encodeURIComponent(set.id)}`

export function loadSetCards(set: SetSummary) {
  let load = setLoaders.get(set.id)
  if (!load) {
    load = derived<CatalogSetFile, SetCard[] | null>(
      setCardsUrl(set),
      (file) => file && readSet(set, file),
    )
    setLoaders.set(set.id, load)
  }
  return load()
}

/** Une série dans une liste de choix : « SV2A · Pokémon Card 151 (2023) ». */
export const setOption = ({ id, name, year }: CatalogSet) => ({
  value: id,
  label: `${id} · ${name}${year ? ` (${year})` : ''}`,
})

/**
 * La carte du catalogue d'une référence (« Herbizarre (OR1 2) »), lue dans sa série ; `null` si le
 * catalogue ne l'a pas (ou n'est pas disponible).
 */
async function catalogCard(reference: string): Promise<SetCard | null> {
  const code = referenceCode(reference)
  if (!code) return null
  const set = (await loadSets())?.sets.find((known) => setKey(known.id) === setKey(code.set))
  const cards = set ? await loadSetCards(set) : null
  return cards?.find((card) => numberKey(card.number) === numberKey(code.number)) ?? null
}

/**
 * Une carte de la collection est-elle celle-ci du catalogue ? Le même code (série et numéro) dans
 * sa référence, ou le même id Cardmarket.
 */
export function isCatalogCard(card: PokemonCard, listed: CatalogCard) {
  const code = referenceCode(card.reference)
  return (
    (code !== null && codeKey(code) === codeKey({ set: listed.set.id, number: listed.number })) ||
    (listed.cardmarket !== undefined && card.cardmarket === listed.cardmarket)
  )
}

/** Les raretés et les types choisis pour une grille de cartes ; aucun : tous. */
export interface CardFilter {
  rarities: number[]
  types: number[]
}

export const NO_FILTER: CardFilter = { rarities: [], types: [] }

/** La carte est d'une des raretés choisies et d'un des types choisis (aucun choisi : tous). */
export const passesFilter = (card: CatalogCard, { rarities, types }: CardFilter) =>
  (!rarities.length || (card.rarity !== null && rarities.includes(card.rarity.id))) &&
  (!types.length || (card.type !== null && types.includes(card.type)))

const found = new Map<string, Promise<CardImage | null>>()
const missing = new Set<string>()

/** `true` si l'image se charge ; `false` sans réponse en 10 s, ou si elle n'existe pas. */
const loads = (image: CardImage) =>
  new Promise<boolean>((resolve) => {
    const probe = new Image()
    const timer = setTimeout(() => {
      probe.onload = probe.onerror = null
      resolve(false)
    }, 10_000)
    probe.onload = () => {
      clearTimeout(timer)
      resolve(true)
    }
    probe.onerror = () => {
      clearTimeout(timer)
      resolve(false)
    }
    probe.src = image.small
  })

/**
 * L'image de la carte, si elle se charge (l'API des données la copie à la première demande) :
 * celle que le catalogue donne à cette référence, sinon celle que la référence désigne
 * (`cardImage`) ; `null` si la source ne l'a pas. La même promesse pour la
 * même référence (ce qu'attend `use`). `retry`, au moment d'enregistrer, redemande une image qui a
 * échoué : une panne passagère ne doit pas compter pour une image absente. Sans réponse en 10 s,
 * elle compte pour absente : l'enregistrement, qui l'attend, ne reste pas bloqué.
 */
export function findCardImage(reference: string, { retry = false } = {}) {
  let promise = found.get(reference)
  if (!promise || (retry && missing.has(reference))) {
    promise = settled(
      catalogCard(reference).then(async (listed) => {
        // Une carte du catalogue sans image : rien à chercher.
        const image = listed ? listed.image : cardImage(reference)
        if (image && (await loads(image))) {
          missing.delete(reference)
          return image
        }
        if (image) missing.add(reference)
        return null
      }),
    )
    found.set(reference, promise)
  }
  return promise
}
