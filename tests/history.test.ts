/**
 * L'historique des prix (`server/history.ts`) : irremplaçable, Cardmarket n'en garde pas. La tâche
 * `prices` y ajoute chaque jour le prix du jour (`withPrice`), la base le range par année
 * (`splitYears`), l'API le rend d'un seul tenant (`joinYears`) : aucun prix ne doit se perdre ni
 * changer de jour en route.
 */

import { describe, expect, test } from 'bun:test'
import { joinYears, splitYears, withPrice, yearDay, type HistoryYear } from '../server/history'

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
    expect(withPrice(known, 11, 6)).toBe(known)
  })

  test('relancée le même jour, la tâche remplace le prix du jour', () => {
    expect(withPrice(known, 11, 7)).toEqual({ year: 2026, first: 10, prices: [5, 7] })
  })

  test('des jours sans prix entre deux relevés restent vides', () => {
    expect(withPrice(known, 14, 8)).toEqual({
      year: 2026,
      first: 10,
      prices: [5, 6, null, null, 8],
    })
  })

  test('un prix avant le premier jour connu le devance, sans décaler les autres', () => {
    expect(withPrice(known, 8, 4)).toEqual({ year: 2026, first: 8, prices: [4, null, 5, 6] })
  })

  test('l’année reçue n’est jamais modifiée', () => {
    withPrice(known, 14, 8)
    withPrice(known, 8, 4)
    expect(known).toEqual({ year: 2026, first: 10, prices: [5, 6] })
  })
})

describe('historique rangé par année, puis relu', () => {
  test('à cheval sur deux années : chaque prix garde son jour', () => {
    const history = { from: '2025-12-30', prices: [1, null, 2, 3] }
    const years = splitYears(history)
    expect(years).toEqual([
      { year: 2025, first: 363, prices: [1] },
      { year: 2026, first: 0, prices: [2, 3] },
    ])
    expect(joinYears(years)).toEqual(history)
  })

  test('une année entière sans prix : les jours vides reviennent tels quels', () => {
    const history = { from: '2024-12-31', prices: [1, ...Array<null>(365).fill(null), 2] }
    const years = splitYears(history)
    expect(years).toEqual([
      { year: 2024, first: 365, prices: [1] },
      { year: 2026, first: 0, prices: [2] },
    ])
    expect(joinYears(years)).toEqual(history)
  })

  test('les jours sans prix d’avant le premier prix ne sont pas gardés', () => {
    const years = splitYears({ from: '2026-01-01', prices: [null, null, 5] })
    expect(years).toEqual([{ year: 2026, first: 2, prices: [5] }])
    expect(joinYears(years)).toEqual({ from: '2026-01-03', prices: [5] })
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
      const next = known ? withPrice(known, day, price) : { year, first: day, prices: [price] }
      years = [...years.filter((row) => row.year !== year), next].sort((a, b) => a.year - b.year)
    }
    expect(joinYears(years)).toEqual({ from: '2025-12-30', prices: [10, null, 12, 11] })
  })

  test('sans aucun prix : pas d’historique', () => {
    expect(joinYears([])).toBeNull()
    expect(splitYears({ from: '2026-01-01', prices: [null, null] })).toEqual([])
  })
})
