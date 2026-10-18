/**
 * Tâche `catalog` : le catalogue des cartes japonaises, d'après Pokécardex (avec son accord,
 * `lib/pokecardex.ts`), une fois par jour. Ses ≈ 450 séries japonaises (son plan du site), de 1996
 * à aujourd'hui, decks et promos compris ; pour chacune, sa page : son nom, sa date de sortie au
 * Japon, et toutes ses cartes, dresseurs et énergies compris (numéro, noms français, anglais et
 * allemand, Pokémon, id Cardmarket, rang de son image, rareté, type, illustrateur, versions), les
 * noms des raretés et le menu des séries (le bloc de chacune). Aucune sélection ni détection : la
 * rareté et le type servent aux filtres que choisit l'utilisateur.
 *
 * Les exclusivités d'autres pays d'Asie (bloc « Asia Exclusive » de son menu), rangées avec les
 * japonaises, sont écartées. Une série est relue chaque semaine, chaque jour si elle est sortie
 * depuis moins de 90 jours (Pokécardex la complète) ; `--refresh` les relit toutes. Une page par
 * série, une toutes les 3 s : le premier passage prend une vingtaine de minutes. Une page en échec
 * n'empêche pas les autres ; la tâche échoue ensuite, pour être relancée. Une page soudain vide (le
 * site a changé) ne retire rien. Au début et en fin de tâche, les réponses du catalogue sont
 * recalculées (`snapshots`) : `/api/catalog` (les cartes Pokémon, par Pokémon : la fenêtre d'ajout),
 * `/api/catalog/sets` (les séries) et `/api/catalog/sets/<code>` (toutes les cartes d'une série : la
 * page Catalogue).
 */

import type { Database } from 'bun:sqlite'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { numberKey } from '@/lib/card-code'
import { DAY, HOUR } from '@/lib/time'
import type {
  CatalogFile,
  CatalogRow,
  CatalogSetFile,
  CatalogSetRow,
  CatalogSetsFile,
} from '@/types'
import { refresh } from '../lib/net'
import {
  asiaExclusive,
  japaneseSeries,
  menuBlocks,
  readSeries,
  type PokecardexCard,
  type PokecardexSeries,
} from '../lib/pokecardex'
import { saveSnapshot } from '../snapshots'

/**
 * Autant de pages en échec d'affilée : le site a changé (clé introuvable, défi anti-robot…), on ne
 * le sollicite pas davantage ; la tâche est relancée plus tard.
 */
const MAX_FAILURES_IN_A_ROW = 10

/** Un texte de Pokécardex ; '' pour un tiret seul, qu'il écrit pour « inconnu » (« — »). */
const stated = (text: string | null) => (/^[\s—–-]*$/.test(text ?? '') ? '' : text!.trim())

/** Le numéro imprimé : « 001/165 » → 001, « TG01/TG30 » → TG01 ; « — », « SV-P » : aucun. */
function printedNumber(text: string) {
  const number = text.split('/')[0]!.trim()
  return /\d/.test(number) ? number : ''
}

/** Une série, telle que la gardent les tables. */
interface SetRecord {
  id: string
  name: string
  released: string
  logo: 'pokecardex' | 'none' | null
  block: string | null
  blockRank: number | null
  deck: 0 | 1
}

/** Une carte, telle que la gardent les tables, avec ses Pokémon (JSON). */
interface CardRecord {
  set: string
  number: string
  printed: string
  sort: number
  name: string
  en: string
  de: string
  cardmarket: number
  image: 'pokecardex' | 'none' | null
  rarity: number | null
  type: number | null
  illustrator: string
  versions: string
  dexIds: string
}

interface RarityRecord {
  id: number
  name: string
  rank: number
}

/** Le préfixe des réponses de chaque série : `catalog/sets/SV2A`. */
const SET_SNAPSHOT = 'catalog/sets/'

/**
 * Enregistre les réponses du catalogue, d'après les tables ; rien tant qu'aucune carte n'a été lue :
 * un catalogue vide passerait pour disponible (l'API répond 404 en attendant).
 */
export function saveCatalog(db: Database) {
  if (!db.query('SELECT 1 FROM cards LIMIT 1').get()) return
  const sets = (
    db
      .query(
        `SELECT id, name, released, logo, block, block_rank AS blockRank, deck FROM sets
         WHERE id IN (SELECT set_id FROM cards)`,
      )
      .all() as SetRecord[]
  )
    // Des plus récentes aux plus anciennes ; sorties le même jour, dans l'ordre de leur code.
    .sort((a, b) => b.released.localeCompare(a.released) || a.id.localeCompare(b.id))
  const cards = db
    .query(
      `SELECT set_id AS 'set', number, printed, sort, name, name_en AS en, name_de AS de,
              cardmarket, image, rarity, type, illustrator, versions,
              (SELECT json_group_array(dex_id ORDER BY rank) FROM card_species
               WHERE card = id) AS dexIds
       FROM cards ORDER BY sort`,
    )
    .all() as CardRecord[]
  const rarities = new Map(
    (db.query('SELECT id, name, rank FROM rarities').all() as RarityRecord[]).map((rarity) => [
      rarity.id,
      rarity,
    ]),
  )
  const bySet = new Map<string, CardRecord[]>()
  for (const card of cards) {
    const list = bySet.get(card.set)
    if (list) list.push(card)
    else bySet.set(card.set, [card])
  }
  db.transaction(() => {
    saveSnapshot(db, 'catalog', catalogResponse(sets, cards, rarities))
    saveSnapshot(db, 'catalog/sets', setsResponse(sets, bySet))
    for (const set of sets) {
      saveSnapshot(db, `${SET_SNAPSHOT}${set.id}`, setResponse(bySet.get(set.id)!, rarities))
    }
    // Celles des séries qui n'ont plus de cartes : retirées (l'API répond 404).
    db.query(
      `DELETE FROM snapshots WHERE name LIKE '${SET_SNAPSHOT}%'
       AND name NOT IN (SELECT '${SET_SNAPSHOT}' || set_id FROM cards)`,
    ).run()
  })()
}

/** Les raretés de ces cartes : `[nom, rang]` par numéro. */
const raritiesOf = (cards: CardRecord[], rarities: Map<number, RarityRecord>) =>
  Object.fromEntries(
    [...new Set(cards.map((card) => card.rarity))]
      .map((id) => id !== null && rarities.get(id))
      .filter((rarity) => !!rarity)
      .map(({ id, name, rank }) => [id, [name, rank]]),
  ) as CatalogFile['rarities']

/**
 * Le numéro de l'image chez Pokécardex : son rang ; 0 s'il n'en a pas. Une image pas encore
 * cherchée : celle de Pokécardex, qui les a presque toutes (le serveur la copie à la demande ; sans
 * elle, la carte de substitution).
 */
const imageOf = (card: CardRecord) => (card.image === 'none' ? 0 : card.sort)

/** `/api/catalog` : les cartes Pokémon, par Pokémon (la fenêtre d'ajout d'une carte). */
function catalogResponse(
  sets: SetRecord[],
  cards: CardRecord[],
  rarities: Map<number, RarityRecord>,
): CatalogFile {
  const released = new Map(sets.map((set) => [set.id, set.released]))
  const pokemon = cards
    .map((card) => ({ ...card, list: JSON.parse(card.dexIds) as number[] }))
    .filter((card) => card.list.length > 0)
    // Des plus récentes aux plus anciennes ; dans une série, de la dernière carte à la première.
    .sort(
      (a, b) =>
        released.get(b.set)!.localeCompare(released.get(a.set)!) ||
        a.set.localeCompare(b.set) ||
        b.sort - a.sort,
    )
  // Des clés numériques : l'objet les garde dans l'ordre des numéros du Pokédex.
  const bySpecies: CatalogFile['cards'] = {}
  for (const card of pokemon) {
    const row: CatalogRow = [
      card.set,
      card.number || String(card.sort),
      card.cardmarket,
      card.name,
      imageOf(card),
      card.rarity ?? 0,
      card.type ?? 0,
    ]
    if (card.list.length > 1) row.push(card.list)
    for (const dexId of card.list) (bySpecies[dexId] ??= []).push(row)
  }
  const withPokemon = new Set(pokemon.map((card) => card.set))
  return {
    sets: Object.fromEntries(
      sets
        .filter((set) => withPokemon.has(set.id))
        .map(({ id, name, released: date, logo }) => [id, [name, date, logo === 'none' ? 0 : 1]]),
    ),
    cards: bySpecies,
    rarities: raritiesOf(pokemon, rarities),
  }
}

/** `/api/catalog/sets` : les séries, leur bloc et leur nombre de cartes (la page Catalogue). */
function setsResponse(sets: SetRecord[], bySet: Map<string, CardRecord[]>): CatalogSetsFile {
  // Les blocs dans l'ordre du menu ; chaque série renvoie au sien par son rang dans la liste.
  const blocks = [
    ...new Set(
      sets
        .filter((set) => set.block !== null)
        .sort((a, b) => a.blockRank! - b.blockRank!)
        .map((set) => set.block!),
    ),
  ]
  return {
    blocks,
    sets: sets.map((set) => [
      set.id,
      set.name,
      set.released,
      set.logo === 'none' ? 0 : 1,
      bySet.get(set.id)!.length,
      set.block === null ? -1 : blocks.indexOf(set.block),
      set.deck,
    ]),
  }
}

/** `/api/catalog/sets/<code>` : toutes les cartes d'une série, dans son ordre. */
function setResponse(cards: CardRecord[], rarities: Map<number, RarityRecord>): CatalogSetFile {
  return {
    cards: cards.map((card): CatalogSetRow => ({
      number: card.number || String(card.sort),
      printed: card.printed,
      name: card.name,
      en: card.en,
      de: card.de,
      dexIds: JSON.parse(card.dexIds) as number[],
      cardmarket: card.cardmarket,
      image: imageOf(card),
      rarity: card.rarity ?? 0,
      type: card.type ?? 0,
      illustrator: card.illustrator,
      versions: JSON.parse(card.versions) as string[],
    })),
    rarities: raritiesOf(cards, rarities),
  }
}

/** Les séries à relire : nouvelles, lues il y a plus d'une semaine, ou d'un jour si récentes. */
function dueSeries(db: Database, codes: string[], now: number) {
  if (refresh) return codes
  const known = new Map(
    (
      db.query('SELECT id, released, read_at AS readAt FROM sets').all() as {
        id: string
        released: string
        readAt: string
      }[]
    ).map((set) => [set.id, set]),
  )
  return codes.filter((code) => {
    const set = known.get(code)
    if (!set) return true
    const recent = !set.released || now - Date.parse(set.released) < 90 * DAY
    // Un peu moins qu'un jour et qu'une semaine : la tâche repasse toutes les 24 h.
    return now - Date.parse(set.readAt) > (recent ? 20 * HOUR : 6 * DAY + 20 * HOUR)
  })
}

export async function catalog(db: Database) {
  // La réponse d'après les tables, tout de suite : une forme changée avec le code (ou retirée par
  // une étape du schéma) est refaite sans attendre la lecture des séries (une vingtaine de minutes
  // quand toutes sont à relire).
  saveCatalog(db)
  const codes = await japaneseSeries()
  const due = dueSeries(db, codes, Date.now())
  console.log(`Pokécardex : ${codes.length} séries japonaises, ${due.length} à relire`)

  const writeSet = db.query(
    `INSERT INTO sets (id, name, released, read_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, released = excluded.released,
                                    read_at = excluded.read_at`,
  )
  // Une carte dont la série ou le rang changent a une autre image : à chercher de nouveau.
  const writeCard = db.query(
    `INSERT INTO cards (id, set_id, number, printed, sort, name, name_en, name_de, cardmarket,
                        rarity, type, illustrator, versions, seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       number = excluded.number, printed = excluded.printed, name = excluded.name,
       name_en = excluded.name_en, name_de = excluded.name_de, cardmarket = excluded.cardmarket,
       rarity = excluded.rarity, type = excluded.type, illustrator = excluded.illustrator,
       versions = excluded.versions, seen = excluded.seen,
       image = CASE WHEN set_id = excluded.set_id AND sort = excluded.sort THEN image END,
       image_checked = CASE WHEN set_id = excluded.set_id AND sort = excluded.sort
                            THEN image_checked END,
       set_id = excluded.set_id, sort = excluded.sort`,
  )
  const writeRarity = db.query(
    `INSERT INTO rarities (id, name, rank) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, rank = excluded.rank`,
  )
  const writeBlock = db.query('UPDATE sets SET block = ?, block_rank = ?, deck = ? WHERE id = ?')
  const clearSpecies = db.query('DELETE FROM card_species WHERE card = ?')
  const writeSpecies = db.query('INSERT INTO card_species (card, rank, dex_id) VALUES (?, ?, ?)')
  const countCards = db.query('SELECT COUNT(*) AS count FROM cards WHERE set_id = ?')
  const forget = db.query('DELETE FROM cards WHERE set_id = ? AND seen != ?')

  const save = db.transaction((code: string, page: PokecardexSeries, readAt: string) => {
    const known = (countCards.get(code) as { count: number }).count
    const { fullName, releaseDateFR } = page.currentSeries
    writeSet.run(code, fullName, releaseDateFR?.slice(0, 10) ?? '', readAt)
    // Le numéro imprimé, sinon le rang. Si deux cartes de la série se confondraient (deux
    // demi-decks numérotés chacun : HS ; cartes géantes de séries diverses : JUMBO), toutes
    // prennent leur rang.
    const keys = page.cartes.map((card) =>
      numberKey(printedNumber(card.num_card) || `${card.sort}`),
    )
    const distinct = new Set(keys).size === keys.length
    const numberOf = (card: PokecardexCard) => (distinct ? printedNumber(card.num_card) : '')
    for (const card of page.cartes) {
      const dexIds = (card.id_pokedex_list ?? []).filter(
        (id) => Number.isInteger(id) && id >= 1 && id <= TOTAL_SPECIES,
      )
      const english = stated(card.name_card_en)
      writeCard.run(
        card.id_card,
        code,
        numberOf(card),
        stated(card.num_card),
        card.sort,
        stated(card.name_card_fr) || english,
        english,
        stated(card.name_card_de),
        card.id_cardmarket ?? 0,
        card.id_rarete,
        card.id_type,
        stated(card.nom_illustrateur),
        JSON.stringify((card.versions ?? []).map((version) => version.nom_version)),
        readAt,
      )
      clearSpecies.run(card.id_card)
      dexIds.forEach((dexId, rank) => writeSpecies.run(card.id_card, rank, dexId))
    }
    const saved = page.cartes.length
    // Moins de la moitié des cartes d'avant : le format des pages a changé (un champ renommé),
    // pas l'extension. Rien n'est gardé de cette lecture (la transaction est annulée) : elle
    // compte comme un échec.
    if (saved < known / 2) {
      throw new Error(`${code} : ${saved} cartes retenues sur ${known} (format des pages changé ?)`)
    }
    forget.run(code, readAt)
    return saved
  })

  const failed: string[] = []
  let inARow = 0
  let cards = 0
  let read = 0
  // Les exclusivités d'autres pays d'Asie et les blocs, d'après le menu de la première page lue, et
  // les raretés, que chaque page donne toutes.
  let asian = new Set<string>()
  let menu: PokecardexSeries | null = null
  for (const [index, code] of due.entries()) {
    if (asian.has(code)) continue
    try {
      const page = await readSeries(code)
      if (!menu) {
        menu = page
        asian = asiaExclusive(page)
        for (const rarity of page.raretes ?? []) {
          writeRarity.run(rarity.id_rarete, rarity.nom_rarete, rarity.order_rarete)
        }
      }
      if (asian.has(code)) continue
      const known = (countCards.get(code) as { count: number }).count
      // Une page sans cartes : une série annoncée mais pas encore remplie, ou le site a changé (on
      // garde alors celles d'avant). Rien n'est noté : elle est relue au passage suivant.
      if (!page.cartes?.length) {
        if (known) console.warn(`  ${code} : page sans cartes, les ${known} d’avant restent`)
        continue
      }
      cards += save(code, page, new Date().toISOString())
      read++
      inARow = 0
    } catch (error) {
      failed.push(code)
      console.warn(`  ${code} :`, error instanceof Error ? error.message : error)
      if (++inARow >= MAX_FAILURES_IN_A_ROW) {
        console.warn(`  ${inARow} séries en échec d’affilée : la lecture s’arrête là.`)
        break
      }
    }
    if ((index + 1) % 50 === 0) console.log(`  ${index + 1} / ${due.length} séries`)
  }
  // Celles qu'un passage d'avant aurait gardées : retirées.
  for (const code of asian) {
    db.query('DELETE FROM cards WHERE set_id = ?').run(code)
    db.query('DELETE FROM sets WHERE id = ?').run(code)
  }
  // Le bloc de chaque série (les nouvelles comprises, enregistrées depuis) : ses séries en
  // boosters, puis ses decks.
  if (menu) {
    for (const [rank, block] of menuBlocks(menu).entries()) {
      for (const series of block.series) writeBlock.run(block.name, rank, 0, series.shortName)
      for (const deck of block.decks ?? []) writeBlock.run(block.name, rank, 1, deck.shortName)
    }
  }

  const totals = db
    .query(
      `SELECT COUNT(*) AS cards, SUM(cardmarket = 0) AS withoutCardmarket,
              SUM(number != '' AND CAST(number AS INTEGER) != sort) AS otherNumber
       FROM cards`,
    )
    .get() as { cards: number; withoutCardmarket: number | null; otherNumber: number | null }
  console.log(
    `Catalogue : ${read} séries relues (${cards} cartes) ; ` +
      `${totals.cards} cartes en tout, ${totals.withoutCardmarket ?? 0} sans id Cardmarket, ` +
      `${totals.otherNumber ?? 0} dont le numéro imprimé n’est pas le rang de l’image`,
  )
  saveCatalog(db)
  if (failed.length) {
    throw new Error(`${failed.length} séries illisibles (${failed.slice(0, 10).join(', ')})`)
  }
}
