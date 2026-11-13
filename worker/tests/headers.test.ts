/**
 * Ce que le Worker ajoute à ses réponses (`worker/headers.ts`, `worker/limits.ts`) : les en-têtes
 * de sécurité sur chaque réponse, même une erreur ; `http://` et `www.pokecodex.fr` qui mènent à
 * `https://pokecodex.fr` ; les espèces préchargées avec une session, jamais sur la connexion ni
 * l'inscription ; les images réservées aux pages du site ; un fichier absent, 404 et non la page
 * de l'app (`worker/index.ts`) ; et une route répétée à l'excès par un même visiteur, 429 sans corps
 * ni cache, sans compter les autres visiteurs (les historiques ; les lignes de la liste de
 * souhaits, à leur propre limite, plus basse ; le compte, `/api/auth` sans barre finale compris ;
 * le journal ; l'état des tâches et la surveillance).
 */

import { describe, expect, test } from 'vitest'
import worker from '../index'
import { call, sleep } from './helpers'

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

  test('les espèces préchargées avec une session, sauf sur la connexion et l’inscription', async () => {
    const link = async (path: string, cookie = 'better-auth.session_token=essai') =>
      (await call(path, { headers: { Cookie: cookie } })).headers.get('link')
    for (const path of ['/', '/pokedex', '/mentions-legales']) {
      expect(await link(path)).toBe('</api/species>; rel=preload; as=fetch; crossorigin')
    }
    for (const path of ['/connexion', '/connexion?retour=/achats', '/inscription']) {
      expect(await link(path)).toBeNull()
    }
    expect(await link('/pokedex', '')).toBeNull()
  })

  test('une image : pour les pages du site seulement', async () => {
    const { headers } = await call('/images/cards/ja/SVP/SVP-001-md.webp')
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
  // Un visiteur par cas : deux routes d'une même limite (le compte et le journal, l'état des tâches
  // et la surveillance) se partagent son compte.
  let visitor = 0
  test.each([
    ['la 31e demande d’historiques', 'GET', '/api/histories?ids=1', 30],
    ['la 6e demande de lignes de souhaits', 'GET', '/api/wants?ids=1', 5],
    ['la 41e requête au compte, sans barre finale', 'GET', '/api/auth', 40],
    ['la 41e lecture du compte', 'GET', '/api/account', 40],
    ['le 41e envoi au journal', 'POST', '/api/journal', 40],
    ['la 401e demande de l’état des tâches', 'GET', '/api/status', 400],
    ['la 401e demande de la surveillance', 'GET', '/api/health', 400],
  ])(
    '%s en 10 s : 429, et un autre visiteur passe toujours',
    async (_, method, path, allowed) => {
      visitor += 2
      const from = (ip: string) => call(path, { method, headers: { 'CF-Connecting-IP': ip } })
      // Les fenêtres de 10 s du limiteur suivent l'horloge : finie en pleine série, une fenêtre
      // remettrait le compte à zéro et la dernière passerait. La série part assez loin de sa fin :
      // 2 s, plus 10 ms par demande (400 demandes prennent jusqu'à 1 s sur un poste de développement).
      const left = 10_000 - (Date.now() % 10_000)
      if (left < 2_000 + allowed * 10) await sleep(left + 50)
      for (let count = 1; count <= allowed; count++) {
        expect((await from(`203.0.113.${visitor}`)).status).not.toBe(429)
      }
      const refused = await from(`203.0.113.${visitor}`)
      expect(refused.status).toBe(429)
      expect(refused.headers.get('retry-after')).toBe('10')
      expect(refused.headers.get('cache-control')).toBe('no-store')
      expect(await refused.text()).toBe('')
      expect((await from(`203.0.113.${visitor + 1}`)).status).not.toBe(429)
    },
    // L'attente d'une fenêtre neuve (jusqu'à 10 s) et la série : plus que les 5 s par défaut.
    15_000,
  )
})
