/**
 * Le Pokédex de plusieurs cartes (`buildPokedex`) : un Pokémon montre sa favorite et garde toutes
 * ses cartes, dans l'ordre d'ajout ; il est débloqué dès qu'une de ses cartes est possédée,
 * favorite ou non, sinon « commandé » si l'une l'est ; une carte TAG TEAM est la favorite de chacun
 * de ses Pokémon, chacun pour soi. Une entrée inchangée est reprise telle quelle (les pochettes
 * mémoïsées ne se redessinent pas). Et le jour où un Pokémon est débloqué (`unlockEvents`) : celui
 * de sa première carte obtenue. Une erreur ici dirait « à débloquer » un Pokémon qu'on a, ou
 * l'inverse.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { setCardStatus, setFavorite } from '@/lib/collection'
import { localDayOf } from '@/lib/format'
import { buildPokedex, type CardView, unlockEvents } from '@/lib/pokedex'
import type { CollectionData } from '@/types'
import { card, collectionWith, loadTestSpecies, NOW, ownership, withCards } from './fixtures'

beforeAll(loadTestSpecies)

const entryOf = (data: CollectionData, id: number) => buildPokedex(data).entryById.get(id)!
const ids = (views: CardView[]) => views.map((view) => view.card.id)

describe('le Pokédex de plusieurs cartes', () => {
  test('la favorite est la carte montrée ; toutes ses cartes sont là, dans l’ordre d’ajout', () => {
    const several = withCards(collectionWith(), card('a', [25]), card('b', [25]))
    const pikachu = entryOf(setFavorite(several, 25, 'b', NOW), 25)
    expect(pikachu.card?.card.id).toBe('b')
    expect(ids(pikachu.cards)).toEqual(['a', 'b'])
  })

  test('un Pokémon sans carte : ni favorite, ni carte, à débloquer', () => {
    const bulbasaur = entryOf(withCards(collectionWith(), card('a', [25])), 1)
    expect(bulbasaur.card).toBeNull()
    expect(bulbasaur.cards).toEqual([])
    expect(bulbasaur.status).toBeNull()
    expect(bulbasaur.unlocked).toBe(false)
  })

  test('débloqué dès qu’une de ses cartes est possédée, même pas sa favorite', () => {
    const data = withCards(
      collectionWith({ b: ownership('owned') }),
      card('a', [25]),
      card('b', [25]),
    )
    const pokedex = buildPokedex(data)
    const pikachu = pokedex.entryById.get(25)!
    // La favorite (a) est montrée telle qu'elle est : sans statut.
    expect(pikachu.card?.card.id).toBe('a')
    expect(pikachu.card?.status).toBeNull()
    expect(pikachu.status).toBe('owned')
    expect(pikachu.unlocked).toBe(true)
    expect(pokedex.progress.unlocked).toBe(1)
  })

  test('aucune possédée, une commandée : à débloquer, commandée', () => {
    const data = withCards(
      collectionWith({ b: ownership('ordered') }),
      card('a', [25]),
      card('b', [25]),
    )
    const pikachu = entryOf(data, 25)
    expect(pikachu.status).toBe('ordered')
    expect(pikachu.unlocked).toBe(false)
  })

  test('une carte possédée l’emporte sur une commandée', () => {
    const data = withCards(
      collectionWith({ a: ownership('ordered'), b: ownership('owned') }),
      card('a', [25]),
      card('b', [25]),
    )
    expect(entryOf(data, 25).status).toBe('owned')
  })

  test('une carte TAG TEAM : favorite de l’un, une carte de plus pour l’autre', () => {
    const data = withCards(collectionWith(), card('a', [25]), card('tag', [25, 644]))
    const pokedex = buildPokedex(data)
    const pikachu = pokedex.entryById.get(25)!
    const zekrom = pokedex.entryById.get(644)!
    expect(pikachu.card?.card.id).toBe('a')
    expect(ids(pikachu.cards)).toEqual(['a', 'tag'])
    expect(zekrom.card?.card.id).toBe('tag')
    expect(ids(zekrom.cards)).toEqual(['tag'])
  })

  test('une entrée inchangée est reprise telle quelle, une changée est refaite', () => {
    const data = withCards(collectionWith(), card('a', [25]), card('b', [25]), card('z', [644]))
    const first = buildPokedex(data)
    const pikachu = first.entryById.get(25)
    const zekrom = first.entryById.get(644)

    // Le même document relu du serveur : d'autres objets, rien de changé.
    const reread = buildPokedex(JSON.parse(JSON.stringify(data)), first)
    expect(reread.entryById.get(25)).toBe(pikachu)
    expect(reread.entryById.get(644)).toBe(zekrom)

    // Une autre favorite, ou le statut d'une carte qui n'est pas la favorite : refaite.
    const favorite = buildPokedex(setFavorite(data, 25, 'b', NOW), first)
    expect(favorite.entryById.get(25)).not.toBe(pikachu)
    expect(favorite.entryById.get(644)).toBe(zekrom)
    const owned = buildPokedex(setCardStatus(data, card('b', [25]), 'owned', NOW), first)
    expect(owned.entryById.get(25)).not.toBe(pikachu)
    expect(owned.entryById.get(644)).toBe(zekrom)
  })
})

describe('les Pokémon débloqués au fil des jours', () => {
  test('un Pokémon débloqué une fois, au jour de sa première carte obtenue', () => {
    const first = '2026-10-01T12:00:00.000Z'
    const second = '2026-10-05T12:00:00.000Z'
    const data = withCards(
      collectionWith({
        a: ownership('owned', { acquiredAt: second }),
        b: ownership('owned', { acquiredAt: first }),
      }),
      card('a', [25]),
      card('b', [25]),
    )
    expect(unlockEvents(data)).toEqual([{ date: localDayOf(first), value: 1 }])
  })
})
