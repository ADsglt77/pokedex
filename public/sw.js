/*
 * Le service worker : l'app démarre hors ligne (installée sur téléphone, ou sans réseau).
 * - L'app elle-même (index.html, scripts, styles, polices, icônes) : gardée à l'installation, d'après
 *   la liste que la construction écrit ici (`PRECACHE`, `vite.config.ts`) ; elle change à
 *   chaque construction, donc ce fichier aussi : le navigateur installe la nouvelle version et
 *   oublie l'ancienne. Les pages : le réseau d'abord, l'app gardée (`/index.html`) sans lui. Les
 *   fichiers de `public/` (thème, manifeste, icônes), dont le nom ne change pas : le réseau
 *   d'abord, eux aussi.
 * - Les données de référence (espèces, catalogue, prix et historiques) : le réseau d'abord, la
 *   dernière réponse sans lui, gardée par son chemin, sans les paramètres : une seule copie des
 *   historiques de la collection (`/api/histories?ids=…`), quels que soient les ids, et non une
 *   par collection. Une copie demandée avec d'autres ids sert encore : chaque id y a sa clé, la
 *   page y prend ceux de ses cartes ; une carte qui n'y est pas (ajoutée depuis) ne pèse pas sur
 *   la courbe, et la page Valeur le dit sous elle.
 * - « Le réseau d'abord » : sans réponse en 4 s (un réseau faible), la version gardée s'il y en a
 *   une ; sinon le réseau, aussi lent soit-il. Une erreur du serveur (5xx : le 502 de nginx pendant
 *   le redémarrage d'un déploiement, la page d'erreur de Cloudflare…) : la version gardée aussi,
 *   s'il y en a une ; sinon cette erreur.
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
const REFERENCE = ['/api/species', '/api/catalog', '/api/prices', '/api/histories']

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
    event.respondWith(fresh(DATA, event, url.pathname))
  } else if (url.pathname.startsWith('/images/')) event.respondWith(image(request))
  else if (PRECACHE.includes(url.pathname)) event.respondWith(fresh(APP, event))
})

/**
 * Le réseau d'abord (`response`, sa réponse attendue) ; sans lui, la copie gardée (`cached`).
 * Sans réponse en 4 s (un réseau faible), la copie gardée s'il y en a une ; sinon on attend le
 * réseau, aussi lent soit-il. Seulement l'attente des en-têtes : un long téléchargement (les prix)
 * va à son terme. Une erreur du serveur (5xx : nginx sans le serveur de l'app, Cloudflare sans le
 * site) : la copie gardée s'il y en a une, plutôt qu'une page d'erreur ou des données absentes.
 */
async function networkFirst(response, cached) {
  try {
    const early = await Promise.race([
      response,
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])
    if (early) return early.status >= 500 ? ((await cached()) ?? early) : early
  } catch {
    return (await cached()) ?? Response.error()
  }
  return (await cached()) ?? response.catch(() => Response.error())
}

/** Une page de l'app : le réseau, sinon (ou sur une erreur 5xx) l'app gardée à l'installation. */
function page(request) {
  return networkFirst(fetch(request), () => caches.match('/index.html'))
}

/** Gardé une fois pour toutes (un fichier au nom unique ne change pas). */
async function kept(name, request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await (await caches.open(name)).put(request, response.clone())
  return response
}

/**
 * Le réseau d'abord ; sans lui, la dernière réponse gardée. Celle du réseau est gardée dans le
 * cache `name` dès qu'elle arrive, même après la copie servie (`waitUntil` : le service worker
 * l'attend), sous la clé `key` (la requête, ou son seul chemin).
 */
function fresh(name, event, key = event.request) {
  const { request } = event
  const response = fetch(request)
  event.waitUntil(
    response
      .then(async (fetched) => {
        if (!fetched.ok) return
        // Copiée avant que la page ne lise la réponse.
        const copy = fetched.clone()
        await (await caches.open(name)).put(key, copy)
      })
      .catch(() => {}),
  )
  return networkFirst(response, () => caches.match(key))
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
