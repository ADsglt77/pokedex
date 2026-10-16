/*
 * Le service worker : l'app démarre hors ligne (installée sur téléphone, ou sans réseau).
 * - L'app elle-même (index.html, scripts, styles, polices, icônes) : gardée à l'installation, d'après
 *   la liste que la construction écrit ici (`PRECACHE`, `vite.config.ts`) ; elle change à
 *   chaque construction, donc ce fichier aussi : le navigateur installe la nouvelle version et
 *   oublie l'ancienne. Les pages : le réseau d'abord, l'app gardée sans lui.
 * - Les données de référence (espèces, catalogue, prix) : le réseau d'abord, la dernière réponse
 *   sans lui.
 * - Les images : gardées dès leur premier affichage (elles ne changent pas), 3 000 au plus.
 * Jamais le compte ni la collection (`/api/account`, `/api/collection`, `/api/auth`…) : sans
 * réseau, la collection vient du stockage du navigateur, et elle part au retour du réseau.
 * Seulement en production (`main.tsx`).
 */

const PRECACHE = self.__PRECACHE__ ?? []

/** Une empreinte de la liste : le nom du cache de cette version de l'app. */
const VERSION = [...PRECACHE.join('|')].reduce(
  (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
  7,
)
const APP = `app-${VERSION.toString(36)}`
const DATA = 'donnees'
const IMAGES = 'images'
const MAX_IMAGES = 3000

/** Les réponses de l'API gardées pour le hors-ligne : les données de référence, publiques. */
const REFERENCE = ['/api/species', '/api/catalog', '/api/prices']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP)
      // Une à une : un fichier qui manquerait n'empêche pas les autres.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('app-') && name !== APP)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(kept(APP, request))
  else if (REFERENCE.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(fresh(request))
  } else if (url.pathname.startsWith('/images/')) event.respondWith(image(request))
})

/** Une page de l'app : la dernière version du réseau (gardée), sinon celle gardée. */
async function page(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(APP)
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    return (await caches.match('/index.html')) ?? Response.error()
  }
}

/** Gardé une fois pour toutes (un fichier au nom unique ne change pas). */
async function kept(name, request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await (await caches.open(name)).put(request, response.clone())
  return response
}

/** Le réseau d'abord ; sans lui, la dernière réponse gardée. */
async function fresh(request) {
  try {
    const response = await fetch(request)
    if (response.ok) await (await caches.open(DATA)).put(request, response.clone())
    return response
  } catch {
    return (await caches.match(request)) ?? Response.error()
  }
}

let added = 0

/** Une image : gardée dès son premier affichage ; au-delà de `MAX_IMAGES`, les plus anciennes partent. */
async function image(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(IMAGES)
    await cache.put(request, response.clone())
    // Le tri de temps en temps, pas à chaque image : lister 3 000 entrées a un coût.
    if (++added % 100 === 0) {
      const keys = await cache.keys()
      await Promise.all(keys.slice(0, -MAX_IMAGES).map((key) => cache.delete(key)))
    }
  }
  return response
}
