/**
 * Tâche `catalog` : le catalogue des cartes Pokémon japonaises, d'après Pokécardex (avec son
 * accord, `lib/pokecardex.ts`), une fois par jour. Ses ≈ 450 séries japonaises (son plan du
 * site), de 1996 à aujourd'hui, decks et promos compris ; pour chacune, sa page : son nom, sa date
 * de sortie au Japon, et ses cartes Pokémon (numéro, nom français, Pokémon, id Cardmarket, rang de
 * son image). Les dresseurs et les énergies, sans Pokémon, n'y sont pas. Aucun tri par rareté ni
 * détection : toutes les cartes Pokémon.
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
import type { CatalogFile, CatalogRow } from '@/types'
import { writeSource } from '../db'
import { refresh } from '../lib/net'
import {
  asiaExclusive,
  japaneseSeries,
  readSeries,
  type PokecardexCard,
  type PokecardexSeries,
} from '../lib/pokecardex'
import { saveSnapshot } from '../snapshots'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Le numéro imprimé : « 001/165 » → 001, « TG01/TG30 » → TG01 ; « — », « SV-P » : aucun. */
function printedNumber(text: string) {
  const number = text.split('/')[0]!.trim()
  return /\d/.test(number) ? number : ''
}

/** La réponse de `/api/catalog`, d'après les tables. */
export function catalogSnapshot(db: Database): CatalogFile {
  const sets = db.query('SELECT id, name, released FROM sets').all() as {
    id: string
    name: string
    released: string
  }[]
  const released = new Map(sets.map((set) => [set.id, set.released]))
  const cards = db
    .query(
      `SELECT set_id AS 'set', number, sort, name, cardmarket, image,
              (SELECT json_group_array(dex_id) FROM
                 (SELECT dex_id FROM card_species WHERE card = id ORDER BY rank)) AS dexIds
       FROM cards`,
    )
    .all() as {
    set: string
    number: string
    sort: number
    name: string
    cardmarket: number
    image: 'pokecardex' | 'none' | null
    dexIds: string
  }[]

  // Des plus récentes aux plus anciennes ; dans une série, de la dernière carte à la première.
  cards.sort(
    (a, b) =>
      released.get(b.set)!.localeCompare(released.get(a.set)!) ||
      b.set.localeCompare(a.set) ||
      b.sort - a.sort,
  )
  // Des clés numériques : l'objet les garde dans l'ordre des numéros du Pokédex.
  const bySpecies: CatalogFile['cards'] = {}
  for (const { set, number, sort, name, cardmarket, image, dexIds: list } of cards) {
    const dexIds = JSON.parse(list) as number[]
    // Une image pas encore cherchée : celle de Pokécardex, qui les a presque toutes (le serveur la
    // copie à la demande ; sans elle, la carte de substitution).
    const row: CatalogRow = [
      set,
      number || String(sort),
      cardmarket,
      name,
      image === 'none' ? 0 : sort,
    ]
    if (dexIds.length > 1) row.push(dexIds)
    for (const dexId of dexIds) (bySpecies[dexId] ??= []).push(row)
  }

  const withCards = new Set(cards.map((card) => card.set))
  return {
    // Des plus récentes aux plus anciennes ; sorties le même jour, dans l'ordre de leur code.
    sets: Object.fromEntries(
      sets
        .filter((set) => withCards.has(set.id))
        .sort((a, b) => b.released.localeCompare(a.released) || a.id.localeCompare(b.id))
        .map(({ id, name, released: date }) => [id, [name, date]]),
    ),
    cards: bySpecies,
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
    `INSERT INTO cards (id, set_id, number, sort, name, cardmarket, seen)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       number = excluded.number, name = excluded.name, cardmarket = excluded.cardmarket,
       seen = excluded.seen,
       image = CASE WHEN set_id = excluded.set_id AND sort = excluded.sort THEN image END,
       image_checked = CASE WHEN set_id = excluded.set_id AND sort = excluded.sort
                            THEN image_checked END,
       set_id = excluded.set_id, sort = excluded.sort`,
  )
  const clearSpecies = db.query('DELETE FROM card_species WHERE card = ?')
  const writeSpecies = db.query('INSERT INTO card_species (card, rank, dex_id) VALUES (?, ?, ?)')
  const countCards = db.query('SELECT COUNT(*) AS count FROM cards WHERE set_id = ?')
  const forget = db.query('DELETE FROM cards WHERE set_id = ? AND seen != ?')

  const save = db.transaction((code: string, page: PokecardexSeries, readAt: string) => {
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
        readAt,
      )
      clearSpecies.run(card.id_card)
      dexIds.forEach((dexId, rank) => writeSpecies.run(card.id_card, rank, dexId))
      saved++
    }
    forget.run(code, readAt)
    return saved
  })

  const failed: string[] = []
  let cards = 0
  let read = 0
  // Les exclusivités d'autres pays d'Asie, d'après le menu de la première page lue.
  let asian = new Set<string>()
  for (const [index, code] of due.entries()) {
    if (asian.has(code)) continue
    try {
      const page = await readSeries(code)
      if (!asian.size) asian = asiaExclusive(page)
      if (asian.has(code)) continue
      const known = (countCards.get(code) as { count: number }).count
      // Une page sans cartes alors qu'on en avait : le site a changé, on garde celles d'avant.
      if (!page.cartes?.length && known) {
        console.warn(`  ${code} : page sans cartes, les ${known} d’avant restent`)
        continue
      }
      cards += save(code, page, new Date().toISOString())
      read++
    } catch (error) {
      failed.push(code)
      console.warn(`  ${code} :`, error instanceof Error ? error.message : error)
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
  const now = new Date().toISOString()
  writeSource(db, 'catalog', { stamp: now, date: now.slice(0, 10) })
  saveSnapshot(db, 'catalog', catalogSnapshot(db))
  if (failed.length) {
    throw new Error(`${failed.length} séries illisibles (${failed.slice(0, 10).join(', ')})`)
  }
}
