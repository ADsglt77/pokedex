/**
 * Ce que montre le Pokédex public (`server/vitrine.ts`) : ce qu'il laisserait passer serait public.
 * Jamais un prix payé, une page Cardmarket notée, ni ce qui dit un achat (« commandée »).
 */

import { describe, expect, test } from 'bun:test'
import { shownCollection, vitrineSummary } from '../server/vitrine'
import { card, collectionWith, ownership } from './fixtures'

describe('shownCollection', () => {
  const collection = {
    ...collectionWith({
      a: ownership('owned', { acquiredAt: '2026-10-01T10:00:00.000Z', paidPrice: 30 }),
      b: ownership('ordered', { paidPrice: 12 }),
    }),
    customCards: {
      a: card('a', [25], { cardmarket: 719445, page: 'https://www.cardmarket.com/fr/Pokemon/x' }),
      b: card('b', [1]),
      c: card('c', [4]),
      d: card('d', [7]),
    },
  }
  const shown = shownCollection(collection)

  test('les cartes possédées, avec leur date, sans prix payé', () => {
    expect(shown.cards).toEqual({
      a: {
        status: 'owned',
        updatedAt: ownership('owned').updatedAt,
        acquiredAt: '2026-10-01T10:00:00.000Z',
      },
    })
  })

  test('toutes les cartes choisies, sans leur page Cardmarket ; l’id reste, pour la valeur', () => {
    expect(Object.keys(shown.customCards)).toEqual(['a', 'b', 'c', 'd'])
    expect(shown.customCards.a).toEqual(card('a', [25], { cardmarket: 719445 }))
    expect(JSON.stringify(shown)).not.toContain('cardmarket.com')
  })

  test('l’image : ses deux adresses seulement, rien de ce qu’un fichier y aurait glissé', () => {
    const image = { small: 'https://exemple.fr/s.png', large: 'https://exemple.fr/l.png' }
    const withExtra = {
      ...collection,
      customCards: { a: card('a', [25], { image: { ...image, note: 'payée 30 €' } as never }) },
    }
    expect(shownCollection(withExtra).customCards.a?.image).toEqual(image)
  })
})

describe('vitrineSummary', () => {
  test('l’aperçu d’un lien partagé : le pseudo et la progression, rien d’autre', () => {
    const collection = {
      ...collectionWith({
        a: ownership('owned', { paidPrice: 30 }),
        b: ownership('ordered', { paidPrice: 12 }),
      }),
      customCards: { a: card('a', [25]), b: card('b', [1]), c: card('c', [4]) },
    }
    const summary = vitrineSummary('Sacha', collection)
    expect(summary.title).toBe('Le Pokédex de Sacha')
    expect(summary.description).toStartWith('1 Pokémon débloqué sur 1')
    expect(JSON.stringify(summary)).not.toMatch(/30|12|commandée/)
    expect(vitrineSummary('Adrien', collection).title).toBe('Le Pokédex d’Adrien')
  })
})
