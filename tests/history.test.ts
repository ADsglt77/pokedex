/**
 * L'historique des prix (`server/history.ts`) : irremplaçable, Cardmarket n'en garde pas. La tâche
 * `prices` y ajoute chaque jour le prix du jour (`withPrice`), la base le range par année, l'API
 * le rend d'un seul tenant (`joinYears`, `historyReader`), pour une carte comme pour toute la
 * collection : aucun prix ne doit se perdre, changer de jour en route, ni passer d'une carte à
 * une autre.
 */

import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { historyReader, joinYears, withPrice, yearDay, type HistoryYear } from '../server/history'

describe('jour de l’année', () => {
  test('le 1er janvier est le jour 0, les années bissextiles ont un jour de plus', () => {
    expect(yearDay('2026-01-01')).toEqual([2026, 0])
    expect(yearDay('2026-10-14')).toEqual([2026, 286])
    expect(yearDay('2025-12-31')).toEqual([2025, 364])
    expect(yearDay('2024-12-31')).toEqual([2024, 365])
  })
})

describe('prix du jour ajouté à une année', () => {
  const known: HistoryYear = { year: 2026, first: 10, prices: [5, 6] }

  test('le même prix le même jour : rien à réécrire', () => {
    expect(withPrice(known, 2026, 11, 6)).toBe(known)
  })

  test('relancée le même jour, la tâche remplace le prix du jour', () => {
    expect(withPrice(known, 2026, 11, 7)).toEqual({ year: 2026, first: 10, prices: [5, 7] })
  })

  test('des jours sans prix entre deux relevés restent vides', () => {
    expect(withPrice(known, 2026, 14, 8)).toEqual({
      year: 2026,
      first: 10,
      prices: [5, 6, null, null, 8],
    })
  })

  test('un prix avant le premier jour connu le devance, sans décaler les autres', () => {
    expect(withPrice(known, 2026, 8, 4)).toEqual({ year: 2026, first: 8, prices: [4, null, 5, 6] })
  })

  test('l’année reçue n’est jamais modifiée', () => {
    withPrice(known, 2026, 14, 8)
    withPrice(known, 2026, 8, 4)
    expect(known).toEqual({ year: 2026, first: 10, prices: [5, 6] })
  })
})

describe('historique rangé par année, puis relu', () => {
  test('à cheval sur deux années : chaque prix garde son jour', () => {
    const years = [
      { year: 2025, first: 363, prices: [1] },
      { year: 2026, first: 0, prices: [2, 3] },
    ]
    expect(joinYears(years)).toEqual({ from: '2025-12-30', prices: [1, null, 2, 3] })
  })

  test('une année entière sans prix : les jours vides reviennent tels quels', () => {
    const years = [
      { year: 2024, first: 365, prices: [1] },
      { year: 2026, first: 0, prices: [2] },
    ]
    expect(joinYears(years)).toEqual({
      from: '2024-12-31',
      prices: [1, ...Array<null>(365).fill(null), 2],
    })
  })

  test('l’historique part du premier jour avec un prix', () => {
    expect(joinYears([{ year: 2026, first: 2, prices: [5] }])).toEqual({
      from: '2026-01-03',
      prices: [5],
    })
  })

  test('jour après jour, la tâche et la relecture s’accordent', () => {
    // Trois relevés, dont un oublié et un passage au 1er janvier.
    let years: HistoryYear[] = []
    for (const [date, price] of [
      ['2025-12-30', 10],
      ['2026-01-01', 12],
      ['2026-01-02', 11],
    ] as const) {
      const [year, day] = yearDay(date)
      const known = years.find((row) => row.year === year)
      const next = withPrice(known, year, day, price)
      years = [...years.filter((row) => row.year !== year), next].sort((a, b) => a.year - b.year)
    }
    expect(joinYears(years)).toEqual({ from: '2025-12-30', prices: [10, null, 12, 11] })
  })

  test('sans aucun prix : pas d’historique', () => {
    expect(joinYears([])).toBeNull()
  })
})

describe('historyReader', () => {
  // Les seules colonnes que lit l'API (le schéma complet : `server/db.ts`).
  const db = new Database(':memory:')
  db.run(`CREATE TABLE cardmarket_products (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`)
  db.run(`CREATE TABLE cardmarket_history (
    id INTEGER NOT NULL, year INTEGER NOT NULL, first INTEGER NOT NULL, prices TEXT NOT NULL,
    PRIMARY KEY (id, year))`)
  const year = db.query('INSERT INTO cardmarket_history VALUES (?, ?, ?, ?)')
  year.run(719621, 2026, 0, '[2,3]')
  year.run(719621, 2025, 363, '[1]')
  year.run(719446, 2026, 286, '[7]')
  db.run(`INSERT INTO cardmarket_products VALUES (719621, 'Charmander [Blazing Destruction]')`)
  const read = historyReader(db)

  test('chaque carte son historique, ses années dans l’ordre, avec son nom', () => {
    expect(read(719621)).toEqual({
      name: 'Charmander [Blazing Destruction]',
      from: '2025-12-30',
      prices: [1, null, 2, 3],
    })
    expect(read(719446)).toEqual({ name: null, from: '2026-10-14', prices: [7] })
  })

  test('une carte sans historique : rien, jamais celui d’une autre', () => {
    expect(read(1)).toBeNull()
  })
})
