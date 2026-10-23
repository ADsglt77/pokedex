/**
 * La liste d'achats (toutes les cartes à acheter d'un Pokémon, sa favorite ou non, chacune une fois)
 * et la prochaine commande qui la lit : budget, une carte par Pokémon, la moins chère d'abord,
 * ajouts et retraits.
 */

import { describe, expect, test } from 'bun:test'
import type { PokedexEntry } from '@/lib/pokedex'
import { planPurchase, type PlanOptions } from '@/lib/purchase-planner'
import { wishlistRows } from '@/lib/wishlist'
import type { CardStatus, PokemonCard } from '@/types'
import { card, wish } from './fixtures'

const options = (extra: Partial<PlanOptions> = {}): PlanOptions => ({
  budget: 100,
  shippingReserve: 5,
  forced: new Set(),
  skipped: new Set(),
  ...extra,
})

const ids = (rows: { card: { id: string } }[]) => rows.map((row) => row.card.id)

describe('prochaine commande', () => {
  test('ne dépasse jamais le budget, port réservé', () => {
    const plan = planPurchase(
      [wish('a', [1], 40), wish('b', [2], 40), wish('c', [3], 30)],
      options(),
    )
    expect(ids(plan.picked)).toEqual(['c', 'a'])
    expect(plan.total).toBe(75)
    expect(ids(plan.left)).toEqual(['b'])
    expect(plan.overBudget).toBe(false)
  })

  test('une carte qui tient tout juste dans le budget est prise (au centime près)', () => {
    const plan = planPurchase(
      [wish('a', [1], 0.12), wish('b', [2], 19.87)],
      options({ budget: 20, shippingReserve: 0.01 }),
    )
    expect(ids(plan.picked)).toEqual(['a', 'b'])
  })

  test('une seule carte par Pokémon, la moins chère d’abord (un fichier importé peut en avoir plusieurs)', () => {
    const plan = planPurchase([wish('other', [25], 30), wish('cheap', [25], 10)], options())
    expect(ids(plan.picked)).toEqual(['cheap'])
    // L'autre reste visible, avec les cartes mises de côté.
    expect(ids(plan.covered)).toEqual(['other'])
  })

  test('une carte TAG TEAM, achetée une fois, prévoit tous ses Pokémon', () => {
    const plan = planPurchase(
      [wish('tag', [25, 644], 15), wish('pikachu', [25], 40), wish('zekrom', [644], 20)],
      options(),
    )
    expect(ids(plan.picked)).toEqual(['tag'])
    expect(plan.total).toBe(20)
    expect(ids(plan.covered)).toEqual(['zekrom', 'pikachu'])
  })

  test('sans prix : à part, jamais chiffrée', () => {
    const plan = planPurchase([wish('unpriced', [1], null), wish('a', [2], 30)], options())
    expect(ids(plan.picked)).toEqual(['a'])
    expect(ids(plan.unpriced)).toEqual(['unpriced'])
    expect(plan.total).toBe(35)
  })

  test('ajout et retrait à la main', () => {
    const cards = [wish('a', [1], 90), wish('b', [2], 20)]
    const plan = planPurchase(cards, options({ forced: new Set(['a']) }))
    expect(ids(plan.picked)).toEqual(['a'])
    expect(ids(plan.left)).toEqual(['b'])
    const both = planPurchase(cards, options({ forced: new Set(['a', 'b']) }))
    expect(both.total).toBe(115)
    expect(both.overBudget).toBe(true)
    const skipped = planPurchase(cards, options({ skipped: new Set(['b']) }))
    expect(ids(skipped.skipped)).toEqual(['b'])
  })
})

/**
 * Une entrée du Pokédex avec ces cartes, chacune à son statut, la première étant la favorite (la
 * liste d'achats ne lit que les cartes).
 */
const entry = (...cards: [PokemonCard, CardStatus | null][]): PokedexEntry => {
  const views = cards.map(([card, status]) => ({ card, status, acquiredAt: null, paidPrice: null }))
  const statuses = views.map((view) => view.status)
  const status = statuses.includes('owned')
    ? 'owned'
    : statuses.includes('ordered')
      ? 'ordered'
      : null
  return {
    species: {
      id: 1,
      names: { fr: 'Bulbizarre', en: 'Bulbasaur', ja: null },
      types: ['grass'],
      generation: 1,
    },
    card: views[0] ?? null,
    cards: views,
    status,
    unlocked: status === 'owned',
  }
}

describe('liste d’achats', () => {
  // Le plan ne lit qu'elle : une carte possédée ou commandée n'y est jamais.
  test('jamais une carte possédée ou commandée', () => {
    const entries = [
      entry([card('owned', [1]), 'owned']),
      entry([card('ordered', [2]), 'ordered']),
      entry([card('new', [3]), null]),
    ]
    expect(ids(wishlistRows(entries, null))).toEqual(['new'])
  })

  test('toutes les cartes à acheter d’un Pokémon, pas seulement sa favorite', () => {
    const pikachu = entry(
      [card('a', [25]), null],
      [card('b', [25]), 'owned'],
      [card('c', [25]), null],
    )
    expect(ids(wishlistRows([pikachu], null))).toEqual(['a', 'c'])
  })

  test('une carte TAG TEAM, achetée une fois : une seule ligne pour ses deux Pokémon', () => {
    const tag = card('tag', [25, 644])
    expect(ids(wishlistRows([entry([tag, null]), entry([tag, null])], null))).toEqual(['tag'])
  })
})
