/**
 * Ce que le Worker ajoute à ses réponses (`worker/headers.ts`, `worker/limits.ts`) : les en-têtes
 * de sécurité sur chaque réponse, même une erreur ; `http://` et `www.pokecodex.fr` qui mènent à
 * `https://pokecodex.fr` ; les images réservées aux pages du site ; un fichier absent, 404 et non
 * la page de l'app (`worker/index.ts`) ; et une route répétée à l'excès par un même visiteur, 429,
 * sans compter les autres visiteurs.
 */

import { describe, expect, test } from 'vitest'
import worker from '../index'
import { call } from './helpers'

describe('les en-têtes du site', () => {
  test('les en-têtes de sécurité, sur une réponse de l’API comme sur une adresse inconnue', async () => {
    for (const path of ['/api/account', '/api/inconnue']) {
      const { headers } = await call(path)
      expect(headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains')
      expect(headers.get('x-content-type-options')).toBe('nosniff')
      expect(headers.get('x-frame-options')).toBe('DENY')
      expect(headers.get('cross-origin-opener-policy')).toBe('same-origin')
    }
  })

  test('www mène au site, pour de bon, avec les mêmes en-têtes', async () => {
    const response = await worker.request('https://www.pokecodex.fr/pokedex?page=2')
    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe('https://pokecodex.fr/pokedex?page=2')
    expect(response.headers.get('strict-transport-security')).not.toBeNull()
  })

  test('http mène à https, www compris, en un seul saut', async () => {
    for (const [from, to] of [
      ['http://pokecodex.fr/pokedex?page=2', 'https://pokecodex.fr/pokedex?page=2'],
      ['http://www.pokecodex.fr/connexion', 'https://pokecodex.fr/connexion'],
    ] as const) {
      const response = await worker.request(from)
      expect(response.status).toBe(301)
      expect(response.headers.get('location')).toBe(to)
    }
  })

  test('une image : pour les pages du site seulement', async () => {
    const { headers } = await call('/images/cards/SVP/1-md.webp')
    expect(headers.get('cross-origin-resource-policy')).toBe('same-origin')
  })

  test('un fichier absent : 404, jamais la page de l’app, gardée un an', async () => {
    // `env.ASSETS` rend la page de l'app à toute adresse (`vitest.config.ts`).
    for (const path of ['/assets/index-ancien.js', '/favicon.ico', '/icons/absente.png']) {
      const response = await call(path)
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control')).toBe('no-cache')
    }
    for (const path of ['/', '/pokedex', '/collections/SV2a', '/pokemon/25']) {
      expect((await call(path)).status).toBe(200)
    }
  })
})

describe('les limites par visiteur', () => {
  test('la 31e demande coûteuse en 10 s : 429, et un autre visiteur passe toujours', async () => {
    const from = (ip: string) =>
      call('/api/histories?ids=1', { headers: { 'CF-Connecting-IP': ip } })
    for (let count = 1; count <= 30; count++) {
      expect((await from('203.0.113.7')).status).not.toBe(429)
    }
    const refused = await from('203.0.113.7')
    expect(refused.status).toBe(429)
    expect(refused.headers.get('retry-after')).toBe('10')
    expect((await from('203.0.113.8')).status).not.toBe(429)
  })
})
