/**
 * La migration, une fois, d'une collection vers le catalogue de TCGdex (novembre 2026 : l'ancienne
 * source du catalogue est abandonnée), sans réseau ni fichier : `scripts/migrer-tcgdex.ts` lit le
 * document et le catalogue, puis écrit ce qu'en fait `migrateCollection` et son bilan
 * (`migrationReport`). La forme du document ne change pas : les ids des cartes, leurs statuts,
 * leurs achats et les favorites restent.
 *
 * Une carte du catalogue d'avant (son image est un chemin du site, ou sa référence finit par un
 * code) est cherchée dans celui de TCGdex de sa langue : par sa série (sans casse ni tiret,
 * `setKey` : « SV2A » est « SV2a ») et son numéro (`numberKey`) ; sinon, par son id Cardmarket, s'il
 * n'est celui que d'une carte de la langue (les ids des séries françaises ont changé : « MEG »
 * n'existe plus). Retrouvée : le code de sa référence devient celui de TCGdex, son nom gardé
 * (« Bulbizarre (SV2a 001) ») ; son image, celle du catalogue (`null` sans), sauf une adresse
 * collée, gardée ; son id Cardmarket reste (ses prix continuent). Introuvable : rien ne change. Une
 * collection d'extension prend l'id et le nom de sa série chez TCGdex (par son id, sinon celle de
 * toutes ses cartes retrouvées), jamais celle d'une autre collection de la même langue.
 */

import { numberKey, referenceCode, setKey } from '@/lib/card-code'
import { catalogImage, isFoundImage } from '@/lib/card-images'
import { cardLanguage } from '@/lib/collection'
import { groupBy } from '@/lib/group-by'
import type {
  CardLanguage,
  CatalogSetRow,
  CollectionData,
  PokemonCard,
  SeriesCollection,
} from '@/types'

/** Une série du catalogue de TCGdex (`/api/catalog/sets`) et ses cartes (`/sets/<id>`). */
export interface TcgdexSet {
  id: string
  name: string
  cards: CatalogSetRow[]
}

/** Le catalogue de TCGdex de chaque langue de la collection. */
export type Catalogs = Partial<Record<CardLanguage, TcgdexSet[]>>

/** Une carte retrouvée chez TCGdex : sa série, sa ligne. */
interface Found {
  set: TcgdexSet
  row: CatalogSetRow
}

/** Ce que devient une carte du catalogue d'avant. */
export interface CardResult {
  card: PokemonCard
  language: CardLanguage
  /** La série de sa référence (« SV2A ») ; '' sans code. */
  from: string
  /** Sa carte chez TCGdex ; `null` : introuvable. */
  found: Found | null
  /** Retrouvée par son id Cardmarket, pas par son code. */
  byCardmarket: boolean
  /** Une adresse collée, gardée à la place de l'image du catalogue. */
  pasted: boolean
}

/** Ce que devient une collection d'extension. */
export interface SeriesResult {
  series: SeriesCollection
  /** Sa série chez TCGdex ; `null` : pas retrouvée. */
  to: TcgdexSet | null
  /** Migrée : faux sans série, ou si la sienne est déjà celle d'une autre collection. */
  migrated: boolean
}

/** De quoi retrouver une carte d'une langue : par série, par code, par id Cardmarket. */
function indexOf(sets: TcgdexSet[]) {
  const bySet = new Map<string, TcgdexSet>()
  const byCode = new Map<string, Found>()
  // `null` : plusieurs cartes ont cet id, il ne désigne aucune d'elles.
  const byCardmarket = new Map<number, Found | null>()
  for (const set of sets) {
    bySet.set(setKey(set.id), set)
    for (const row of set.cards) {
      byCode.set(`${setKey(set.id)} ${numberKey(row.number)}`, { set, row })
      if (row.cardmarket) {
        byCardmarket.set(row.cardmarket, byCardmarket.has(row.cardmarket) ? null : { set, row })
      }
    }
  }
  return { bySet, byCode, byCardmarket }
}

type Index = ReturnType<typeof indexOf>

/**
 * La référence avec ce code à la place du sien, son nom gardé : « Bulbizarre (SV2A 1) » →
 * « Bulbizarre (SV2a 001) » (le code tel que le lit `referenceCode`).
 */
const withCode = (reference: string, set: string, number: string) =>
  reference.replace(
    /[\w.-]+\s+[a-z]*\d+[a-z]*(\)?\s*)$/i,
    (_, end: string) => `${set} ${number}${end}`,
  )

/** Ce que devient une carte ; `null` si elle n'est pas du catalogue (ni code, ni image retrouvée). */
function migrateCard(card: PokemonCard, index: Index): CardResult | null {
  const code = referenceCode(card.reference)
  const pasted = card.image !== null && !isFoundImage(card.image)
  if (!code && (card.image === null || pasted)) return null
  const byCode = code && index.byCode.get(`${setKey(code.set)} ${numberKey(code.number)}`)
  const found =
    byCode || (card.cardmarket === undefined ? null : index.byCardmarket.get(card.cardmarket))
  const result = {
    language: cardLanguage(card),
    from: code?.set ?? '',
    found: found ?? null,
    byCardmarket: !byCode && !!found,
    pasted,
  }
  if (!found) return { ...result, card }
  return {
    ...result,
    card: {
      ...card,
      reference: code ? withCode(card.reference, found.set.id, found.row.number) : card.reference,
      image: pasted ? card.image : found.row.image ? catalogImage(found.row.image) : null,
    },
  }
}

/**
 * La collection migrée vers le catalogue de TCGdex (`catalogs` : celui de chaque langue qu'elle
 * a), et ce que devient chaque carte du catalogue d'avant et chaque collection d'extension. `data`
 * n'est pas modifiée.
 */
export function migrateCollection(data: CollectionData, catalogs: Catalogs) {
  const indexes = new Map<CardLanguage, Index>()
  const indexFor = (language: CardLanguage) => {
    if (!indexes.has(language)) indexes.set(language, indexOf(catalogs[language] ?? []))
    return indexes.get(language)!
  }
  const cards = new Map<string, CardResult>()
  for (const card of Object.values(data.customCards)) {
    const result = migrateCard(card, indexFor(cardLanguage(card)))
    if (result) cards.set(card.id, result)
  }
  const taken = new Set<string>()
  const series = data.series.map((one): SeriesResult => {
    const language = cardLanguage(one)
    const reached = new Set(one.cards.flatMap((id) => cards.get(id)?.found?.set ?? []))
    const to =
      indexFor(language).bySet.get(setKey(one.set)) ??
      (reached.size === 1 ? [...reached][0]! : null)
    if (!to || taken.has(`${language} ${to.id}`)) return { series: one, to, migrated: false }
    taken.add(`${language} ${to.id}`)
    return { series: one, to, migrated: true }
  })
  const collection: CollectionData = {
    ...data,
    customCards: Object.fromEntries(
      Object.entries(data.customCards).map(([id, card]) => [id, cards.get(id)?.card ?? card]),
    ),
    series: series.map(({ series: one, to, migrated }) =>
      migrated ? { ...one, set: to!.id, name: to!.name } : one,
    ),
  }
  return { collection, cards: [...cards.values()], series }
}

/** Avec image, sans image, introuvables : les trois nombres d'un groupe de cartes. */
function counts(results: CardResult[]) {
  const found = results.filter((result) => result.found)
  const withImage = found.filter((result) => result.found!.row.image).length
  return [withImage, found.length - withImage, results.length - found.length] as const
}

/** Le bilan de la migration (`migrateCollection`), en français, ligne à ligne. */
export function migrationReport(
  data: CollectionData,
  { cards, series }: ReturnType<typeof migrateCollection>,
) {
  const [withImage, withoutImage, missing] = counts(cards)
  const byCardmarket = cards.filter((result) => result.byCardmarket).length
  const pasted = cards.filter((result) => result.found && result.pasted).length
  const others = Object.keys(data.customCards).length - cards.length
  const lines = [
    'Migration vers le catalogue de TCGdex',
    `Cartes du catalogue : ${cards.length}`,
    `  retrouvées avec image : ${withImage}`,
    `  retrouvées sans image : ${withoutImage}`,
    `  introuvables, inchangées : ${missing}`,
    `  (retrouvées par leur id Cardmarket : ${byCardmarket} ; image collée gardée : ${pasted})`,
    `Autres cartes (ni code dans la référence, ni image du catalogue), inchangées : ${others}`,
    '',
    'Par série (langue, série d’avant → chez TCGdex : avec image, sans image, introuvables)',
  ]
  const groups = groupBy(
    cards,
    (result) => `${result.language} ${setKey(result.from) || '(sans code)'}`,
  )
  for (const [group, results] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const to = [...new Set(results.flatMap((result) => result.found?.set.id ?? []))]
    const [image, noImage, lost] = counts(results)
    lines.push(`  ${group} → ${to.join(', ') || '?'} : ${image}, ${noImage}, ${lost}`)
  }
  lines.push('', 'Collections d’extensions')
  for (const { series: one, to, migrated } of series) {
    const from = `${cardLanguage(one)} ${one.set}`
    lines.push(
      migrated
        ? `  ${from} → ${to!.id} (${to!.name})`
        : to
          ? `  ${from} : ${to.id} est déjà celle d’une autre collection, inchangée`
          : `  ${from} : pas retrouvée, inchangée`,
    )
  }
  const lost = cards.filter((result) => !result.found)
  if (lost.length) {
    lines.push('', 'Cartes introuvables')
    for (const { language, card } of lost)
      lines.push(`  ${language} ${card.reference} [${card.id}]`)
  }
  return lines.join('\n')
}
