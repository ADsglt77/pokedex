/**
 * Construit `src/data/card-index.json` : les pleines cartes Pokémon japonaises, avec leur classe,
 * leur image et leur identifiant Cardmarket.
 *
 *   bun run data:cards [--refresh]
 *
 * La liste vient du catalogue TCGplayer (`lib/tcgplayer.ts`) : toutes ses extensions, decks,
 * coffrets et promos depuis Noir et Blanc. Une carte est une pleine carte si, dans l'ordre :
 * 1. `FULL_ART_CLASSES` (`lib/rules.ts`) le dit, carte par carte ;
 * 2. sa rareté le dit : elle suit le code imprimé (SAR, AR, SR, HR, UR…) ;
 * 3. c'est un GX, un V, un VMAX ou un VSTAR, même ordinaire (`fullIllustrationClass`) ;
 * 4. sinon, son image le dit : pas de fenêtre d'illustration (`lib/fullArt.ts`), classe PR
 *    (« pleine carte hors rareté ») ; une rareté toujours à fenêtre, un EX ou un ex ordinaire
 *    (`REGULAR_FRAME`), une extension d'avant Noir et Blanc n'en sont jamais. Les cas douteux (score
 *    entre deux, EX ou ex secret) sont listés à revoir, pour les noter dans `FULL_ART_CLASSES`.
 * TCGdex (`lib/tcgdex.ts`) complète chaque carte qu'il a : nom japonais, illustrateur, image,
 * Pokémon et id Cardmarket.
 */

import { TOTAL_SPECIES } from '@/config/pokedex'
import { cardImage, tcgplayerImageBase } from '@/lib/images'
import { readFile } from 'node:fs/promises'
import type { CardIndexFile, CardIndexRow } from '@/types'
import { dataPath, writeDataFile } from './lib/dataFile'
import { FULL_ART, measureCards, trainDetector, UNSURE } from './lib/fullArt'
import { mapPool, urlExists } from './lib/net'
import {
  DEX_ID_CORRECTIONS,
  FULL_ART_CLASSES,
  FULL_ART_SINCE,
  fullIllustrationClass,
  isWindowedGold,
  REGULAR_FRAME,
  TCGPLAYER_SETS,
  WRONG_TCGDEX_IMAGES,
} from './lib/rules'
import { speciesInName } from './lib/species'
import {
  cardmarketId,
  type TcgdexCard,
  tcgdexCards,
  tcgdexImageBase,
  tcgdexSet,
  tcgdexSetIds,
} from './lib/tcgdex'
import {
  allGroups,
  type CatalogCard,
  catalogCards,
  catalogGroups,
  type Group,
  WINDOWED_RARITIES,
} from './lib/tcgplayer'

/** `017` et `17` désignent la même carte. */
const numberKey = (number: string) => (/^\d+$/.test(number) ? String(Number(number)) : number)

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Une carte du catalogue, avec son extension et sa carte chez TCGdex s'il l'a. */
interface Entry {
  setId: string
  group: Group
  card: CatalogCard
  known: TcgdexCard | undefined
  id: string
  /** Le nom anglais sans le numéro : « Pikachu V ». */
  name: string
}

interface Found {
  row: CardIndexRow
  card: CatalogCard
  known: TcgdexCard | undefined
}

console.log('Lecture de TCGdex et du catalogue TCGplayer…')
const tcgdex = new Map(
  (await tcgdexCards()).map((card) => [`${card.set.id}#${numberKey(card.localId)}`, card]),
)
const tcgdexSets = new Set(await tcgdexSetIds())

// 1. Le catalogue, groupe par groupe. Les extensions de TCGdex d'abord (celles qu'il a saisies en
// premier : son « SM1+ » vide double « SM1p »), puis `TCGPLAYER_SETS`, puis les groupes restants
// depuis Noir et Blanc (decks, coffrets…), sous leur abréviation. Un groupe ne sert qu'une fois.
const filled = new Set([...tcgdex.values()].map((card) => card.set.id))
const setIds = new Set([
  ...[...tcgdexSets].sort((a, b) => Number(filled.has(b)) - Number(filled.has(a))),
  ...Object.keys(TCGPLAYER_SETS),
])
const usedGroups = new Set<number>()
const published = new Map<string, string>()
const groupName = new Map<string, string>()
const entries: Entry[] = []
const absent: string[] = []

async function readGroup(setId: string, group: Group) {
  usedGroups.add(group.groupId)
  // Une extension répartie sur plusieurs groupes prend la date du premier.
  if (!published.has(setId)) published.set(setId, group.publishedOn.slice(0, 10))
  // « XYC: Super Legend Set » : le nom sans son abréviation.
  if (!groupName.has(setId)) groupName.set(setId, group.name.replace(/^\S+: /, ''))
  for (const card of await catalogCards(group)) {
    const known = tcgdex.get(`${setId}#${numberKey(card.number)}`)
    const name = card.name.replace(/ - .*$/, '').trim()
    entries.push({ setId, group, card, known, id: known?.id ?? `${setId}-${card.number}`, name })
  }
}

for (const setId of setIds) {
  const groups = await catalogGroups(setId)
  if (groups.length === 0 && filled.has(setId)) absent.push(setId)
  for (const group of groups) if (!usedGroups.has(group.groupId)) await readGroup(setId, group)
}
// Les vieilles extensions (1996-2009) n'ont ni groupe TCGplayer ni pleine carte.
console.log(`  ${absent.length} extensions de TCGdex absentes de TCGplayer : ${absent.join(', ')}`)

// Les groupes restants : leur abréviation, si elle est unique et libre ; sinon `G` et leur numéro.
const groups = await allGroups()
const taken = new Set([...setIds].map((id) => id.toLowerCase()))
const abbreviations = groups.map((group) => group.abbreviation?.toLowerCase())
for (const group of groups) {
  if (usedGroups.has(group.groupId) || group.publishedOn < FULL_ART_SINCE) continue
  const abbreviation = group.abbreviation?.toLowerCase()
  const unique =
    abbreviation &&
    abbreviations.filter((a) => a === abbreviation).length === 1 &&
    !taken.has(abbreviation)
  const setId = unique ? group.abbreviation! : `G${group.groupId}`
  taken.add(setId.toLowerCase())
  await readGroup(setId, group)
}
console.log(`  ${entries.length} cartes au catalogue, dans ${usedGroups.size} groupes`)

// 2. La classe de chaque carte : `null` si ce n'en est pas une pleine, `'image'` si son image en
// décide, `'review'` si seul un œil peut trancher (un EX ou un ex secret sans rareté qui le dise).
const isPromo = ({ setId, group }: Entry) => /-P$/.test(setId) || /promo/i.test(group.name)
const ORDINARY = new Set(['Common', 'Uncommon', 'Rare'])

function classOf(entry: Entry): string | null | 'image' | 'review' {
  const { id, setId, group, card, known, name } = entry
  if (id in FULL_ART_CLASSES) return FULL_ART_CLASSES[id]!
  if (!(known || card.isPokemon)) return null
  if (card.code) return isWindowedGold(setId, card.code) ? null : card.code
  const family = fullIllustrationClass(name)
  if (family) return family
  if (WINDOWED_RARITIES.has(card.rarity) || group.publishedOn < FULL_ART_SINCE) return null
  // Une carte secrète est souvent la version pleine carte d'un deck : à l'œil de trancher.
  if (REGULAR_FRAME.test(name)) return card.secret ? 'review' : null
  return 'image'
}
const classes = new Map(entries.map((entry) => [entry, classOf(entry)]))

// 3. L'image, pour les cartes que rien d'autre ne départage. Le détecteur apprend sur les cartes
// que leur rareté classe : pleines (SAR, AR, SR…) contre Pokémon ordinaires (Common, Uncommon, Rare),
// sauf celles que `FULL_ART_CLASSES` corrige (les traits antiques sont des « Common » pleins).
const judged = entries.filter((entry) => {
  const rarity = classes.get(entry)
  return rarity === 'image' || rarity === 'review'
})
const samples = entries.filter(
  (entry) =>
    !isPromo(entry) &&
    entry.group.publishedOn >= FULL_ART_SINCE &&
    entry.card.isPokemon &&
    (entry.card.code
      ? classes.get(entry) === entry.card.code
      : ORDINARY.has(entry.card.rarity) && classes.get(entry) === 'image') &&
    !fullIllustrationClass(entry.name) &&
    !REGULAR_FRAME.test(entry.name),
)
const measures = await measureCards([...judged, ...samples].map((entry) => entry.card.productId))
const labelled = samples.flatMap((entry) => {
  const m = measures.get(entry.card.productId)
  return m ? [{ measures: m, full: entry.card.code !== null }] : []
})
const detector = trainDetector(labelled)
console.log(
  `  détecteur d'image : ${(detector.agreement * 100).toFixed(1)} % d'accord avec la rareté (${labelled.length} cartes)`,
)
const toReview: { entry: Entry; score: number }[] = []
for (const entry of judged) {
  const m = measures.get(entry.card.productId)
  const score = m ? detector.score(m) : 0
  if (classes.get(entry) === 'review') {
    classes.set(entry, null)
    toReview.push({ entry, score })
  } else {
    classes.set(entry, score >= FULL_ART ? 'PR' : null)
    if (score >= UNSURE && score < FULL_ART) toReview.push({ entry, score })
  }
}

/** Une pleine carte du catalogue → une ligne de l'index ; `null` sans Pokémon reconnu. */
function toRow(entry: Entry, rarity: string): Found | null {
  const { id, setId, card, known } = entry
  // Les Pokémon : ceux de TCGdex, sinon ceux lus dans son nom japonais (ou, pour une carte qu'il
  // n'a pas, dans le nom anglais de TCGplayer).
  const dexIds =
    DEX_ID_CORRECTIONS[id] ??
    (known?.dexId?.length
      ? known.dexId
      : speciesInName(known?.name ?? card.name, known?.name ? 'ja' : 'en'))
  const row: CardIndexRow = {
    id,
    set: setId,
    number: known?.localId ?? card.number,
    name: known?.name?.trim() || null,
    rarity,
    illustrator: known?.illustrator?.trim() || null,
    image: known?.image ?? null,
    dexIds: [...new Set(dexIds)].filter((dexId) => dexId >= 1 && dexId <= TOTAL_SPECIES),
  }
  return row.dexIds.length ? { row, card, known } : null
}

const found = entries.flatMap((entry) => {
  const rarity = classes.get(entry)
  const row = rarity ? toRow(entry, rarity) : null
  return row ? [row] : []
})
const rows = found.map(({ row }) => row)
const byClass = new Map<string, number>()
for (const row of rows) byClass.set(row.rarity, (byClass.get(row.rarity) ?? 0) + 1)
console.log(
  `  ${rows.length} pleines cartes, dont ${found.filter((f) => f.known).length} chez TCGdex : ${[...byClass].map(([code, n]) => `${code} ${n}`).join(', ')}`,
)
if (toReview.length) {
  console.log(`  ${toReview.length} cartes à revoir à l'œil (à noter dans FULL_ART_CLASSES) :`)
  for (const { entry, score } of toReview.sort((a, b) => b.score - a.score)) {
    console.log(
      `    ${entry.id.padEnd(14)} ${score.toFixed(2)}  ${entry.card.name} (${entry.group.name}) https://www.tcgplayer.com/product/${entry.card.productId}`,
    )
  }
}

// 4. Les extensions : nom et date chez TCGdex, sinon dans `TCGPLAYER_SETS` et chez TCGplayer.
const usedSetIds = [...new Set(rows.map((row) => row.set))]
const sets = new Map(
  await mapPool(usedSetIds, 6, async (id) => {
    const set = tcgdexSets.has(id) ? await tcgdexSet(id) : null
    const info = {
      name: TCGPLAYER_SETS[id]?.name ?? set?.name ?? groupName.get(id)!,
      releaseDate: set?.releaseDate ?? published.get(id)!,
      serie: set?.serie.id,
    }
    return [id, info] as const
  }),
)

// 5. Les images : celle de TCGdex ; sinon celle qu'il range sans la citer, à l'adresse habituelle ;
// sinon celle de TCGplayer, s'il en a une (sans image, l'app montre une carte de substitution).
await mapPool(found, 16, async ({ row, card, known }) => {
  if (row.image) return
  if (known && !WRONG_TCGDEX_IMAGES.has(row.set) && !WRONG_TCGDEX_IMAGES.has(row.id)) {
    const base = tcgdexImageBase(sets.get(row.set)!.serie!, row.set, row.number)
    if (await urlExists(`${base}/low.webp`, 'assets')) return void (row.image = base)
  }
  const base = tcgplayerImageBase(card.productId)
  if (await urlExists(cardImage(base)!.large, 'tcgplayer-images')) row.image = base
})
console.log(`  ${rows.filter((row) => !row.image).length} cartes sans image`)

// 6. L'identifiant Cardmarket, pour les prix (`scripts/prices.ts`) : seul TCGdex le donne.
await mapPool(found, 8, async ({ row, known }) => {
  if (known) row.cardmarket = await cardmarketId(row.id)
})
console.log(`  ${rows.filter((row) => row.cardmarket).length} cartes reliées à Cardmarket`)

// L'extension la plus ancienne d'abord, puis l'extension, le numéro et l'id.
rows.sort(
  (a, b) =>
    compareText(sets.get(a.set)!.releaseDate, sets.get(b.set)!.releaseDate) ||
    compareText(a.set, b.set) ||
    a.number.localeCompare(b.number, 'en', { numeric: true }) ||
    compareText(a.id, b.id),
)

// Une carte qui quitte l'index emporte ce que l'utilisateur en avait noté (statut, achat) : on le dit.
const previous = await readFile(dataPath('card-index.json'), 'utf8')
  .then((text) => (JSON.parse(text) as CardIndexFile).cards.map((row) => row.id))
  .catch(() => [])
const kept = new Set(rows.map((row) => row.id))
const gone = previous.filter((id) => !kept.has(id))
if (gone.length) console.warn(`  ${gone.length} cartes quittent l'index : ${gone.join(', ')}`)

await writeDataFile('card-index.json', (generatedAt) => ({
  generatedAt,
  sets: Object.fromEntries(
    usedSetIds.map((id) => {
      const { name, releaseDate } = sets.get(id)!
      return [id, { name, releaseDate }]
    }),
  ),
  cards: rows,
}))
