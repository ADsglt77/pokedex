/**
 * Le catalogue des cartes japonaises et françaises, que l'API des données construit d'après
 * Pokécardex ; les mêmes réponses dans les deux langues, aux mêmes adresses pour le japonais, sous
 * `/api/catalog/fr/…` pour le français :
 * - `/api/catalog/species/<n°>` : les cartes d'un Pokémon, des plus récentes aux plus anciennes,
 *   avec leur rareté, leur type et leurs séries (nom, date de sortie, logo) ; chargées par la
 *   fenêtre d'ajout, et préparées d'avance par la fiche d'un Pokémon sans carte (quand le
 *   navigateur est libre) ;
 * - `/api/catalog/sets` et `/api/catalog/sets/<code>` : les séries, puis toutes les cartes d'une
 *   série, dresseurs et énergies compris, avec tout ce qu'on en sait (la page Catalogue) ; elles
 *   donnent aussi l'image exacte d'une carte (`findCardImage`).
 * Une carte du catalogue devient une carte de la collection (`cardFromCatalog`), ou une case d'une
 * collection d'extension (`seriesSlot`). Aucun tri ni détection : l'utilisateur choisit, l'app ne
 * propose rien seule.
 */

import { CARD_TYPES } from '@/config/catalog'
import { derived } from '@/lib/api'
import { isCardOf, numberKey, referenceCode, setKey } from '@/lib/card-code'
import { cardImage, catalogImage } from '@/lib/card-images'
import { newCardId } from '@/lib/collection'
import { settled } from '@/lib/settled'
import { getSpecies } from '@/lib/species'
import type {
  CardImage,
  CardLanguage,
  CatalogFile,
  CatalogSetFile,
  CatalogSetsFile,
  CollectionData,
  PokemonCard,
} from '@/types'

/** Le début des adresses du catalogue d'une langue. */
const catalogPath = (lang: CardLanguage) => (lang === 'fr' ? '/api/catalog/fr' : '/api/catalog')

/**
 * Le délai d'une lecture du catalogue (ms) : sans réponse, elle compte comme une panne passagère
 * (`getJson`). « Enregistrer » une carte (son image, `findCardImage`) et « Commencer la
 * collection » l'attendent : ils ne restent jamais bloqués (sans lui, jusqu'à la minute de nginx,
 * et sans limite avec Vite).
 */
const CATALOG_TIMEOUT = 15_000

/** Une série du catalogue. */
export interface CatalogSet {
  /** Sa langue : celle de ses cartes. */
  language: CardLanguage
  /** Son code chez Pokécardex : « SV2A » (le même code peut exister dans les deux langues). */
  id: string
  /** Son nom : « Pokémon Card 151 ». */
  name: string
  /** Son année de sortie ; `null` si Pokécardex ne la donne pas. */
  year: string | null
  /** Son logo est chez nous (`setLogo`), ou pas encore cherché ; faux si aucun. */
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
  /** « SV2A 166 » : la série et le numéro, uniques ; « fr MEG 001 » pour une carte française. */
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

/**
 * « SV2A 166 », « MEG 001 » : la série et le numéro, ce qu'on montre pour nommer une carte, dans les
 * deux langues. Jamais sa `key` : « fr MEG 001 » ne sert qu'à la retrouver.
 */
export const cardCode = (card: CatalogCard) => `${card.set.id} ${card.number}`

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
    key: `${set.language === 'fr' ? 'fr ' : ''}${set.id} ${number}`,
    number,
    set,
    dexIds,
    cardmarket: row.cardmarket || undefined,
    reference: `${name} (${set.id} ${number})`,
    image: row.image ? catalogImage(set.language, set.id, row.image) : null,
    rarity,
    type: CARD_TYPES.has(type) ? type : null,
  }
}

/** Les cartes d'un Pokémon, d'après sa réponse (`/api/catalog/species/<n°>`). */
function readSpeciesCards(file: CatalogFile, speciesId: number, lang: CardLanguage): CatalogCard[] {
  const sets = new Map(
    Object.entries(file.sets).map(([id, [name, released, logo]]) => [
      id,
      { language: lang, id, name, year: released.slice(0, 4) || null, logo: logo === 1 },
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

/**
 * Les cartes d'un Pokémon dans cette langue, des plus récentes aux plus anciennes ; `null` si le
 * catalogue n'est pas disponible (serveur arrêté, base encore vide : redemandé une minute après au
 * plus tôt, `getJson`). Toujours la même promesse pour un Pokémon et une langue, lue par `use()`.
 */
export const loadSpeciesCards = (speciesId: number, lang: CardLanguage) =>
  derived<CatalogFile, CatalogCard[] | null>(
    `${catalogPath(lang)}/species/${speciesId}`,
    (file) => file && readSpeciesCards(file, speciesId, lang),
    CATALOG_TIMEOUT,
  )

/** Une série de la page Catalogue (`/api/catalog/sets`) : ce que disent sa tuile et son en-tête. */
export interface SetSummary extends CatalogSet {
  /** Sa sortie, au Japon ou en France selon sa langue (YYYY-MM-DD) ; `null` si inconnue. */
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

/** L'adresse des séries du catalogue d'une langue (oubliée pour « Réessayer », `CatalogPage`). */
export const catalogSetsUrl = (lang: CardLanguage) => `${catalogPath(lang)}/sets`

/** Les séries de la page Catalogue, dans cette langue ; `null` si elles ne sont pas disponibles. */
export const loadSets = (lang: CardLanguage) =>
  derived<CatalogSetsFile, CatalogSets | null>(
    catalogSetsUrl(lang),
    (file) =>
      file && {
        blocks: file.blocks,
        sets: file.sets.map(([id, name, released, logo, count, block, deck]) => ({
          language: lang,
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
    CATALOG_TIMEOUT,
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

/** L'adresse des cartes d'une série (oubliée pour « Réessayer », `CatalogPage`). */
export const setCardsUrl = (set: SetSummary) =>
  `${catalogPath(set.language)}/sets/${encodeURIComponent(set.id)}`

/**
 * Toutes les cartes d'une série, dans son ordre ; `null` si elles ne sont pas disponibles. Chaque
 * série est lue une fois : la même promesse, lue par `use()`.
 */
export const loadSetCards = (set: SetSummary) =>
  derived<CatalogSetFile, SetCard[] | null>(
    setCardsUrl(set),
    (file) => file && readSet(set, file),
    CATALOG_TIMEOUT,
  )

/**
 * La carte du catalogue d'une référence (« Herbizarre (OR1 2) ») dans cette langue, lue dans sa
 * série ; `null` si le catalogue ne l'a pas (ou n'est pas disponible).
 */
async function catalogCard(reference: string, lang: CardLanguage): Promise<SetCard | null> {
  const code = referenceCode(reference)
  if (!code) return null
  const set = (await loadSets(lang))?.sets.find((known) => setKey(known.id) === setKey(code.set))
  const cards = set ? await loadSetCards(set) : null
  return cards?.find((card) => numberKey(card.number) === numberKey(code.number)) ?? null
}

/**
 * Une carte de la collection est-elle celle-ci du catalogue ? De la même langue, avec le même code
 * (série et numéro) dans sa référence, ou le même id Cardmarket.
 */
export const isCatalogCard = (card: PokemonCard, listed: CatalogCard) =>
  isCardOf(
    card,
    listed.set.language,
    { set: listed.set.id, number: listed.number },
    listed.cardmarket,
  )

/**
 * La case pas encore obtenue d'une collection d'extension (`seriesOnly`) qui est cette carte du
 * catalogue (`isCatalogCard`) ; `null` sans. Elle n'est pas encore une carte de ses Pokémon : leurs
 * cartes ne la montrent pas, mais une carte n'existe qu'une fois, l'ajouter la reprend (`adopt`).
 */
export const unobtainedSlot = (data: CollectionData, listed: CatalogCard) =>
  Object.values(data.customCards).find((card) => card.seriesOnly && isCatalogCard(card, listed)) ??
  null

/**
 * La langue d'une carte du catalogue, telle que la porte une carte de la collection
 * (`PokemonCard.language`) : `'fr'` pour une carte française, rien pour une japonaise.
 */
export const languageField = (card: CatalogCard): Pick<PokemonCard, 'language'> =>
  card.set.language === 'fr' ? { language: 'fr' } : {}

/**
 * Une nouvelle carte de la collection, celle-ci du catalogue : ses Pokémon, sa référence, son
 * image, son id Cardmarket et sa langue (« Ajouter à la collection » du Catalogue).
 */
export const cardFromCatalog = (card: CatalogCard): PokemonCard => ({
  id: newCardId(),
  dexIds: card.dexIds,
  reference: card.reference,
  image: card.image,
  ...(card.cardmarket !== undefined && { cardmarket: card.cardmarket }),
  ...languageField(card),
})

/**
 * Une case de la collection d'une extension : la carte du catalogue, pas encore obtenue
 * (`seriesOnly`). Une carte déjà dans le compte la remplace (`startSeries`, `lib/series.ts`).
 */
export const seriesSlot = (card: CatalogCard): PokemonCard => ({
  ...cardFromCatalog(card),
  seriesOnly: true,
})

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
 * L'image de la carte dans cette langue : celle que le catalogue donne à cette référence, telle
 * quelle, comme l'ajoute la page Catalogue (son chemin, série et rang, ne change pas d'ordinaire
 * d'image ; pas encore copiée par l'API des données, elle s'affiche dès qu'elle l'est). Une série
 * renumérotée par la source en change : la carte enregistrée garde son chemin, le rang d'avant, et
 * montre le scan de sa nouvelle occupante jusqu'à ce que son image soit choisie de nouveau
 * (`docs/cartes.md`). Hors du catalogue, celle que la référence désigne (`cardImage`), si elle se
 * charge (un chemin déduit peut ne mener à rien) ; `null` sans image. La même promesse pour la même
 * langue et la même référence (ce qu'attend `use`). `retry`, au moment d'enregistrer, redemande une
 * image qui a échoué : une panne passagère ne doit pas compter pour une image absente. Sans réponse
 * du catalogue en 15 s (`CATALOG_TIMEOUT`, ses séries puis celle de la carte), ou de l'image en
 * 10 s, elle compte pour absente : l'enregistrement, qui l'attend, ne reste pas bloqué.
 */
export function findCardImage(
  reference: string,
  { lang, retry = false }: { lang: CardLanguage; retry?: boolean },
) {
  const key = `${lang} ${reference}`
  let promise = found.get(key)
  if (!promise || (retry && missing.has(key))) {
    promise = settled(
      catalogCard(reference, lang).then(async (listed) => {
        // Une carte du catalogue : son image, sans la charger (aucune : rien à chercher).
        if (listed) return listed.image
        const image = cardImage(reference, lang)
        if (image && (await loads(image))) {
          missing.delete(key)
          return image
        }
        if (image) missing.add(key)
        return null
      }),
    )
    found.set(key, promise)
  }
  return promise
}
