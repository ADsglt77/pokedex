/**
 * Les collections d'extensions : commencer une extension (une case par carte, dans l'ordre, sans
 * remplir le Pokédex), une carte déjà dans le compte reprise comme sa case (jamais d'une autre
 * langue, jamais deux cases), une case obtenue (statut ou commande reçue) ou ajoutée seule qui
 * devient pour de bon une carte de son Pokémon (sans copie), la suppression d'une collection (rien
 * de possédé ni du registre des commandes ne se perd, et ce que sa confirmation en dit) et sa
 * progression. Une erreur ici doublerait une carte, remplirait le Pokédex de cartes qu'on n'a pas,
 * ou perdrait une carte payée.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { adopt, completeFavorites, setCardStatus } from '@/lib/collection'
import { applyOrder } from '@/lib/orders'
import { buildPokedex } from '@/lib/pokedex'
import { findSeries, removeSeries, seriesProgress, seriesRemoval, startSeries } from '@/lib/series'
import type { CardLanguage, CardStatus, CollectionData, PokemonCard, PriceFile } from '@/types'
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

/**
 * La case d'une carte de l'extension M6A dans cette langue, comme le début d'une collection la fait
 * d'après le catalogue : une nouvelle carte, pas encore obtenue (`dexIds` vide : un dresseur). Son
 * id : « ja 001 ».
 */
const slotFor = (
  number: string,
  dexIds: number[],
  cardmarket?: number,
  language: CardLanguage = 'ja',
): PokemonCard =>
  card(`${language} ${number}`, dexIds, {
    reference: `Carte (M6A ${number})`,
    ...(cardmarket !== undefined && { cardmarket }),
    ...(language === 'fr' && { language }),
    seriesOnly: true,
  })

/** La collection de l'extension M6A commencée dans cette langue, avec ces cases. */
const started = (data: CollectionData, slots: PokemonCard[], language: CardLanguage = 'ja') =>
  startSeries(data, { set: 'M6A', language, name: 'Méga Rêve ex' }, slots, NOW)

/** Le statut d'une carte, par son id. */
const withStatus = (data: CollectionData, id: string, status: CardStatus | null) =>
  setCardStatus(data, data.customCards[id]!, status, NOW)

/** Les cartes d'un Pokémon au Pokédex, par leur id. */
const cardsOf = (data: CollectionData, speciesId: number) =>
  buildPokedex(data)
    .entryById.get(speciesId)!
    .cards.map((view) => view.card.id)

describe('commencer une extension', () => {
  test('commencer une extension : une case par carte, dans l’ordre, aucune au Pokédex', () => {
    const before = withCards(collectionWith(), card('a', [1]))
    const data = started(before, [
      slotFor('001', [25]),
      slotFor('002', [25, 644]),
      slotFor('100', []),
    ])
    expect(data.series).toHaveLength(1)
    const series = data.series[0]!
    expect(series).toEqual({
      set: 'M6A',
      name: 'Méga Rêve ex',
      startedAt: NOW,
      cards: ['ja 001', 'ja 002', 'ja 100'],
    })
    // Japonaise : sans langue, comme une carte.
    expect(series).not.toHaveProperty('language')
    expect(series.cards.every((id) => data.customCards[id]?.seriesOnly)).toBe(true)
    expect(findSeries(data, 'M6A', 'ja')).toBe(series)
    expect(findSeries(data, 'M6A', 'fr')).toBeNull()
    // Rien au Pokédex : ni carte, ni favorite.
    expect(cardsOf(data, 25)).toEqual([])
    expect(cardsOf(data, 644)).toEqual([])
    expect(cardsOf(data, 1)).toEqual(['a'])
    expect(data.favorites).toEqual(before.favorites)
    // Complétées d'après toutes les cartes (la relecture d'un document), aucune case favorite.
    expect(completeFavorites({}, Object.values(data.customCards))).toEqual({ 1: 'a' })
    expect(data.updatedAt).toBe(NOW)
  })

  test('une carte déjà dans le compte est reprise comme sa case, par son code ou son id Cardmarket', () => {
    const byCode = card('a', [25], { reference: 'Pikachu (m6a 25)' })
    const byId = card('b', [1], { reference: 'Bulbizarre (SV2A 001)', cardmarket: 777 })
    const statuses = { a: ownership('owned', { paidPrice: 3 }), b: ownership('ordered') }
    const before = withCards(collectionWith(statuses), byCode, byId)
    const data = started(before, [
      slotFor('001', [1], 777),
      slotFor('025', [25], 888),
      slotFor('100', []),
    ])
    expect(data.series[0]!.cards).toEqual(['b', 'a', 'ja 100'])
    // Aucune carte en plus que le dresseur, qui n'était pas dans le compte.
    expect(Object.keys(data.customCards)).toEqual(['a', 'b', 'ja 100'])
    expect(data.customCards.a).toBe(byCode)
    expect(data.customCards.b).toBe(byId)
    expect(data.cards).toEqual(before.cards)
    expect(data.favorites).toEqual(before.favorites)
  })

  test('une carte du compte ne prend qu’une case, celle de son code d’abord', () => {
    // Deux cases du catalogue ont le même id Cardmarket (c'est arrivé : « AR 94 » et « AR AR7 ») :
    // la carte de code M6A 025 va à la sienne, l'autre carte de cet id à l'autre case.
    const byCode = card('a', [25], { reference: 'Pikachu (M6A 025)', cardmarket: 999 })
    const byId = card('b', [25], { reference: 'Mon Pikachu', cardmarket: 999 })
    const slots = [slotFor('024', [25], 999), slotFor('025', [25], 999)]
    expect(started(withCards(collectionWith(), byCode), slots).series[0]!.cards).toEqual([
      'ja 024',
      'a',
    ])
    expect(started(withCards(collectionWith(), byCode, byId), slots).series[0]!.cards).toEqual([
      'b',
      'a',
    ])
  })

  test('une case pas encore obtenue d’une autre extension n’est jamais reprise', () => {
    // Deux extensions ont une carte de même id Cardmarket (c'est arrivé : SC2 012 et SC-C 012).
    const first = started(collectionWith(), [slotFor('012', [25], 999)])
    const other = card('other', [25], { reference: 'Carte (M6B 012)', cardmarket: 999 })
    const both = startSeries(
      first,
      { set: 'M6B', language: 'ja', name: 'Autre' },
      [{ ...other, seriesOnly: true }],
      NOW,
    )
    expect(both.series[1]!.cards).toEqual(['other'])
    // Supprimer la première ne retire rien à la seconde.
    const removed = removeSeries(both, 'M6A', 'ja', [], NOW)
    expect(removed.customCards['ja 012']).toBeUndefined()
    expect(removed.customCards.other?.seriesOnly).toBe(true)
  })

  test('une carte japonaise n’est jamais la case d’une extension française de même code', () => {
    const japanese = card('a', [25], { reference: 'Pikachu (M6A 025)', cardmarket: 888 })
    const before = withCards(collectionWith(), japanese)
    const french = started(before, [slotFor('025', [25], 888, 'fr')], 'fr')
    expect(french.series[0]!.cards).toEqual(['fr 025'])
    expect(french.series[0]!.language).toBe('fr')
    expect(french.customCards['fr 025']).toMatchObject({ language: 'fr', seriesOnly: true })
    expect(french.customCards.a).toBe(japanese)
    // La japonaise, commencée ensuite, la reprend : à la fin des collections.
    const both = started(french, [slotFor('025', [25], 888)])
    expect(both.series.map((series) => series.language)).toEqual(['fr', undefined])
    expect(both.series[1]!.cards).toEqual(['a'])
    expect(findSeries(both, 'M6A', 'fr')).toBe(both.series[0]!)
  })
})

describe('obtenir une case', () => {
  test('possédée, une case devient une carte de son Pokémon, favorite s’il n’en a pas', () => {
    const data = started(withCards(collectionWith(), card('a', [1])), [
      slotFor('001', [25]),
      slotFor('002', [1]),
      slotFor('100', []),
    ])
    let owned = data
    for (const id of ['ja 001', 'ja 002', 'ja 100']) {
      owned = withStatus(owned, id, 'owned')
      expect(owned.customCards[id]).not.toHaveProperty('seriesOnly')
    }
    // Pikachu n'avait pas de favorite ; Bulbizarre garde la sienne ; le dresseur n'en donne pas.
    expect(owned.favorites).toEqual({ 1: 'a', 25: 'ja 001' })
    expect(cardsOf(owned, 25)).toEqual(['ja 001'])
    expect(cardsOf(owned, 1)).toEqual(['a', 'ja 002'])
    // Quittée (« sans statut »), elle reste une carte de son Pokémon.
    const left = withStatus(owned, 'ja 001', null)
    expect(left.customCards['ja 001']).not.toHaveProperty('seriesOnly')
    expect(left.favorites[25]).toBe('ja 001')
    expect(cardsOf(left, 25)).toEqual(['ja 001'])
  })

  test('reçue dans une commande, une case devient une carte de son Pokémon', () => {
    const data = started(collectionWith(), [slotFor('001', [25])])
    const pending = order({ lines: [line('ja 001', 5)] })
    // Commandée, elle n'est pas encore à lui.
    const ordered = applyOrder(data, null, pending, [], NOW)
    expect(ordered.cards['ja 001']?.status).toBe('ordered')
    expect(ordered.customCards['ja 001']?.seriesOnly).toBe(true)
    expect(ordered.favorites).toEqual({})
    const received = { ...pending, state: 'received' as const, receivedAt: '2026-10-10' }
    const owned = applyOrder(ordered, pending, received, [], NOW)
    expect(owned.cards['ja 001']?.status).toBe('owned')
    expect(owned.customCards['ja 001']).not.toHaveProperty('seriesOnly')
    expect(owned.favorites).toEqual({ 25: 'ja 001' })
    expect(cardsOf(owned, 25)).toEqual(['ja 001'])
  })
})

describe('ajouter seule une case', () => {
  test('ajoutée seule, une case devient une carte de son Pokémon, sans copie ni autre statut', () => {
    const data = started(withCards(collectionWith(), card('a', [1])), [
      slotFor('001', [25]),
      slotFor('002', [1]),
    ])
    const ordered = withStatus(data, 'ja 002', 'ordered')
    let adopted = adopt(ordered, 'ja 001', NOW)
    adopted = adopt(adopted, 'ja 002', NOW)
    // La même carte, plus une case pas encore obtenue : aucune carte en plus.
    expect(Object.keys(adopted.customCards)).toEqual(Object.keys(ordered.customCards))
    expect(adopted.customCards['ja 001']).not.toHaveProperty('seriesOnly')
    expect(adopted.customCards['ja 002']).not.toHaveProperty('seriesOnly')
    // Toujours une case de sa collection, avec son statut (aucun, ou commandée).
    expect(adopted.series).toEqual(ordered.series)
    expect(adopted.cards).toEqual(ordered.cards)
    // Favorite de Pikachu, qui n'en avait pas ; Bulbizarre garde la sienne.
    expect(adopted.favorites).toEqual({ 1: 'a', 25: 'ja 001' })
    expect(cardsOf(adopted, 25)).toEqual(['ja 001'])
    expect(cardsOf(adopted, 1)).toEqual(['a', 'ja 002'])
    expect(adopted.updatedAt).toBe(NOW)
    // La collection supprimée, elle reste, telle quelle : une carte ajoutée seule.
    const removed = removeSeries(adopted, 'M6A', 'ja', [], NOW)
    expect(removed.customCards['ja 001']).toBe(adopted.customCards['ja 001']!)
    expect(removed.favorites[25]).toBe('ja 001')
  })
})

describe('supprimer une collection', () => {
  test('supprimer une collection : possédées et commandées restent, le registre ne perd rien', () => {
    const alone = card('alone', [4], { reference: 'Salamèche (M6A 004)' })
    const data = started(withCards(collectionWith(), alone), [
      slotFor('001', [1]),
      slotFor('004', [4]),
      slotFor('025', [25]),
      slotFor('026', [644]),
      slotFor('100', []),
    ])
    expect(data.series[0]!.cards).toEqual(['ja 001', 'alone', 'ja 025', 'ja 026', 'ja 100'])
    const pending = order({ lines: [line('ja 025', 5)] })
    const placed = order({ lines: [line('ja 026', 3)] })
    const dropped = { ...placed, state: 'cancelled' as const }
    let current = withStatus(data, 'ja 001', 'owned')
    current = applyOrder(current, null, pending, [], NOW)
    current = applyOrder(current, null, placed, [pending], NOW)
    current = applyOrder(current, placed, dropped, [pending], NOW)
    const orders = [pending, dropped]

    // Ce que la confirmation annonce : ce que fait la suppression.
    expect(seriesRemoval(current, current.series[0]!, orders)).toEqual({
      owned: ['ja 001'],
      alone: ['alone'],
      kept: ['ja 025', 'ja 026'],
      dropped: ['ja 100'],
    })
    const removed = removeSeries(current, 'M6A', 'ja', orders, NOW)
    expect(removed.series).toEqual([])
    // Possédée : gardée telle quelle.
    expect(removed.customCards['ja 001']).toBe(current.customCards['ja 001']!)
    expect(removed.cards['ja 001']?.status).toBe('owned')
    // Commandée, ou dans une commande annulée : gardée comme carte seule de son Pokémon.
    expect(removed.customCards['ja 025']).not.toHaveProperty('seriesOnly')
    expect(removed.cards['ja 025']?.status).toBe('ordered')
    expect(removed.customCards['ja 026']).not.toHaveProperty('seriesOnly')
    expect(removed.cards['ja 026']).toBeUndefined()
    // Sans statut ni commande : supprimée.
    expect(removed.customCards['ja 100']).toBeUndefined()
    // La carte ajoutée seule ne bouge pas.
    expect(removed.customCards.alone).toBe(alone)
    expect(removed.favorites).toEqual({ 1: 'ja 001', 4: 'alone', 25: 'ja 025', 644: 'ja 026' })
    // Le registre ne perd rien : chaque carte d'une commande est encore là.
    for (const { lines } of orders) {
      for (const { cardId } of lines) expect(removed.customCards[cardId]).toBeDefined()
    }
    expect(removed.updatedAt).toBe(NOW)
  })
})

describe('la progression', () => {
  test('la progression d’une collection : chaque carte une fois', () => {
    const data = started(collectionWith(), [
      slotFor('001', [1], 101),
      slotFor('002', [25, 644], 102),
      slotFor('003', [4], 103),
      slotFor('004', [25], 104),
      slotFor('100', [], 105),
      slotFor('101', []),
    ])
    let current = withStatus(data, 'ja 001', 'owned')
    current = withStatus(current, 'ja 002', 'owned')
    current = withStatus(current, 'ja 003', 'ordered')
    const prices: PriceFile = {
      date: '2026-10-11',
      cards: {
        101: [10, null, null],
        102: [2.5, null, null],
        103: [7, null, null],
        104: [4, null, null],
        105: null,
      },
    }
    // La TAG TEAM compte une fois ; la commandée n'est pas à compléter ; deux cases sans prix.
    expect(seriesProgress(current, current.series[0]!, prices)).toEqual({
      owned: 2,
      total: 6,
      value: 12.5,
      toComplete: 4,
      unpriced: 2,
    })
  })
})
