/**
 * Ce que montre le Pokédex public (`server/vitrine.ts`) : ce qu'il laisserait passer serait public.
 * Jamais un prix payé, une page Cardmarket notée, ni ce qui dit un achat (« commandée ») ; la
 * favorite de chaque Pokémon, elle, est montrée, comme les collections d'extensions et leurs cases.
 */

import { describe, expect, test } from 'bun:test'
import type { SeriesCollection } from '@/types'
import { shownCollection, vitrineSummary } from '../server/vitrine'
import { card, collectionWith, NOW, ownership, withCards } from './fixtures'

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

  test('la langue d’une carte française reste (sans elle, l’image et le lien seraient japonais)', () => {
    const french = {
      ...collection,
      customCards: { a: card('a', [25], { language: 'fr' }), b: card('b', [1]) },
    }
    const { a, b } = shownCollection(french).customCards
    expect(a).toStrictEqual(card('a', [25], { language: 'fr' }))
    // Une japonaise ne gagne pas de champ : l'absence reste son seul écrit.
    expect(b).toStrictEqual(card('b', [1]))
    expect(b).not.toHaveProperty('language')
  })

  test('les favorites restent : le Pokédex public montre la favorite de chaque Pokémon', () => {
    // `b` est la deuxième carte du 25, notée favorite ; `c` est la seule du 7.
    const several = withCards(
      collectionWith({ a: ownership('owned') }),
      card('a', [25]),
      card('b', [25, 4]),
      card('c', [7]),
    )
    const favorites = { 25: 'b', 4: 'b', 7: 'c' }
    const noted = shownCollection({ ...several, favorites })
    expect(noted.favorites).toEqual(favorites)
    // Une copie : la collection du compte ne bouge pas avec elle.
    expect(noted.favorites).not.toBe(favorites)
    expect(shownCollection(several).favorites).toEqual({ 25: 'a', 4: 'b', 7: 'c' })
  })

  test('les collections d’extensions et leurs cases restent, sans le statut « commandée »', () => {
    // Une collection de quatre cases : une possédée, un dresseur, et deux pas encore obtenues dont
    // une commandée (payée 12 €) ; une seconde, française.
    const series = [
      {
        set: 'SV2A',
        name: 'Pokémon Card 151',
        startedAt: NOW,
        cards: ['a', 't', 's', 'u'],
        note: 'payée 30 €',
      },
      { set: 'SV2A', language: 'fr', name: 'Pokémon 151', startedAt: NOW, cards: ['a'] },
    ] as SeriesCollection[]
    const inSeries = {
      ...collectionWith({
        a: ownership('owned', { acquiredAt: NOW, paidPrice: 30 }),
        s: ownership('ordered', { paidPrice: 12 }),
      }),
      customCards: {
        a: card('a', [25]),
        t: card('t', []),
        s: card('s', [4], { seriesOnly: true }),
        u: card('u', [1], { seriesOnly: true }),
      },
      series,
    }
    const shown = shownCollection(inSeries)
    // Champ par champ : l'extension, la langue (seulement le français), le nom, le jour, les cases.
    expect(shown.series).toStrictEqual([
      { set: 'SV2A', name: 'Pokémon Card 151', startedAt: NOW, cards: ['a', 't', 's', 'u'] },
      { set: 'SV2A', language: 'fr', name: 'Pokémon 151', startedAt: NOW, cards: ['a'] },
    ])
    expect(shown.series[0]!.cards).not.toBe(series[0]!.cards)
    // Les cases pas encore obtenues le restent (sans elles, le Pokédex public les compterait), et
    // un dresseur n'a aucun Pokémon.
    expect(shown.customCards.s).toStrictEqual(card('s', [4], { seriesOnly: true }))
    expect(shown.customCards.t).toStrictEqual(card('t', []))
    expect(shown.customCards.a).toStrictEqual(card('a', [25]))
    expect(shown.customCards.a).not.toHaveProperty('seriesOnly')
    // Rien de ce que dit un achat : la case commandée n'a pas de statut, ni de prix payé.
    expect(Object.keys(shown.cards)).toEqual(['a'])
    expect(JSON.stringify(shown)).not.toMatch(/ordered|paidPrice|payée/)
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
