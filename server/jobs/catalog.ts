/**
 * Tâche `catalog` : le catalogue des cartes Pokémon japonaises, d'après TCGdex, une fois par jour.
 * Pour chaque carte : son extension, son numéro, son id Cardmarket (pour le prix ; 0 si TCGdex ne le
 * connaît pas, ou s'il est douteux : partagé par plusieurs cartes, ou d'un autre Pokémon dans la
 * liste des produits de Cardmarket), son suffixe (ex, V, GX…), son produit TCGplayer (son image
 * quand Pokécardex n'a pas la sienne, son prix quand Cardmarket n'en a pas : `lib/tcgplayer.ts` ;
 * 0 : aucun) et ses Pokémon ; et chaque extension, avec son nom japonais, sa date de sortie et les
 * groupes TCGplayer de ses cartes. Aucun tri par rareté ni détection des pleines cartes : toutes les
 * cartes Pokémon. En fin de tâche, la réponse de `/api/catalog` est recalculée (`snapshots`).
 *
 * La liste est relue à chaque passage ; l'id Cardmarket, donné carte par carte, est gardé en cache
 * (le premier passage prend un quart d'heure), redemandé chaque semaine pour les cartes sorties dans
 * l'année qui n'en ont pas encore. Une liste soudain plus courte (panne de TCGdex) est refusée :
 * le catalogue d'avant reste.
 */

import type { Database } from 'bun:sqlite'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { speciesInName } from '@/lib/filters'
import type { CatalogFile, CatalogImage, CatalogRow, PokemonSpecies } from '@/types'
import { readSource, writeSource } from '../db'
import { fetchJson, mapPool } from '../lib/net'
import { tcgplayerCatalog } from '../lib/tcgplayer'
import { saveSnapshot } from '../snapshots'
import { loadSpecies, readSpecies } from './species'

const GRAPHQL = 'https://api.tcgdex.net/v2/graphql'
const REST = 'https://api.tcgdex.net/v2/ja'
const PAGE_SIZE = 5000
/** La liste publique des cartes de Cardmarket : leur nom anglais, pour vérifier l'id de TCGdex. */
const CARDMARKET_PRODUCTS =
  'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json'
const DAY = 86_400_000

interface RawCard {
  id: string
  localId: string
  name: string
  dexId: (number | null)[] | null
  set: { id: string }
}

/** Une requête GraphQL, toujours relue. Une réponse sans données arrête la tâche. */
async function graphql<T>(query: string): Promise<T> {
  const { data, errors } = await fetchJson<{ data?: T; errors?: { message: string }[] }>(
    GRAPHQL,
    'tcgdex',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
    0,
  )
  if (!data) throw new Error(`TCGdex ne répond pas : ${errors?.[0]?.message ?? 'réponse vide'}`)
  if (errors?.length) {
    console.warn(`  TCGdex signale ${errors.length} erreurs (${errors[0]!.message})`)
  }
  return data
}

/** Le suffixe imprimé après le nom japonais : « ピカチュウex » → ex. */
const SUFFIX = /(VSTAR|VMAX|V-UNION|V|GX|EX|Ex|ex|BREAK)$/

// Les Pokémon par leur nom japonais : « リーフィア » → 470.
const byJapaneseName = (species: readonly PokemonSpecies[]) =>
  new Map(species.flatMap(({ id, names }) => (names.ja ? [[names.ja, id] as const] : [])))

/**
 * Les Pokémon d'une carte : ceux de TCGdex ; sinon (il n'en donne pas pour certaines cartes, dont
 * des ex récentes), celui dont le nom japonais est exactement celui de la carte, une fois ôtés son
 * suffixe et « (Pokémon δ) ». Si besoin : son premier ou son dernier mot (« オーガポン みどりの
 * めん » : Ogerpon et son masque ; « ヒスイ バクフーン » : Typhlosion de Hisui), sans « メガ »,
 * « かがやく », « ブラック » ni « ホワイト » devant (Méga, Radieux, Kyurem Noir ou Blanc), ou ce qui
 * suit « の » (« ヒビキのホウオウ » : le Ho-Oh d'Ethan). « リーフィアex » → Phyllali. Une
 * correspondance de noms, pas une détection : un nom qui ne correspond pas laisse la carte de côté.
 */
function speciesOf(card: RawCard, byName: ReadonlyMap<string, number>): number[] {
  const known = [...new Set(card.dexId ?? [])].filter(
    (id): id is number => id !== null && Number.isInteger(id) && id >= 1 && id <= TOTAL_SPECIES,
  )
  if (known.length) return known
  const name = card.name
    .replace(/（デルタ種）$/, '')
    .replace(SUFFIX, '')
    .trim()
  const candidates = [
    name,
    name.split(' ')[0]!,
    name.split(' ').at(-1)!,
    name.replace(/^(メガ|かがやく|ブラック|ホワイト)/, ''),
    name.split('の').at(-1)!,
  ]
  const named = candidates.map((candidate) => byName.get(candidate)).find(Boolean)
  return named ? [named] : []
}

/** Les extensions et les cartes en base, sous la forme que lit l'app (`CatalogFile`). */
export function catalogSnapshot(db: Database): CatalogFile {
  const sets = db
    .query('SELECT id, name, released, tcgplayer_groups AS groups FROM sets')
    .all() as { id: string; name: string; released: string; groups: string }[]
  const released = new Map(sets.map((set) => [set.id, set.released]))
  const cards = db
    .query(
      `SELECT key, set_id AS 'set', number, suffix, cardmarket, tcgplayer, image,
              (SELECT json_group_array(dex_id) FROM
                 (SELECT dex_id FROM card_species WHERE card = key ORDER BY rank)) AS dexIds
       FROM cards`,
    )
    .all() as {
    set: string
    number: string
    suffix: string
    cardmarket: number
    tcgplayer: number
    image: 'pokecardex' | 'tcgplayer' | 'none' | null
    dexIds: string
  }[]

  // Des plus récentes aux plus anciennes ; dans une extension, du plus grand numéro au plus petit.
  cards.sort(
    (a, b) =>
      released.get(b.set)!.localeCompare(released.get(a.set)!) ||
      b.set.localeCompare(a.set) ||
      b.number.localeCompare(a.number, 'en', { numeric: true }),
  )
  // Des clés numériques : l'objet les garde dans l'ordre des numéros du Pokédex.
  const bySpecies: CatalogFile['cards'] = {}
  for (const { set, number, suffix, cardmarket, tcgplayer, image, dexIds: list } of cards) {
    const dexIds = JSON.parse(list) as number[]
    // Une image pas encore cherchée : celle de Pokécardex, qui a presque toutes les autres (le
    // serveur la copie à la demande ; sans elle, la carte de substitution).
    const picture: CatalogImage =
      image === 'tcgplayer' ? { tcgplayer } : image === 'none' ? null : 'pokecardex'
    const row: CatalogRow = [set, number, cardmarket, suffix, picture]
    if (dexIds.length > 1) row.push(dexIds)
    for (const dexId of dexIds) (bySpecies[dexId] ??= []).push(row)
  }

  return {
    // Des plus récentes aux plus anciennes ; sorties le même jour, dans l'ordre de leur code.
    sets: Object.fromEntries(
      sets
        .sort((a, b) => b.released.localeCompare(a.released) || a.id.localeCompare(b.id))
        .map(({ id, name, released: date, groups }) => {
          const ids = JSON.parse(groups) as number[]
          return [id, ids.length ? [name, date, ids] : [name, date]]
        }),
    ),
    cards: bySpecies,
  }
}

export async function catalog(db: Database) {
  // Les espèces en base (tâche `species`, passée avant) : le Pokémon des cartes vient de leur nom.
  if (!loadSpecies(db)) throw new Error('Pas encore d’espèces en base : la tâche species d’abord')
  const byName = byJapaneseName(readSpecies(db))
  console.log('Cartes Pokémon japonaises de TCGdex…')
  const cards: RawCard[] = []
  // Jusqu'à une page vide : une page plus courte que demandé ne dit pas que c'est la dernière.
  for (let page = 1; ; page++) {
    const { cards: chunk } = await graphql<{ cards: RawCard[] }>(
      `query { cards(filters: {category: "Pokemon"}, pagination: {page: ${page}, itemsPerPage: ${PAGE_SIZE}}) @locale(lang: "ja") { id localId name dexId set { id } } }`,
    )
    if (chunk.length === 0) break
    cards.push(...chunk)
  }
  const { sets } = await graphql<{
    sets: { id: string; name: string; releaseDate: string | null }[]
  }>(`
    query {
      sets @locale(lang: "ja") {
        id
        name
        releaseDate
      }
    }
  `)
  const released = new Map(sets.map((set) => [set.id, set.releaseDate ?? '']))

  const pokemon = cards.flatMap((card) => {
    const dexIds = speciesOf(card, byName)
    return dexIds.length ? [{ card, dexIds }] : []
  })
  const recognized = new Set(pokemon.map(({ card }) => card))
  const unnamed = cards.filter((card) => !recognized.has(card))
  console.log(
    `  ${pokemon.length} cartes ; ${unnamed.length} sans Pokémon reconnu, laissées de côté`,
  )
  if (unnamed.length) {
    console.log(
      `    (${unnamed
        .slice(0, 8)
        .map((card) => card.name)
        .join(', ')}…)`,
    )
  }
  // Une liste soudain plus courte (panne d'une source) est refusée : le catalogue d'avant reste.
  const known = (source: string) =>
    (
      db.query('SELECT COUNT(*) AS count FROM cards WHERE source = ?').get(source) as {
        count: number
      }
    ).count
  if (pokemon.length < known('tcgdex') * 0.95) {
    throw new Error(
      `TCGdex ne donne plus que ${pokemon.length} cartes (${known('tcgdex')} en base)`,
    )
  }

  // L'id Cardmarket n'est donné que carte par carte. Une carte que TCGdex ne sert pas (erreur
  // répétée) reste sans id : elle n'arrête pas le reste. Sans id, une carte de l'année est
  // redemandée chaque semaine : TCGdex le relie parfois après la sortie.
  console.log('  id Cardmarket, une carte à la fois (cache ensuite)…')
  const yearAgo = new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10)
  let done = 0
  let failed = 0
  const ids = await mapPool(pokemon, 4, async ({ card }) => {
    type Detail = { pricing?: { cardmarket?: { idProduct?: number } } }
    const url = `${REST}/cards/${encodeURIComponent(card.id)}`
    try {
      let detail = await fetchJson<Detail>(url, 'tcgdex')
      if (!detail.pricing?.cardmarket?.idProduct && released.get(card.set.id)! >= yearAgo) {
        detail = await fetchJson<Detail>(url, 'tcgdex', undefined, 7 * DAY)
      }
      return detail.pricing?.cardmarket?.idProduct ?? 0
    } catch {
      failed++
      return 0
    } finally {
      if (++done % 1000 === 0) console.log(`  ${done} / ${pokemon.length}`)
    }
  })
  const withId = ids.filter(Boolean).length
  console.log(`  ${withId} avec un id Cardmarket${failed ? `, ${failed} illisibles` : ''}`)

  // Les id de TCGdex ne sont pas tous justes : celui que plusieurs cartes se partagent, ou que la
  // liste des produits de Cardmarket donne à un autre Pokémon (« Slurpuff [Draining Kiss | Magical
  // Shot] » pour une carte de Sucroquin), est retiré : pas de prix plutôt que celui d'une autre
  // carte. Un nom où aucun Pokémon n'est reconnu, ou un id absent de la liste, est gardé.
  const { products: listed } = await fetchJson<{
    products: { idProduct: number; name: string }[]
  }>(CARDMARKET_PRODUCTS, 'cardmarket', undefined, DAY)
  const cardmarketNames = new Map(listed.map(({ idProduct, name }) => [idProduct, name]))
  const sharing = new Map<number, number>()
  for (const id of ids) sharing.set(id, (sharing.get(id) ?? 0) + 1)
  const shared: string[] = []
  const otherPokemon: string[] = []
  for (const [index, { card, dexIds }] of pokemon.entries()) {
    const id = ids[index]!
    // Le nom du produit, sans ses attaques entre crochets : « Slurpuff ».
    const name = cardmarketNames.get(id)?.replace(/\s*\[.*$/, '')
    const named = name === undefined ? null : speciesInName(name)
    const code = `${card.set.id} ${card.localId}`
    if (!id) continue
    if (sharing.get(id)! > 1) shared.push(code)
    else if (named !== null && !dexIds.includes(named)) otherPokemon.push(`${code} : ${name}`)
    else continue
    ids[index] = 0
  }
  console.log(
    `  ${shared.length + otherPokemon.length} id retirés : ${shared.length} partagés par plusieurs cartes (${shared.slice(0, 5).join(', ')}…), ${otherPokemon.length} d’un autre Pokémon chez Cardmarket (${otherPokemon.slice(0, 5).join(', ')}…)`,
  )

  // Le produit TCGplayer de chaque carte (son image, quand Pokécardex n'a pas la sienne, et son
  // prix, quand Cardmarket n'en a pas), et les cartes de TCGplayer que TCGdex n'a pas.
  console.log('  catalogue TCGplayer…')
  const { products, extras, skipped } = await tcgplayerCatalog(
    pokemon.map(({ card, dexIds }) => ({ setId: card.set.id, number: card.localId, dexIds })),
    released,
  )
  console.log(
    `  ${products.filter(Boolean).length} reliées à un produit TCGplayer ; ${extras.length} cartes que TCGdex n’a pas, ajoutées (écartées : ${skipped.known} qu’il a déjà, ${skipped.unnumbered} sans numéro, ${skipped.ambiguous} sous un numéro partagé, ${skipped.unnamed} sans Pokémon reconnu)`,
  )
  if (extras.length < known('tcgplayer') * 0.95) {
    throw new Error(`TCGplayer ne donne plus que ${extras.length} cartes (${known('tcgplayer')})`)
  }

  // Les groupes TCGplayer des cartes de chaque extension, et les extensions que TCGdex n'a pas.
  const groups = new Map<string, Set<number>>()
  const addGroup = (setId: string, groupId: number) =>
    groups.set(setId, (groups.get(setId) ?? new Set()).add(groupId))
  for (const [index, { card }] of pokemon.entries()) {
    const product = products[index]
    if (product) addGroup(card.set.id, product.groupId)
  }
  for (const extra of extras) addGroup(extra.setId, extra.groupId)
  // Une extension sans carte de TCGdex : son nom et sa date chez TCGdex s'il la connaît, sinon chez
  // TCGplayer.
  const used = new Set(pokemon.map(({ card }) => card.set.id))
  const tcgdexSets = new Map(sets.map((set) => [set.id, set]))
  const extraSets = new Map(
    extras
      .filter((extra) => !used.has(extra.setId))
      .map(({ setId, setName, released: date }) => {
        const known = tcgdexSets.get(setId)
        return [
          setId,
          known ? { name: known.name, date: known.releaseDate ?? date } : { name: setName, date },
        ]
      }),
  )

  // En base : les cartes et extensions de ce passage remplacent celles d'avant.
  const seen = new Date().toISOString()
  const writeSet = db.query(
    `INSERT INTO sets (id, name, released, tcgplayer_groups) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, released = excluded.released,
       tcgplayer_groups = excluded.tcgplayer_groups`,
  )
  const writeCard = db.query(
    `INSERT INTO cards (key, set_id, number, suffix, cardmarket, tcgplayer, source, seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET set_id = excluded.set_id, number = excluded.number,
       suffix = excluded.suffix, cardmarket = excluded.cardmarket, tcgplayer = excluded.tcgplayer,
       source = excluded.source, seen = excluded.seen`,
  )
  const clearSpecies = db.query('DELETE FROM card_species WHERE card = ?')
  const writeSpecies = db.query('INSERT INTO card_species (card, rank, dex_id) VALUES (?, ?, ?)')
  db.transaction(() => {
    for (const set of sets.filter((known) => used.has(known.id))) {
      writeSet.run(
        set.id,
        set.name,
        set.releaseDate ?? '',
        JSON.stringify([...(groups.get(set.id) ?? [])]),
      )
    }
    for (const [setId, { name, date }] of extraSets) {
      writeSet.run(setId, name, date, JSON.stringify([...groups.get(setId)!]))
    }
    const write = (row: (string | number)[], dexIds: number[]) => {
      writeCard.run(...row, seen)
      clearSpecies.run(row[0]!)
      dexIds.forEach((dexId, rank) => writeSpecies.run(row[0]!, rank, dexId))
    }
    for (const [index, { card, dexIds }] of pokemon.entries()) {
      const suffix = SUFFIX.exec(card.name)?.[1] ?? ''
      const product = products[index]?.productId ?? 0
      const row = [`${card.set.id} ${card.localId}`, card.set.id, card.localId, suffix]
      write([...row, ids[index]!, product, 'tcgdex'], dexIds)
    }
    for (const { setId, number, suffix, productId, dexIds } of extras) {
      write([`${setId} ${number}`, setId, number, suffix, 0, productId, 'tcgplayer'], dexIds)
    }
    db.query('DELETE FROM cards WHERE seen != ?').run(seen)
    db.run('DELETE FROM sets WHERE id NOT IN (SELECT DISTINCT set_id FROM cards)')
    const etag = saveSnapshot(db, 'catalog', catalogSnapshot(db))
    if (etag !== readSource(db, 'catalog')?.stamp) {
      writeSource(db, 'catalog', { stamp: etag, date: seen.slice(0, 10) })
    }
  })()
  console.log(
    `  catalogue : ${pokemon.length + extras.length} cartes (dont ${extras.length} de TCGplayer), ${used.size + extraSets.size} extensions`,
  )
}
