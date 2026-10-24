/**
 * La liste d'achats (toutes les cartes du compte à acheter : celles des Pokémon, favorites ou non,
 * et les cases des collections d'extensions, dresseurs compris, chacune une fois ; pas une carte
 * sans Pokémon ni collection, que rien ne veut : elle reste hors de la liste) et la prochaine
 * commande qui la lit : budget, une carte par Pokémon pour les cartes du Pokédex (une case
 * d'extension en est libre), la moins chère d'abord, ajouts et retraits.
 */

import { describe, expect, test } from 'bun:test'
import { planPurchase, type PlanOptions } from '@/lib/purchase-planner'
import { wishlistRows } from '@/lib/wishlist'
import type { CardStatus, PokemonCard, SeriesCollection } from '@/types'
import { card, collectionWith, NOW, ownership, wish, withCards } from './fixtures'

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

  test('une case d’extension est libre de la règle « une carte par Pokémon »', () => {
    const unobtained = { seriesOnly: true } as const
    const plan = planPurchase(
      [
        wish('slot-cheap', [25], 7, unobtained),
        wish('pokedex', [25], 9),
        wish('slot', [25], 12, unobtained),
        wish('pokedex-other', [25], 20),
        wish('trainer', [], 3, unobtained),
      ],
      options(),
    )
    // Deux cases du même Pokémon, une case et une carte du Pokédex de ce Pokémon (la case ne le
    // prévoit pas, la carte du Pokédex ne la bloque pas), un dresseur ; mais une seule des deux
    // cartes du Pokédex.
    expect(ids(plan.picked)).toEqual(['trainer', 'slot-cheap', 'pokedex', 'slot'])
    expect(ids(plan.covered)).toEqual(['pokedex-other'])
    expect(plan.total).toBe(36)
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

/** Une collection de ces cartes, chacune à son statut ; la première de chaque Pokémon favorite. */
const collectionOf = (...cards: [PokemonCard, CardStatus | null][]) =>
  withCards(
    collectionWith(
      Object.fromEntries(
        cards.flatMap(([{ id }, status]) => (status ? [[id, ownership(status)]] : [])),
      ),
    ),
    ...cards.map(([card]) => card),
  )

/** Une case d'extension pas encore obtenue. */
const slot = (id: string, dexIds: number[]) => card(id, dexIds, { seriesOnly: true })

describe('liste d’achats', () => {
  // Le plan ne lit qu'elle : une carte possédée ou commandée n'y est jamais.
  test('jamais une carte possédée ou commandée', () => {
    const data = collectionOf(
      [card('owned', [1]), 'owned'],
      [card('ordered', [4]), 'ordered'],
      [card('new', [25]), null],
    )
    expect(ids(wishlistRows(data, null))).toEqual(['new'])
  })

  test('toutes les cartes à acheter d’un Pokémon, pas seulement sa favorite', () => {
    const data = collectionOf(
      [card('a', [25]), null],
      [card('b', [25]), 'owned'],
      [card('c', [25]), null],
    )
    expect(ids(wishlistRows(data, null))).toEqual(['a', 'c'])
  })

  test('une carte TAG TEAM, achetée une fois : une seule ligne pour ses deux Pokémon', () => {
    const data = collectionOf([card('tag', [25, 644]), null])
    expect(ids(wishlistRows(data, null))).toEqual(['tag'])
  })

  test('les cases manquantes des extensions, dresseur compris, chacune une fois avec sa collection', () => {
    const megaDream: SeriesCollection = {
      set: 'M6A',
      name: 'Méga Rêve ex',
      startedAt: NOW,
      cards: ['pokedex', 'slot', 'obtained', 'ordered', 'trainer'],
    }
    // Une carte obtenue peut être la case de deux collections : sa ligne dit la première.
    const other: SeriesCollection = { ...megaDream, set: 'M6B', name: 'Autre', cards: ['pokedex'] }
    const data = {
      ...collectionOf(
        [card('pokedex', [25]), null],
        [card('alone', [1]), null],
        [slot('slot', [25]), null],
        [card('obtained', [25]), 'owned'],
        [slot('ordered', [4]), 'ordered'],
        [slot('trainer', []), null],
      ),
      series: [megaDream, other],
    }
    const rows = wishlistRows(data, null)
    expect(rows.map((row) => [row.card.id, row.series])).toEqual([
      ['pokedex', megaDream],
      ['alone', null],
      ['slot', megaDream],
      ['trainer', megaDream],
    ])
  })

  test('jamais une carte sans Pokémon ni collection : rien ne la veut', () => {
    // Un dresseur gardé par une commande annulée après la suppression de sa collection : ni fiche
    // ni collection ne le montre plus, on ne pourrait pas l'en retirer.
    const megaDream: SeriesCollection = {
      set: 'M6A',
      name: 'Méga Rêve ex',
      startedAt: NOW,
      cards: ['trainer'],
    }
    const data = {
      ...collectionOf(
        [card('orphan', []), null],
        [slot('trainer', []), null],
        [card('pokemon', [25]), null],
      ),
      series: [megaDream],
    }
    expect(ids(wishlistRows(data, null))).toEqual(['trainer', 'pokemon'])
  })
})
