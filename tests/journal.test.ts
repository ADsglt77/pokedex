/**
 * Le visiteur d'une requête (`visitorOf`, `server/journal.ts`), derrière Caddy : la clé qui limite
 * le journal par visiteur (`journalOnce` : les connexions refusées, les visites d'un Pokédex
 * public). Fausse, tous les visiteurs n'en feraient qu'un (les lignes de l'un tairaient celles des
 * autres), ou un seul en ferait des milliers (une adresse IPv6 par requête : un afflux ferait
 * tourner le journal de Docker, qui effacerait les connexions).
 */

import { describe, expect, test } from 'bun:test'
import { visitorOf } from '../server/journal'

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
