/**
 * La migration des collections vers le catalogue de TCGdex (`migrateCollection`, une fois : une
 * erreur abîmerait les cartes de chaque compte) : une carte retrouvée par son code (série sans
 * casse, numéro sans zéro), dans sa langue seulement, ou à défaut par son id Cardmarket s'il ne
 * désigne qu'une carte ; sa référence prend le code de TCGdex et garde son nom, son image devient
 * celle du catalogue (ou aucune), une adresse collée et l'id Cardmarket restent ; une carte
 * introuvable ou hors du catalogue ne change pas ; une collection d'extension prend l'id et le nom
 * de sa série, jamais celle d'une autre ; et le document reçu n'est pas modifié.
 */

import { describe, expect, test } from 'bun:test'
import { migrateCollection, migrationReport, type Catalogs } from '@/lib/tcgdex-migration'
import type { CatalogSetRow, CollectionData, PokemonCard } from '@/types'
import { card, collectionWith, ownership, withCards } from './fixtures'

/** Une carte d'une série de TCGdex : son numéro, son image (sa clé, '' sans), son id Cardmarket. */
const row = (number: string, image: string, cardmarket = 0): CatalogSetRow => ({
  number,
  printed: number,
  name: '',
  dexIds: [1],
  cardmarket,
  image,
  rarity: '',
  type: '',
  illustrator: '',
  versions: [],
})

const catalogs: Catalogs = {
  ja: [
    {
      id: 'SV2a',
      name: 'Pokémon Card 151',
      cards: [row('001', 'ja/SV2a/SV2a-001', 101), row('002', '', 102)],
    },
    { id: 'SVP', name: 'Promos SV', cards: [row('001', 'ja/SVP/SVP-001')] },
  ],
  fr: [
    {
      id: 'me01',
      name: 'Méga-Évolution',
      cards: [row('025', 'fr/me01/me01-025', 201), row('026', 'fr/me01/me01-026', 300)],
    },
    { id: 'mep', name: 'Promos Méga', cards: [row('001', 'fr/mep/mep-001', 300)] },
    { id: 'SVP', name: 'Promos EV', cards: [row('001', 'fr/SVP/SVP-001')] },
  ],
}

/** L'image d'une carte au catalogue d'avant. */
const oldImage = (path: string) => ({ small: `${path}-md.webp`, large: `${path}-hd.webp` })

const cards: PokemonCard[] = [
  // Retrouvées par leur code : avec image, sans image.
  card('a', [1], {
    reference: 'Bulbizarre (SV2A 1)',
    image: oldImage('/images/cards/SV2A/1'),
    cardmarket: 101,
  }),
  card('b', [2], { reference: 'Herbizarre (sv2a 002)', image: null }),
  // Le même code dans les deux langues : chacune le sien.
  card('c', [25], { reference: 'Pikachu (SVP 1)', language: 'fr' }),
  // Un id de série changé : retrouvée par son id Cardmarket, son code remplacé.
  card('d', [25], {
    reference: 'Pikachu ex (MEG 025)',
    image: oldImage('/images/cards/fr/MEG/25'),
    cardmarket: 201,
    language: 'fr',
  }),
  // Un code inconnu, un id Cardmarket de deux cartes : il ne désigne aucune d'elles.
  card('e', [25], { reference: 'Pikachu (PROMO 99)', cardmarket: 300, language: 'fr' }),
  // Une adresse collée : gardée, la référence suit TCGdex.
  card('f', [1], { reference: 'Bulbizarre SV2a 001', image: oldImage('https://exemple.fr/b') }),
  // Hors du catalogue (ni code, ni image retrouvée) : rien ne change.
  card('g', [1], { reference: 'Mon Bulbizarre', image: oldImage('https://exemple.fr/c') }),
]

const data: CollectionData = {
  ...withCards(collectionWith({ a: ownership('owned', { paidPrice: 3 }) }), ...cards),
  series: [
    { set: 'SV2A', name: 'Pokémon Card 151', startedAt: '2026-10-01', cards: ['a', 'b'] },
    { set: 'MEG', language: 'fr', name: 'Méga-Évolution', startedAt: '2026-10-02', cards: ['d'] },
    { set: 'XY', language: 'fr', name: 'Promos', startedAt: '2026-10-03', cards: ['e'] },
    { set: 'sv2a', name: 'Double', startedAt: '2026-10-04', cards: [] },
  ],
}

describe('la migration vers TCGdex', () => {
  const before = structuredClone(data)
  const result = migrateCollection(data, catalogs)
  const migrated = result.collection.customCards

  test('par son code : la référence de TCGdex, son nom gardé ; son image, ou aucune', () => {
    expect(migrated.a).toEqual({
      ...cards[0]!,
      reference: 'Bulbizarre (SV2a 001)',
      image: {
        small: '/images/cards/ja/SV2a/SV2a-001-md.webp',
        large: '/images/cards/ja/SV2a/SV2a-001-hd.webp',
      },
    })
    expect(migrated.b).toEqual({ ...cards[1]!, reference: 'Herbizarre (SV2a 002)', image: null })
    expect(migrated.c?.reference).toBe('Pikachu (SVP 001)')
    expect(migrated.c?.image?.small).toBe('/images/cards/fr/SVP/SVP-001-md.webp')
  })

  test('par son id Cardmarket, s’il ne désigne qu’une carte de sa langue', () => {
    expect(migrated.d).toMatchObject({
      reference: 'Pikachu ex (me01 025)',
      cardmarket: 201,
      language: 'fr',
      image: { small: '/images/cards/fr/me01/me01-025-md.webp' },
    })
    expect(migrated.e).toEqual(cards[4]!)
  })

  test('une adresse collée reste ; une carte hors du catalogue ne change pas', () => {
    expect(migrated.f).toEqual({ ...cards[5]!, reference: 'Bulbizarre SV2a 001' })
    expect(migrated.g).toBe(cards[6]!)
    expect(result.cards.map(({ card }) => card.id)).not.toContain('g')
  })

  test('les collections d’extensions : l’id et le nom de leur série, jamais celle d’une autre', () => {
    expect(result.collection.series.map(({ set, name }) => [set, name])).toEqual([
      ['SV2a', 'Pokémon Card 151'],
      ['me01', 'Méga-Évolution'],
      ['XY', 'Promos'],
      ['sv2a', 'Double'],
    ])
    // Le reste du document : statuts, favorites, cases.
    expect(result.collection.cards).toEqual(data.cards)
    expect(result.collection.favorites).toEqual(data.favorites)
    expect(result.collection.series[1]?.cards).toEqual(['d'])
  })

  test('le document reçu n’est pas modifié ; le bilan compte chaque carte', () => {
    expect(data).toEqual(before)
    const report = migrationReport(data, result)
    expect(report).toContain('retrouvées avec image : 4')
    expect(report).toContain('retrouvées sans image : 1')
    expect(report).toContain('introuvables, inchangées : 1')
    expect(report).toContain('fr MEG → me01 : 1, 0, 0')
    expect(report).toContain('ja sv2a : SV2a est déjà celle d’une autre collection, inchangée')
    expect(report).toContain('fr Pikachu (PROMO 99) [e]')
  })
})
