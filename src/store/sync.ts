/**
 * La synchronisation de la collection entre les appareils du compte connecté (`/api/collection`,
 * `server/collection.ts` ; la règle : `lib/sync.ts`). Le navigateur garde sa copie
 * (`localStorage`, comme sans compte) : l'app marche hors ligne, et envoie ses modifications au
 * retour du réseau. Elle synchronise une seconde après chaque modification, et quand la page
 * revient au premier plan ou que le réseau revient. Sans connexion, rien ne change : la collection
 * reste dans ce navigateur.
 *
 * Cet appareil note la dernière version échangée (`pokedex-collection.sync`, partagée par ses
 * onglets) : sa collection a changé quand son empreinte n'est plus celle-là. Un seul onglet
 * synchronise à la fois (`navigator.locks`).
 */

import { create } from 'zustand'
import { authClient } from '@/lib/auth-client'
import { emptyCollection } from '@/lib/collection'
import { decide, documentHash, isEmptyDocument, type SyncDocument } from '@/lib/sync'
import { parseStored } from '@/lib/transfer'
import { emptyShopping } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { readStored } from './persist'

/**
 * - `local` : pas connecté, la collection reste dans ce navigateur ;
 * - `syncing`, `synced` ;
 * - `offline` : le serveur ne répond pas, la copie locale attend ;
 * - `expired` : la session a expiré, il faut se reconnecter ;
 * - `conflict` : les deux versions ont changé, l'utilisateur choisit (`conflict`) ;
 * - `refused` : le serveur refuse la collection (elle ne passe pas ses contrôles).
 */
export type SyncStatus =
  'local' | 'syncing' | 'synced' | 'offline' | 'expired' | 'conflict' | 'refused'

/** La version du serveur, telle qu'il l'envoie. */
export interface ServerDocument {
  version: number
  document: SyncDocument
  hash: string
}

export const useSyncStore = create<{
  status: SyncStatus
  conflict: ServerDocument | null
  /** Le conflit dont la question a été fermée (« Plus tard ») ; un nouveau la rouvre. */
  dismissed: ServerDocument | null
}>(() => ({ status: 'local', conflict: null, dismissed: null }))

/**
 * Ferme la question du conflit en cours (`open` à faux) ou la rouvre. Gardé ici, pas dans le menu
 * du compte : il change de place (barre latérale, barre du haut) quand l'écran tourne.
 */
export const setConflictQuestion = (open: boolean) =>
  useSyncStore.setState((state) => ({ dismissed: open ? null : state.conflict }))

const BASE_KEY = 'pokedex-collection.sync'

/** Le compte connecté ; `null` : pas de synchronisation. */
let user: string | null = null

/** La dernière version échangée par cet appareil, si c'est avec ce compte. */
function readBase() {
  const base = parseStored(readStored(BASE_KEY)) as {
    user?: unknown
    version?: unknown
    hash?: unknown
  } | null
  return base?.user === user && typeof base?.version === 'number' && typeof base.hash === 'string'
    ? { version: base.version, hash: base.hash }
    : null
}

function writeBase(version: number, hash: string) {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify({ user, version, hash }))
  } catch {
    // Sans stockage, le bandeau d'échec le dit ; la version sera redemandée.
  }
}

const localDocument = (): SyncDocument => ({
  collection: useCollectionStore.getState().collection,
  shopping: useShoppingStore.getState().shopping,
})

function apply({ collection, shopping }: SyncDocument) {
  useCollectionStore.getState().replaceCollection(collection)
  useShoppingStore.getState().replaceShopping(shopping)
}

const setStatus = (status: SyncStatus) => useSyncStore.setState({ status })

let retry: ReturnType<typeof setTimeout> | undefined
/**
 * Hors ligne, ou le serveur en panne passagère (502 pendant un redémarrage…) : la synchronisation
 * est redemandée 30 s plus tard. Le retour du réseau, de la page ou une modification la relancent
 * aussi, plus tôt.
 */
function offline() {
  setStatus('offline')
  clearTimeout(retry)
  if (user) retry = setTimeout(() => void sync(), 30_000)
}

/** Un appel à l'API ; `null` sans réponse (hors ligne, serveur arrêté). */
async function call(method: 'GET' | 'PUT', init: { body?: string; etag?: string } = {}) {
  try {
    return await fetch('/api/collection', {
      method,
      body: init.body,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(init.etag && { 'If-None-Match': init.etag }),
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return null
  }
}

/** Le document du serveur ; `null` tant qu'aucun appareil n'a rien envoyé. */
async function readServer(response: Response): Promise<ServerDocument | null> {
  const body = (await response.json()) as { version: number } & Partial<SyncDocument>
  if (!body.collection || !body.shopping) return null
  const document = { collection: body.collection, shopping: body.shopping }
  return { version: body.version, document, hash: await documentHash(document) }
}

/** Envoie le document : `true` s'il est enregistré, `false` si le serveur a changé depuis. */
async function push(document: SyncDocument, hash: string, baseVersion: number) {
  const response = await call('PUT', { body: JSON.stringify({ baseVersion, ...document }) })
  if (!response) return offline()
  if (response.status === 401) return setStatus('expired')
  if (response.status === 409) return false
  // Refusé : le document ne passe pas les contrôles du serveur. Toute autre erreur (502 pendant
  // un redémarrage…) est une panne passagère : l'envoi repartira.
  if (response.status === 400 || response.status === 422) return setStatus('refused')
  if (!response.ok) return offline()
  const body = (await response.json().catch(() => null)) as { version: number } | null
  // Une réponse illisible (coupée en route) : l'envoi est peut-être passé, on comparera de nouveau.
  if (!body) return offline()
  writeBase(body.version, hash)
  setStatus('synced')
  return true
}

/** Une synchronisation à la fois, tous onglets confondus (sans `navigator.locks` : cet onglet). */
const exclusive = (task: () => Promise<void>) =>
  navigator.locks ? navigator.locks.request('pokedex-sync', task) : task()

/** La collection ou les achats ont changé depuis `document` (une modification pendant l'échange). */
function changedSince(document: SyncDocument) {
  const current = localDocument()
  return current.collection !== document.collection || current.shopping !== document.shopping
}

/** Compare la collection de cet appareil à celle du serveur, et fait ce que dit `decide`. */
export function sync(): Promise<void> {
  if (!user || useSyncStore.getState().status === 'conflict') return Promise.resolve()
  return exclusive(async () => {
    try {
      await compare()
    } catch {
      // Une réponse illisible (coupée, délai dépassé pendant sa lecture) : une panne passagère.
      offline()
    }
  })
}

/** Le tour de `sync`, sous le verrou. */
async function compare() {
  // Un autre appareil peut écrire entre la lecture et l'envoi : on recommence alors.
  for (let attempt = 0; attempt < 3 && user; attempt++) {
    if (useSyncStore.getState().status !== 'synced') setStatus('syncing')
    const base = readBase()
    const document = localDocument()
    const hash = await documentHash(document)
    const response = await call('GET', { etag: base ? `"v${base.version}"` : undefined })
    // Déconnecté pendant l'échange : plus rien à synchroniser.
    if (!user) return
    if (!response) return offline()
    if (response.status === 401) return setStatus('expired')
    if (response.status !== 304 && !response.ok) return offline()
    // 304 : le serveur en est toujours à la version échangée.
    const server = response.status === 304 ? null : await readServer(response)
    const current =
      response.status === 304
        ? { ...base!, empty: false }
        : {
            version: server?.version ?? 0,
            hash: server?.hash ?? null,
            empty: !server || isEmptyDocument(server.document),
          }
    const step = decide({ hash, empty: isEmptyDocument(document) }, base, current)
    if (step === 'noop') return setStatus('synced')
    if (step === 'adopt') {
      // Modifiée pendant l'échange : reprendre celle du serveur l'effacerait, on compare de
      // nouveau.
      if (changedSince(document)) continue
      writeBase(server!.version, server!.hash)
      if (server!.hash !== hash) apply(server!.document)
      return setStatus('synced')
    }
    if (step === 'conflict') return useSyncStore.setState({ status: 'conflict', conflict: server })
    if ((await push(document, hash, current.version)) !== false) return
  }
}

/** Conflit : garde la version de cet appareil, envoyée à la place de celle du serveur. */
export async function keepThisDevice() {
  const { conflict } = useSyncStore.getState()
  if (!conflict) return
  useSyncStore.setState({ status: 'syncing', conflict: null })
  await exclusive(async () => {
    const document = localDocument()
    await push(document, await documentHash(document), conflict.version)
  })
  // Le serveur a encore changé depuis (409, le statut est resté « syncing ») : on compare de
  // nouveau.
  if (useSyncStore.getState().status === 'syncing') await sync()
}

/** Conflit : reprend la version du serveur, à la place de celle de cet appareil. */
export function keepServer() {
  const { conflict } = useSyncStore.getState()
  if (!conflict) return
  writeBase(conflict.version, conflict.hash)
  apply(conflict.document)
  useSyncStore.setState({ status: 'synced', conflict: null })
}

/**
 * Le compte connecté (`null` : aucun), que suit la coquille de l'app (`useSessionSync`) : à la
 * connexion, la synchronisation commence.
 */
export function setSyncUser(next: string | null) {
  if (next === user) return
  user = next
  useSyncStore.setState({ status: next ? 'syncing' : 'local', conflict: null })
  if (next) void sync()
}

/**
 * Les modifications de cet appareil pas encore envoyées (la dernière synchronisation a échoué) :
 * à dire avant de se déconnecter, qui les effacerait.
 */
export async function hasUnsentChanges() {
  await sync()
  const document = localDocument()
  return !isEmptyDocument(document) && readBase()?.hash !== (await documentHash(document))
}

/**
 * Se déconnecter : la collection quitte aussi ce navigateur (elle reste sur le serveur), pour ne
 * rien laisser sur un appareil partagé. Effacée après la déconnexion : aucun onglet ne peut plus
 * envoyer la collection vide. `false` si le serveur ne répond pas : rien n'est effacé.
 */
export async function signOut() {
  const { error } = await authClient.signOut().catch(() => ({ error: true }))
  if (error) return false
  user = null
  // Une synchronisation en cours finit d'abord (elle s'arrête, sans compte) : rien ne passe après
  // l'effacement.
  await exclusive(async () => {
    try {
      localStorage.removeItem(BASE_KEY)
    } catch {
      // Sans stockage, rien n'était gardé.
    }
    apply({ collection: emptyCollection(), shopping: emptyShopping() })
    useSyncStore.setState({ status: 'local', conflict: null })
  })
  return true
}

// Une seconde après chaque modification, et au retour de la page ou du réseau.
let timer: ReturnType<typeof setTimeout> | undefined
const schedule = () => {
  clearTimeout(timer)
  if (user) timer = setTimeout(() => void sync(), 1000)
}
useCollectionStore.subscribe((state, previous) => {
  if (state.collection !== previous.collection) schedule()
})
useShoppingStore.subscribe((state, previous) => {
  if (state.shopping !== previous.shopping) schedule()
})
window.addEventListener('focus', schedule)
window.addEventListener('online', schedule)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') schedule()
})
