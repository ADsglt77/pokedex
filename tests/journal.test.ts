/**
 * Le visiteur d'une requête (`visitorOf`, `server/journal.ts`), derrière Caddy : la clé qui limite
 * le journal par visiteur (`journalOnce` : les connexions refusées, les visites d'un Pokédex
 * public). Fausse, tous les visiteurs n'en feraient qu'un (les lignes de l'un tairaient celles des
 * autres), ou un seul en ferait des milliers (une adresse IPv6 par requête : un afflux ferait
 * tourner le journal de Docker, qui effacerait les connexions). Et ce que dit le journal d'un
 * changement de collection (`documentChanges`) : commencer une collection d'extension, ce sont des
 * centaines de cartes ajoutées, une ligne seulement ; une erreur ici ferait tourner le journal.
 */

import { describe, expect, test } from 'bun:test'
import { emptyCollection, saveCard, setCardStatus } from '@/lib/collection'
import { emptyShopping } from '@/lib/orders'
import { removeSeries, startSeries } from '@/lib/series'
import { documentChanges, visitorOf } from '../server/journal'
import { card, collectionWith, NOW } from './fixtures'

describe('adresse du visiteur derrière Caddy', () => {
  test('lit la première adresse transmise par le proxy', () => {
    const request = new Request('https://pokecodex.fr', {
      headers: { 'x-forwarded-for': '198.51.100.24, 127.0.0.1' },
    })

    expect(visitorOf(request)).toBe('198.51.100.24')
  })

  test('regroupe les IPv6 par réseau /64', () => {
    const request = new Request('https://pokecodex.fr', {
      headers: { 'x-forwarded-for': '2001:db8:1234:5678:abcd::1' },
    })

    expect(visitorOf(request)).toBe('2001:db8:1234:5678::/64')
  })

  test('reste vide sans reverse proxy en développement', () => {
    expect(visitorOf(new Request('http://localhost'))).toBe('')
  })
})

describe('ce que le journal dit des collections d’extensions', () => {
  const shopping = emptyShopping()
  const before = { collection: collectionWith(), shopping }
  const slots = [
    card('s1', [1], { reference: 'Bulbizarre (SV2A 001)', seriesOnly: true }),
    card('s2', [4], { reference: 'Salamèche (SV2A 004)', seriesOnly: true }),
    card('s3', [], { reference: 'Énergie Feu (SV2A 207)', seriesOnly: true }),
  ]
  const started = startSeries(
    before.collection,
    { set: 'SV2A', language: 'ja', name: 'Pokémon Card 151' },
    slots,
    NOW,
  )
  const after = { collection: started, shopping }
  const messages = (changes: ReturnType<typeof documentChanges>) =>
    changes.map(({ message }) => message)

  test('commencer une collection de 3 cartes : une ligne, pas quatre', () => {
    const changes = documentChanges(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      topic: 'collection',
      level: 'ok',
      message: 'Collection commencée',
      details: { extension: 'Pokémon Card 151', langue: 'ja', cartes: 3 },
    })
    // Une carte ajoutée à côté garde sa ligne.
    const added = { ...after, collection: saveCard(started, card('x', [25]), NOW) }
    expect(messages(documentChanges(before, added))).toEqual([
      'Collection commencée',
      'Carte ajoutée',
    ])
  })

  test('une collection française dit sa langue', () => {
    const french = startSeries(
      before.collection,
      { set: 'SV2A', language: 'fr', name: 'Pokémon 151' },
      slots.map((slot) => ({ ...slot, language: 'fr' as const })),
      NOW,
    )
    const [line] = documentChanges(before, { ...after, collection: french })
    expect(line?.details).toEqual({ extension: 'Pokémon 151', langue: 'fr', cartes: 3 })
  })

  test('supprimer une collection : une ligne ; ses cases retirées ou gardées n’ont pas la leur', () => {
    // `s2` est commandée : elle reste comme carte seule, sans `seriesOnly`.
    const ordered = setCardStatus(started, started.customCards.s2!, 'ordered', NOW)
    const removed = removeSeries(ordered, 'SV2A', 'ja', [], NOW)
    expect(Object.keys(removed.customCards)).toEqual(['s2'])
    const changes = documentChanges(
      { collection: ordered, shopping },
      { collection: removed, shopping },
    )
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      topic: 'collection',
      level: 'warn',
      message: 'Collection supprimée',
      details: { extension: 'Pokémon Card 151', langue: 'ja', cartes: 3 },
    })
  })

  test('une case obtenue : « Carte possédée » seulement, pas « Carte modifiée »', () => {
    const owned = setCardStatus(started, started.customCards.s1!, 'owned', NOW)
    expect(owned.customCards.s1).not.toHaveProperty('seriesOnly')
    const changes = documentChanges(after, { ...after, collection: owned })
    expect(messages(changes)).toEqual(['Carte possédée'])
    expect(changes[0]?.details?.carte).toBe('Bulbizarre (SV2A 001)')
  })

  test('supprimer la seule collection d’un compte dont rien n’est possédé ni commandé : « Collection supprimée »', () => {
    // Toutes ses cases sont pas encore obtenues : elles partent avec elle, la collection du compte
    // n'est pas « effacée » pour autant.
    const removed = removeSeries(started, 'SV2A', 'ja', [], NOW)
    expect(removed.customCards).toEqual({})
    const changes = documentChanges(after, { ...after, collection: removed })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      level: 'warn',
      message: 'Collection supprimée',
      details: { extension: 'Pokémon Card 151', langue: 'ja', cartes: 3 },
    })
  })

  test('effacer la collection : une ligne, ses collections avec elle', () => {
    // Une vraie carte part avec elle : la collection est effacée, et le dit seulement.
    const withCard = { ...after, collection: saveCard(started, card('x', [25]), NOW) }
    const changes = documentChanges(withCard, { ...after, collection: emptyCollection() })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ message: 'Collection effacée', details: { cartes: 4 } })
  })
})
