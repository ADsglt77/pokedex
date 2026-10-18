/**
 * Tâche `catalog` : le catalogue des cartes Pokémon japonaises, d'après Pokécardex (avec son
 * accord, `lib/pokecardex.ts`), une fois par jour. Ses ≈ 450 séries japonaises (son plan du
 * site), de 1996 à aujourd'hui, decks et promos compris ; pour chacune, sa page : son nom, sa date
 * de sortie au Japon, et ses cartes Pokémon (numéro, nom français, Pokémon, id Cardmarket, rang de
 * son image, rareté, type), et les noms des raretés. Les dresseurs et les énergies, sans Pokémon,
 * n'y sont pas. Aucune sélection ni détection : toutes les cartes Pokémon (la rareté et le type
 * servent aux filtres que choisit l'utilisateur).
 *
 * Les exclusivités d'autres pays d'Asie (bloc « Asia Exclusive » de son menu), rangées avec les
 * japonaises, sont écartées. Une série est relue chaque semaine, chaque jour si elle est sortie
 * depuis moins de 90 jours (Pokécardex la complète) ; `--refresh` les relit toutes. Une page par
 * série, une toutes les 3 s : le premier passage prend une vingtaine de minutes. Une page en échec
 * n'empêche pas les autres ; la tâche échoue ensuite, pour être relancée. Une page soudain vide (le
 * site a changé) ne retire rien. En fin de tâche, la réponse de `/api/catalog` est recalculée
 * (`snapshots`).
 */

import type { Database } from 'bun:sqlite'
import { TOTAL_SPECIES } from '@/config/pokedex'
import { numberKey } from '@/lib/card-code'
import { DAY, HOUR } from '@/lib/time'
import type { CatalogFile, CatalogRow } from '@/types'
import { refresh } from '../lib/net'
import {
  asiaExclusive,
  japaneseSeries,
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

/** Le numéro imprimé : « 001/165 » → 001, « TG01/TG30 » → TG01 ; « — », « SV-P » : aucun. */
function printedNumber(text: string) {
  const number = text.split('/')[0]!.trim()
  return /\d/.test(number) ? number : ''
}

/**
 * Enregistre la réponse de `/api/catalog`, d'après les tables ; rien tant qu'aucune carte n'a été
 * lue : un catalogue vide passerait pour disponible (l'API répond 404 en attendant).
 */
export function saveCatalog(db: Database) {
  if (db.query('SELECT 1 FROM cards LIMIT 1').get()) {
    saveSnapshot(db, 'catalog', catalogResponse(db))
  }
}

function catalogResponse(db: Database): CatalogFile {
  const sets = db.query('SELECT id, name, released, logo FROM sets').all() as {
    id: string
    name: string
    released: string
    logo: 'pokecardex' | 'none' | null
  }[]
  const released = new Map(sets.map((set) => [set.id, set.released]))
  const cards = db
    .query(
      `SELECT set_id AS 'set', number, sort, name, cardmarket, image, rarity, type,
              (SELECT json_group_array(dex_id ORDER BY rank) FROM card_species
               WHERE card = id) AS dexIds
       FROM cards`,
    )
    .all() as {
    set: string
    number: string
    sort: number
    name: string
    cardmarket: number
    image: 'pokecardex' | 'none' | null
    rarity: number | null
    type: number | null
    dexIds: string
  }[]

  // Des plus récentes aux plus anciennes ; dans une série, de la dernière carte à la première.
  cards.sort(
    (a, b) =>
      released.get(b.set)!.localeCompare(released.get(a.set)!) ||
      a.set.localeCompare(b.set) ||
      b.sort - a.sort,
  )
  // Des clés numériques : l'objet les garde dans l'ordre des numéros du Pokédex.
  const bySpecies: CatalogFile['cards'] = {}
  for (const { set, number, sort, name, cardmarket, image, rarity, type, dexIds: list } of cards) {
    const dexIds = JSON.parse(list) as number[]
    // Une image pas encore cherchée : celle de Pokécardex, qui les a presque toutes (le serveur la
    // copie à la demande ; sans elle, la carte de substitution).
    const row: CatalogRow = [
      set,
      number || String(sort),
      cardmarket,
      name,
      image === 'none' ? 0 : sort,
      rarity ?? 0,
      type ?? 0,
    ]
    if (dexIds.length > 1) row.push(dexIds)
    for (const dexId of dexIds) (bySpecies[dexId] ??= []).push(row)
  }

  const withCards = new Set(cards.map((card) => card.set))
  const rarities = db
    .query('SELECT id, name, rank FROM rarities WHERE id IN (SELECT rarity FROM cards)')
    .all() as { id: number; name: string; rank: number }[]
  return {
    // Des plus récentes aux plus anciennes ; sorties le même jour, dans l'ordre de leur code.
    sets: Object.fromEntries(
      sets
        .filter((set) => withCards.has(set.id))
        .sort((a, b) => b.released.localeCompare(a.released) || a.id.localeCompare(b.id))
        .map(({ id, name, released: date, logo }) => [id, [name, date, logo === 'none' ? 0 : 1]]),
    ),
    cards: bySpecies,
    rarities: Object.fromEntries(rarities.map(({ id, name, rank }) => [id, [name, rank]])),
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
    `INSERT INTO cards (id, set_id, number, sort, name, cardmarket, rarity, type, seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       number = excluded.number, name = excluded.name, cardmarket = excluded.cardmarket,
       rarity = excluded.rarity, type = excluded.type, seen = excluded.seen,
       image = CASE WHEN set_id = excluded.set_id AND sort = excluded.sort THEN image END,
       image_checked = CASE WHEN set_id = excluded.set_id AND sort = excluded.sort
                            THEN image_checked END,
       set_id = excluded.set_id, sort = excluded.sort`,
  )
  const writeRarity = db.query(
    `INSERT INTO rarities (id, name, rank) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, rank = excluded.rank`,
  )
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
    let saved = 0
    for (const card of page.cartes) {
      const dexIds = (card.id_pokedex_list ?? []).filter(
        (id) => Number.isInteger(id) && id >= 1 && id <= TOTAL_SPECIES,
      )
      if (!dexIds.length) continue
      const name = card.name_card_fr?.trim() || card.name_card_en?.trim() || ''
      writeCard.run(
        card.id_card,
        code,
        numberOf(card),
        card.sort,
        name,
        card.id_cardmarket ?? 0,
        card.id_rarete,
        card.id_type,
        readAt,
      )
      clearSpecies.run(card.id_card)
      dexIds.forEach((dexId, rank) => writeSpecies.run(card.id_card, rank, dexId))
      saved++
    }
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
  // Les exclusivités d'autres pays d'Asie, d'après le menu de la première page lue, et les
  // raretés, que chaque page donne toutes.
  let asian = new Set<string>()
  for (const [index, code] of due.entries()) {
    if (asian.has(code)) continue
    try {
      const page = await readSeries(code)
      if (!asian.size) {
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

  const totals = db
    .query(
      `SELECT COUNT(*) AS cards, SUM(cardmarket = 0) AS withoutCardmarket,
              SUM(number != '' AND CAST(number AS INTEGER) != sort) AS otherNumber
       FROM cards`,
    )
    .get() as { cards: number; withoutCardmarket: number | null; otherNumber: number | null }
  console.log(
    `Catalogue : ${read} séries relues (${cards} cartes Pokémon) ; ` +
      `${totals.cards} cartes en tout, ${totals.withoutCardmarket ?? 0} sans id Cardmarket, ` +
      `${totals.otherNumber ?? 0} dont le numéro imprimé n’est pas le rang de l’image`,
  )
  saveCatalog(db)
  if (failed.length) {
    throw new Error(`${failed.length} séries illisibles (${failed.slice(0, 10).join(', ')})`)
  }
}
