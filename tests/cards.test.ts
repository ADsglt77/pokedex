/**
 * Ajouter une carte du catalogue à un Pokémon (`catalogTarget`) : jamais un doublon, une carte
 * TAG TEAM qu'un autre de ses Pokémon a déjà n'est pas recopiée, il s'ajoute à elle, et deux
 * cartes de même id Cardmarket restent deux cartes, chacune trouvée par son code. Retirer la
 * carte d'un Pokémon : une carte TAG TEAM, achetée une fois, reste aux autres. La carte
 * favorite d'un Pokémon (la première d'office, ensuite son choix) : elle suit les cartes qu'on
 * ajoute, qu'on retire ou qu'on corrige, un Pokémon qui a des cartes en ayant toujours une, jamais
 * celle d'un autre. Et les règles de la collection, des commandes et des collections
 * d'extensions ne modifient jamais ce qu'elles reçoivent : « Annuler » remet l'état d'avant,
 * qu'une règle qui le modifierait aurait déjà changé. La langue d'une carte (absente :
 * japonaise), qui la suit quand on la détache d'un Pokémon. Enfin, les chemins des images que la
 * collection garde, ceux que sert l'API des données (ses tests les figent de son côté), et le
 * numéro comparable d'une carte, sa règle aussi ; et une image de chez la source, que son accord
 * interdit d'afficher : refusée, ses domaines reconnus par leur empreinte, pas leurs voisins, et
 * jamais affichée, la petite comme la grande.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { artworkUrl, spriteUrl } from '@/config/pokedex'
import { catalogTarget, collectionCard, unobtainedSlot, type CatalogCard } from '@/lib/card-catalog'
import { numberKey } from '@/lib/card-code'
import {
  catalogImage,
  isSourceImage,
  rarityIcon,
  setLogo,
  showsImage,
  typeIcon,
} from '@/lib/card-images'
import {
  adopt,
  cardLanguage,
  obtain,
  removeCard,
  saveCard,
  setCardStatus,
  setFavorite,
  setPaidPrice,
} from '@/lib/collection'
import { applyOrder } from '@/lib/orders'
import { buildPokedex } from '@/lib/pokedex'
import { removeSeries, startSeries } from '@/lib/series'
import type { CollectionData, PokemonCard } from '@/types'
import {
  card,
  collectionWith,
  line,
  loadTestSpecies,
  NOW,
  order,
  ownership,
  withCards,
} from './fixtures'

beforeAll(loadTestSpecies)

const withCard = (dexIds: number[]): CollectionData =>
  withCards(collectionWith({ a: ownership('owned', { paidPrice: 42.5 }) }), card('a', dexIds))

/** La carte TAG TEAM Pikachu & Zekrom du catalogue, japonaise. */
const tagTeam: CatalogCard = {
  key: 'SM9 031',
  number: '031',
  set: { language: 'ja', id: 'SM9', name: 'Tag Bolt', year: '2019', logo: false },
  dexIds: [25, 644],
  reference: 'Pikachu & Zekrom GX (SM9 031)',
  image: null,
  rarity: null,
  type: null,
}

/** Cette TAG TEAM, ajoutée avant à Pikachu seul. */
const pikachuOnly = card('tag', [25], { reference: tagTeam.reference })

/** Ce que voit l'ajout d'une carte du catalogue à `speciesId`, dans un compte qui a ces cartes. */
function targetIn(cards: PokemonCard[], speciesId: number, listed: CatalogCard | null) {
  const data = withCards(collectionWith(), ...cards)
  return catalogTarget(data, buildPokedex(data).entryById, speciesId, listed)
}

/** Une carte de Platine : Arceus, à l’id Cardmarket d’AR 94 et d’AR AR7. */
const arceus = (number: string): CatalogCard => ({
  key: `fr AR ${number}`,
  number,
  set: { language: 'fr', id: 'AR', name: 'Platine : Arceus', year: '2009', logo: false },
  dexIds: [25],
  reference: `Arceus (AR ${number})`,
  image: null,
  cardmarket: 278966,
  rarity: null,
  type: null,
})

/** Sa case pas encore obtenue d'une collection d'extension, ou sa carte (`seriesOnly: false`). */
const arceusCard = (number: string, seriesOnly = true) =>
  card(`ar-${number}`, [25], {
    reference: `Arceus (AR ${number})`,
    language: 'fr',
    cardmarket: 278966,
    ...(seriesOnly && { seriesOnly }),
  })

describe('ajouter une carte du catalogue', () => {
  test('une TAG TEAM qu’un seul de ses Pokémon a : les autres s’y ajoutent, sans copie', () => {
    expect(targetIn([pikachuOnly], 644, tagTeam)).toEqual({
      duplicate: false,
      receivers: [644],
      existing: pikachuOnly,
    })
    // Qu'aucun n'a : une nouvelle carte, pour tous ses Pokémon.
    expect(targetIn([], 644, tagTeam)).toEqual({
      duplicate: false,
      receivers: [25, 644],
      existing: undefined,
    })
  })

  test('un doublon : refusé au Pokémon qui l’a déjà ; jamais pour une saisie à la main', () => {
    const target = targetIn([pikachuOnly], 25, tagTeam)
    expect(target.duplicate).toBe(true)
    expect(target.existing).toBeUndefined()
    expect(targetIn([pikachuOnly], 25, null)).toEqual({
      duplicate: false,
      receivers: [25],
      existing: undefined,
    })
  })

  test('deux cartes de même id Cardmarket : chacune la sienne, par son code', () => {
    const slots = [arceusCard('94'), arceusCard('AR7')]
    const data = withCards(collectionWith(), ...slots)
    // La case reprise est celle du code, pas la première de même id.
    expect(unobtainedSlot(data, arceus('AR7'))?.id).toBe('ar-AR7')
    expect(unobtainedSlot(data, arceus('94'))?.id).toBe('ar-94')
    // AR7 devenue une carte d'Arceus : AR 94 n'est ni un doublon ni elle, sa case reste à prendre.
    const obtained = [arceusCard('94'), arceusCard('AR7', false)]
    const withAr7 = withCards(collectionWith(), ...obtained)
    expect(targetIn(obtained, 25, arceus('94'))).toEqual({
      duplicate: false,
      receivers: [25],
      existing: undefined,
    })
    expect(collectionCard(withAr7, buildPokedex(withAr7).entryById, arceus('94'))).toBeNull()
    expect(unobtainedSlot(withAr7, arceus('94'))?.id).toBe('ar-94')
  })

  test('sans carte de ce code dans le compte, la carte de même id Cardmarket est la sienne', () => {
    // Notée sans code, ou d'un code que le catalogue a changé depuis.
    const noted = card('noted', [25], {
      reference: 'Arceus Niv.X',
      language: 'fr',
      cardmarket: 278966,
    })
    expect(targetIn([noted], 25, arceus('94')).duplicate).toBe(true)
  })
})

describe('retirer une carte', () => {
  test('partagée, elle reste aux autres Pokémon avec son statut et son prix payé', () => {
    const data = removeCard(withCard([25, 644]), 'a', 25, NOW)
    expect(data.customCards.a?.dexIds).toEqual([644])
    expect(data.cards.a).toEqual(ownership('owned', { paidPrice: 42.5 }))
    expect(data.updatedAt).toBe(NOW)
  })

  test('celle d’un seul Pokémon part avec son statut et son prix payé', () => {
    const data = removeCard(withCard([25]), 'a', 25, NOW)
    expect(data.customCards.a).toBeUndefined()
    expect(data.cards.a).toBeUndefined()
  })
})

describe('la carte favorite', () => {
  test('la première carte d’un Pokémon devient sa favorite ; une deuxième ne la change pas', () => {
    const first = saveCard(collectionWith(), card('a', [25]), NOW)
    const second = saveCard(first, card('b', [25]), NOW)
    expect(first.favorites).toEqual({ 25: 'a' })
    expect(second.favorites).toEqual({ 25: 'a' })
    expect(Object.keys(second.customCards)).toEqual(['a', 'b'])
  })

  test('une carte TAG TEAM devient la favorite de ceux de ses Pokémon qui n’en ont pas', () => {
    const data = withCards(collectionWith(), card('a', [25]))
    expect(saveCard(data, card('tag', [25, 644]), NOW).favorites).toEqual({ 25: 'a', 644: 'tag' })
  })

  test('corriger une carte (même id) garde les favorites', () => {
    const data = withCards(collectionWith(), card('a', [25]), card('b', [25]))
    const corrected = saveCard(data, card('b', [25], { reference: 'Corrigée' }), NOW)
    expect(corrected.favorites).toEqual({ 25: 'a' })
    expect(corrected.customCards.b?.reference).toBe('Corrigée')
    expect(saveCard(corrected, card('a', [25], { reference: 'Autre' }), NOW).favorites).toEqual({
      25: 'a',
    })
  })

  test('changer la favorite d’un Pokémon ne touche pas aux autres', () => {
    const data = withCards(collectionWith(), card('tag', [25, 644]), card('a', [25]))
    expect(data.favorites).toEqual({ 25: 'tag', 644: 'tag' })
    const changed = setFavorite(data, 25, 'a', NOW)
    expect(changed.favorites).toEqual({ 25: 'a', 644: 'tag' })
    expect(changed.updatedAt).toBe(NOW)
  })

  test('retirer la favorite : celle désignée la remplace', () => {
    const data = withCards(collectionWith(), card('a', [25]), card('b', [25]))
    const removed = removeCard(data, 'a', 25, NOW, 'b')
    expect(removed.favorites).toEqual({ 25: 'b' })
    expect(removed.customCards.a).toBeUndefined()
  })

  test('retirer une autre carte garde la favorite', () => {
    const data = withCards(collectionWith(), card('a', [25]), card('b', [25]))
    const removed = removeCard(data, 'b', 25, NOW)
    expect(removed.favorites).toEqual({ 25: 'a' })
    expect(removed.customCards.b).toBeUndefined()
  })

  test('retirer la dernière carte d’un Pokémon : il n’a plus de favorite', () => {
    const data = withCards(collectionWith(), card('a', [25]), card('b', [1]))
    const removed = removeCard(data, 'a', 25, NOW)
    expect(removed.favorites).toEqual({ 1: 'b' })
    expect(Object.keys(removed.favorites)).not.toContain('25')
  })

  test('une TAG TEAM retirée d’un Pokémon reste la favorite des autres', () => {
    const data = withCards(collectionWith(), card('tag', [25, 644]), card('a', [25]))
    const removed = removeCard(data, 'tag', 25, NOW, 'a')
    expect(removed.favorites).toEqual({ 25: 'a', 644: 'tag' })
    expect(removed.customCards.tag?.dexIds).toEqual([644])
  })
})

describe('la langue d’une carte', () => {
  test('absente : japonaise ; « fr » : française, y compris détachée d’un de ses Pokémon', () => {
    expect(cardLanguage(card('a', [25]))).toBe('ja')
    const french = card('a', [25, 644], { language: 'fr' })
    expect(cardLanguage(french)).toBe('fr')
    const data = withCards(collectionWith(), french)
    expect(cardLanguage(removeCard(data, 'a', 25, NOW).customCards.a!)).toBe('fr')
  })
})

describe('les règles ne modifient pas ce qu’elles reçoivent (« Annuler »)', () => {
  test('statut, prix payé, carte enregistrée, retirée, favorite, commande, extension', () => {
    const owned = collectionWith({ a: ownership('owned', { paidPrice: 42.5 }) })
    const data = withCards(owned, card('a', [25, 644]), card('b', [25]))
    const before = structuredClone(data)
    setCardStatus(data, data.customCards.a!, null, NOW)
    setPaidPrice(data, data.customCards.a!, 10, NOW)
    saveCard(data, card('c', [1]), NOW)
    removeCard(data, 'a', 25, NOW)
    setFavorite(data, 25, 'b', NOW)
    removeCard(data, 'a', 25, NOW, 'b')
    const placed = order({ lines: [line('a', 12)] })
    const placedBefore = structuredClone(placed)
    applyOrder(data, null, placed, [], NOW)
    const start = { set: 'M6A', language: 'ja', name: 'Méga Rêve ex' } as const
    const slot = card('s', [1], { reference: 'Bulbizarre (M6A 001)', seriesOnly: true })
    const slots = [slot, card('t', [25], { reference: 'Pikachu (M6A 025)', seriesOnly: true })]
    const slotsBefore = structuredClone(slots)
    const started = startSeries(data, start, slots, NOW)
    const startedBefore = structuredClone(started)
    obtain(started, ['s'])
    adopt(started, 's', NOW)
    removeSeries(setCardStatus(started, slot, 'ordered', NOW), 'M6A', 'ja', [], NOW)
    removeSeries(started, 'M6A', 'ja', [], NOW)
    expect(data).toEqual(before)
    expect(placed).toEqual(placedBefore)
    expect(slots).toEqual(slotsBefore)
    expect(started).toEqual(startedBefore)
  })
})

describe('les images', () => {
  test('les chemins que sert l’API des données, ceux du français sous fr/', () => {
    expect(catalogImage('ja', 'SVP', 1)).toEqual({
      small: '/images/cards/SVP/1-md.webp',
      large: '/images/cards/SVP/1-hd.webp',
    })
    expect(catalogImage('fr', 'SVP', 1)).toEqual({
      small: '/images/cards/fr/SVP/1-md.webp',
      large: '/images/cards/fr/SVP/1-hd.webp',
    })
    expect([setLogo('ja', 'SVP', 'md'), setLogo('fr', 'SVP', 'hd')]).toEqual([
      '/images/sets/SVP-md.webp',
      '/images/sets/fr/SVP-hd.webp',
    ])
    expect([typeIcon(3), rarityIcon(33), spriteUrl(25), artworkUrl(25)]).toEqual([
      '/images/types/3.webp',
      '/images/rarities/33.webp',
      '/images/species/25.png',
      '/images/species/artwork/25.webp',
    ])
  })

  test('le numéro d’une carte : 017 et 17 sont la même carte, tg01 et TG01 aussi', () => {
    expect([numberKey('017'), numberKey('tg01')]).toEqual(['17', 'TG01'])
  })

  test('une adresse de chez la source : refusée, son site comme ses serveurs d’images', () => {
    const source = [
      'https://pokecardex.com/carte.jpg',
      'https://www.pokecardex.com/carte.jpg',
      'https://pokecardex.b-cdn.net/logo.png',
      'https://pokecardex-scans.b-cdn.net/scan.jpg',
      'https://pokecardex.com./carte.jpg',
    ]
    expect(source.filter((url) => !isSourceImage(url))).toEqual([])
    // Le serveur d'images partagé seul, un domaine voisin, un chemin du site : affichés.
    const others = [
      'https://b-cdn.net/carte.jpg',
      'https://autre.b-cdn.net/carte.jpg',
      '/images/cards/SVP/1-md.webp',
    ]
    expect(others.filter(isSourceImage)).toEqual([])
    expect(showsImage(catalogImage('ja', 'SVP', 1))).toBe(true)
    // Une carte retouchée, la petite image (celle de la grille) ou la grande (celle de la fiche)
    // seule de chez la source.
    expect(showsImage({ ...catalogImage('ja', 'SVP', 1), small: source[3]! })).toBe(false)
    expect(showsImage({ ...catalogImage('ja', 'SVP', 1), large: source[3]! })).toBe(false)
    expect(showsImage(null)).toBe(false)
  })
})
