/*
 * Le service worker : l'app démarre hors ligne (installée sur téléphone, ou sans réseau).
 * - L'app elle-même (index.html, scripts, styles, polices, icônes) : gardée à l'installation, d'après
 *   la liste que la construction écrit ici (`PRECACHE`, `vite.config.ts`) ; elle change à
 *   chaque construction, donc ce fichier aussi : le navigateur installe la nouvelle version et
 *   oublie l'ancienne. Les pages : le réseau d'abord, l'app gardée (`/index.html`) sans lui. Les
 *   fichiers de `public/` (thème, manifeste, icônes), dont le nom ne change pas : la copie gardée
 *   tout de suite, rafraîchie pour la fois suivante (`theme.js` bloque le premier affichage : il
 *   n'attend jamais le réseau).
 * - Les données de référence (espèces, catalogue, prix et historiques) : le réseau d'abord, la
 *   dernière réponse sans lui, dans un cache nommé d'après la forme des réponses (`API_FORMAT`,
 *   `src/config/api.ts` : une copie d'une ancienne forme n'est jamais lue par le nouveau code),
 *   gardée par son chemin, sans les paramètres : une seule copie des
 *   historiques de la collection (`/api/histories?ids=…`), quels que soient les ids, et non une
 *   par collection. Une copie demandée avec d'autres ids sert encore : chaque id y a sa clé, la
 *   page y prend ceux de ses cartes ; une carte qui n'y est pas (ajoutée depuis) ne pèse pas sur
 *   la courbe, et la page Valeur le dit sous elle. Une réponse inchangée (le même ETag) n'est pas
 *   réécrite : les gardées pèsent plusieurs Mo, l'app les redemande à chaque ouverture.
 * - Les demandes du démarrage que `index.html` précharge (les espèces, le compte) : derrière un
 *   service worker, le navigateur ne réutilise pas toujours le préchargement, et l'app les
 *   redemande aussitôt ; la réponse du réseau est partagée avec la demande suivante de la même
 *   page (`startup`).
 * - « Le réseau d'abord » : sans réponse en 4 s (un réseau faible), la version gardée s'il y en a
 *   une ; sinon le réseau, aussi lent soit-il. Une erreur du serveur (5xx : le 502 de nginx pendant
 *   le redémarrage d'un déploiement, la page d'erreur de Cloudflare…) : la version gardée aussi,
 *   s'il y en a une ; sinon cette erreur.
 * - Les images : gardées dès leur premier affichage (elles ne changent pas), 3 000 au plus.
 * Une copie qui ne peut pas être gardée (le stockage du téléphone plein) n'empêche jamais la page de
 * recevoir la réponse du réseau.
 * Jamais le compte ni la collection gardés (`/api/account`, `/api/collection`, `/api/auth`…) : sans
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
const DATA = `donnees-${self.__API_FORMAT__ ?? 0}`
const IMAGES = 'images'
const MAX_IMAGES = 3000

/** Les réponses de l'API gardées pour le hors-ligne : les données de référence, publiques. */
const REFERENCE = ['/api/species', '/api/catalog', '/api/prices', '/api/histories']

/**
 * Les demandes que `index.html` précharge, par adresse : le compte, seulement sa demande marquée
 * `?demarrage` (une connexion qui suivrait ne reçoit jamais la réponse d'avant elle).
 */
const STARTUP = ['/api/species', '/api/account?demarrage']

/** La réponse du réseau d'une demande du démarrage, en attendant la suivante (`startup`). */
const shared = new Map()

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP)
      // Une à une : un fichier qui manquerait n'empêche pas les autres, sauf la page elle-même :
      // sans elle, pas de démarrage hors ligne ; l'installation échoue, et sera retentée.
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch((error) => {
              if (url === '/index.html') throw error
            }),
          ),
        ),
      )
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
            // Les versions d'avant de l'app, et les copies d'une ancienne forme des réponses.
            .filter(
              (name) =>
                (name.startsWith('app-') && name !== APP) ||
                (name.startsWith('donnees') && name !== DATA),
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => trimImages())
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(event, APP))
  else if (REFERENCE.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(fresh(DATA, event, url.pathname))
  } else if (url.pathname.startsWith('/images/')) event.respondWith(image(event))
  else if (STARTUP.includes(url.pathname + url.search)) event.respondWith(startup(event))
  else if (PRECACHE.includes(url.pathname)) event.respondWith(revalidated(APP, event))
})

/**
 * Une demande du démarrage (`STARTUP`) : sa réponse du réseau sert aussi à la demande suivante de
 * la même adresse par la même page, une fois, dans les 10 s (le préchargement d'`index.html`, puis
 * celle de l'app : une seule requête). Chacune reçoit sa copie. La même page seulement : rechargée
 * juste après une connexion ou une déconnexion, elle ne reçoit pas la réponse d'avant.
 */
function startup(event) {
  const { request } = event
  const key = `${event.clientId || event.resultingClientId} ${request.url}`
  const known = shared.get(key)
  if (known) {
    shared.delete(key)
    return known.then((response) => response.clone())
  }
  const response = fetch(request)
  response.catch(() => {})
  shared.set(key, response)
  setTimeout(() => shared.delete(key), 10_000)
  return response.then((fetched) => fetched.clone())
}

/**
 * Garde `response` dans le cache `name` sous `key`, sans la faire attendre : un cache plein (le
 * stockage du téléphone) ne fait pas échouer la réponse que reçoit la page. `then` : après.
 */
function keep(event, name, key, response, then) {
  event.waitUntil(
    caches
      .open(name)
      .then((cache) => cache.put(key, response).then(() => then?.(cache)))
      .catch(() => {}),
  )
}

/**
 * Le réseau d'abord (`response`, sa réponse attendue) ; sans lui, la copie gardée (`cached`).
 * Sans réponse en 4 s (un réseau faible), la copie gardée s'il y en a une ; sinon on attend le
 * réseau, aussi lent soit-il. Seulement l'attente des en-têtes : un long téléchargement (les
 * historiques d'une collection) va à son terme. Une erreur du serveur (5xx : nginx sans le serveur de l'app, Cloudflare sans le
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

/**
 * Gardé une fois pour toutes, dans le cache `name` (un fichier au nom unique, une image : ils ne
 * changent pas) : la copie, sinon le réseau, gardé ensuite. `then` : après l'avoir gardé.
 */
async function cacheFirst(event, name, then) {
  const { request } = event
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) keep(event, name, request, response.clone(), then)
  return response
}

/**
 * Le réseau d'abord ; sans lui, la dernière réponse gardée. Celle du réseau est gardée dans le
 * cache `name` dès qu'elle arrive, même après la copie servie (`waitUntil` : le service worker
 * l'attend), sous la clé `key` (son seul chemin) ; inchangée (le même ETag), elle n'est pas réécrite.
 */
function fresh(name, event, key) {
  const { request } = event
  const url = new URL(request.url)
  const response = STARTUP.includes(url.pathname + url.search) ? startup(event) : fetch(request)
  event.waitUntil(
    response
      .then(async (fetched) => {
        if (!fetched.ok) return
        // Copiée avant que la page ne lise la réponse.
        const copy = fetched.clone()
        const cache = await caches.open(name)
        const etag = fetched.headers.get('etag')
        if (etag && (await cache.match(key))?.headers.get('etag') === etag) {
          return copy.body?.cancel()
        }
        await cache.put(key, copy)
      })
      .catch(() => {}),
  )
  return networkFirst(response, () => caches.match(key))
}

/**
 * Un fichier de `public/` (le thème, le manifeste, les icônes) : la copie gardée tout de suite,
 * rafraîchie en arrière-plan pour la fois suivante ; le réseau sans copie.
 */
async function revalidated(name, event) {
  const { request } = event
  const cached = await caches.match(request)
  const response = fetch(request).then((fetched) => {
    if (fetched.ok) keep(event, name, request, fetched.clone())
    return fetched
  })
  event.waitUntil(response.catch(() => {}))
  return cached ?? response
}

let added = 0

/** Au-delà de `MAX_IMAGES` images gardées, les plus anciennes partent. */
async function trimImages(cache) {
  const images = cache ?? (await caches.open(IMAGES))
  const keys = await images.keys()
  await Promise.all(keys.slice(0, -MAX_IMAGES).map((key) => images.delete(key)))
}

/**
 * Une image : gardée dès son premier affichage. Le tri de temps en temps (toutes les 100 images
 * gardées, et à chaque nouvelle version du service worker), pas à chaque image : lister 3 000
 * entrées a un coût.
 */
function image(event) {
  return cacheFirst(event, IMAGES, (cache) => {
    if (++added % 100 === 0) return trimImages(cache)
  })
}
