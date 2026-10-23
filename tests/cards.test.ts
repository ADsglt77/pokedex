/**
 * Retirer la carte d'un Pokémon : une carte TAG TEAM, achetée une fois, reste aux autres. La carte
 * favorite d'un Pokémon (la première d'office, ensuite son choix) : elle suit les cartes qu'on
 * ajoute, qu'on retire ou qu'on corrige, un Pokémon qui a des cartes en ayant toujours une, jamais
 * celle d'un autre. Et les règles de la collection et des commandes ne modifient jamais ce qu'elles
 * reçoivent : « Annuler » remet l'état d'avant, qu'une règle qui le modifierait aurait déjà changé.
 * Enfin, la langue d'une carte (absente : japonaise), qui la suit quand on la détache d'un Pokémon.
 */

import { describe, expect, test } from 'bun:test'
import {
  cardLanguage,
  removeCard,
  saveCard,
  setCardStatus,
  setFavorite,
  setPaidPrice,
} from '@/lib/collection'
import { applyOrder, isInAnOrder } from '@/lib/orders'
import type { CollectionData } from '@/types'
import { card, collectionWith, line, NOW, order, ownership, withCards } from './fixtures'

const withCard = (dexIds: number[]): CollectionData =>
  withCards(collectionWith({ a: ownership('owned', { paidPrice: 42.5 }) }), card('a', dexIds))

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
  test('statut, prix payé, carte enregistrée, retirée, favorite, commande reportée', () => {
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
    expect(data).toEqual(before)
    expect(placed).toEqual(placedBefore)
  })

  test('une carte d’une commande (en cours, reçue ou annulée) : retenue', () => {
    const orders = [order({ lines: [line('a', 12)], state: 'cancelled' })]
    expect(isInAnOrder(orders, 'a')).toBe(true)
    expect(isInAnOrder(orders, 'b')).toBe(false)
  })
})
