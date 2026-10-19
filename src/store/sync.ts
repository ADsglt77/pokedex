/**
 * La synchronisation de la collection entre les appareils du compte connecté (`/api/collection`,
 * `server/collection.ts` ; la règle : `lib/sync.ts`). Le navigateur garde sa copie
 * (`localStorage`, comme sans compte) : l'app marche hors ligne, et envoie ses modifications au
 * retour du réseau. Elle synchronise une seconde après chaque modification, et quand la page
 * revient au premier plan ou que le réseau revient. Sans connexion, l'app ne s'ouvre pas : on voit
 * le Pokédex public (`account`, `router.tsx`).
 *
 * Cet appareil note la dernière version échangée (`pokedex-collection.sync`, partagée par ses
 * onglets) : son numéro, l'empreinte que lui donne le serveur (un numéro peut revenir après une
 * restauration de sa base), et l'empreinte de son document : sa collection a changé quand son
 * empreinte n'est plus celle-là. Un seul onglet synchronise à la fois (`navigator.locks`).
 */

import { create } from 'zustand'
import { forget } from '@/lib/api'
import { emptyCollection } from '@/lib/collection'
import { emptyShopping } from '@/lib/orders'
import {
  decide,
  documentHash,
  isEmptyDocument,
  type SyncDocument,
  type SyncVersion,
} from '@/lib/sync'
import { documentProblem, parseStored, readCollection, readShopping } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { currentDocument, replaceDocument, sameDocument } from '@/store/document'
import { useShoppingStore } from '@/store/shopping'
import type { AccountUser, CollectionResponse, CollectionSaved } from '@/types'
import { readStored, useStorageFailure, writeStored } from './persist'

/**
 * - `syncing`, `synced` ;
 * - `offline` : le serveur ne répond pas, la copie locale attend ;
 * - `expired` : la session a expiré, il faut se reconnecter ;
 * - `conflict` : les deux versions ont changé, l'utilisateur choisit (`conflict`) ;
 * - `refused` : le serveur refuse la collection (`refusal` dit pourquoi).
 */
export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'expired' | 'conflict' | 'refused'

/** La version du serveur, telle qu'il l'envoie. */
interface ServerDocument extends SyncVersion {
  document: SyncDocument
}

export const useSyncStore = create<{
  /**
   * Le compte connecté ; `null` : personne, ce navigateur ne voit que le Pokédex public et la
   * connexion (`router.tsx`). Fixé au démarrage (`startSession`), à la connexion (`signIn`) et à
   * la déconnexion (`signOut`).
   */
  account: AccountUser | null
  /** Sans compte, sans objet. */
  status: SyncStatus
  conflict: ServerDocument | null
  /** Le conflit dont la question a été fermée (« Plus tard ») ; un nouveau la rouvre. */
  dismissed: ServerDocument | null
  /** Pourquoi le serveur refuse la collection (statut `refused`) : à dire dans le menu du compte. */
  refusal: string | null
}>(() => ({ account: null, status: 'syncing', conflict: null, dismissed: null, refusal: null }))

/**
 * Ferme la question du conflit en cours (`open` à faux) ou la rouvre. Gardé ici, pas dans le menu
 * du compte : il change de place (barre latérale, barre du haut) quand l'écran tourne.
 */
export const setConflictQuestion = (open: boolean) =>
  useSyncStore.setState((state) => ({ dismissed: open ? null : state.conflict }))

const BASE_KEY = 'pokedex-collection.sync'

/** Le compte connecté ; `null` : pas de synchronisation. */
let user: string | null = null

/** Ce que cet appareil garde de la dernière version échangée, tel qu'enregistré. */
const readBaseRecord = () => parseStored(readStored(BASE_KEY)) as Record<string, unknown> | null

/** La dernière fois (ms) que cet onglet a noté une version échangée. */
let rebasedAt = 0

/**
 * La dernière version échangée par cet appareil, si c'est avec ce compte. Aucune tant qu'une
 * collection illisible a été remplacée par une vide (`setAsideUnreadable`), jusqu'à la prochaine
 * version échangée : ce vide serait sinon envoyé comme un effacement voulu (`decide` propose alors
 * la version du serveur, ou la question).
 */
function readBase(): SyncVersion | null {
  const { unreadableAt } = useStorageFailure.getState()
  if (unreadableAt !== null && rebasedAt <= unreadableAt) return null
  const base = readBaseRecord()
  if (base?.user !== user || typeof base?.version !== 'number' || typeof base.hash !== 'string') {
    return null
  }
  const tag = typeof base.tag === 'string' ? base.tag : undefined
  return { version: base.version, hash: base.hash, tag }
}

function writeBase({ version, hash, tag }: SyncVersion) {
  rebasedAt = Date.now()
  // L'e-mail et le pseudo aussi : hors ligne au démarrage, le menu du compte les montre encore.
  // Sans stockage, le bandeau d'échec le dit ; la version sera redemandée.
  const { email, name } = useSyncStore.getState().account ?? {}
  writeStored(BASE_KEY, JSON.stringify({ user, email, name, version, hash, tag }))
}

/** L'ETag d'une version (`server/collection.ts`) : `"v<numéro>-<empreinte>"`. */
const etagOf = ({ version, tag }: SyncVersion) => (tag ? `"v${version}-${tag}"` : undefined)

/** L'empreinte de version d'une réponse du serveur (son ETag) ; `undefined` sans elle. */
const tagOf = (response: Response) => /"v\d+-(\w+)"/.exec(response.headers.get('ETag') ?? '')?.[1]

const setStatus = (status: SyncStatus) => useSyncStore.setState({ status })

/**
 * Le Pokédex public (`/api/vitrine`), lu une fois par `getJson` : oublié à la connexion et à la
 * déconnexion, pour qu'il montre ensuite ce que le compte a changé entre-temps.
 */
const forgetVitrine = () => forget('/api/vitrine')

/**
 * Connecté (connexion, création du compte, démarrage) : la synchronisation commence, ou reprend
 * (le même compte, après une session expirée).
 */
export function signIn(account: AccountUser) {
  user = account.id
  forgetVitrine()
  useSyncStore.setState({ account, status: 'syncing', conflict: null })
  void sync()
}

/**
 * Au démarrage, d'après `/api/account` (`loadAccount`) : le compte connecté, `null` personne.
 * Sans réponse du serveur (`undefined` : hors ligne, en panne), un appareil déjà synchronisé avec
 * le compte et pas déconnecté depuis l'est encore : l'app marche hors ligne.
 */
export function startSession(account: AccountUser | null | undefined) {
  if (account !== undefined) {
    if (account) signIn(account)
    return
  }
  const base = readBaseRecord()
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  if (typeof base?.user === 'string') {
    signIn({ id: base.user, email: text(base.email), name: text(base.name) })
  }
}

/**
 * Ce navigateur a-t-il déjà été synchronisé avec le compte (et pas déconnecté depuis) ? Il peut
 * alors démarrer sans la réponse du serveur, comme hors ligne (`startSession`).
 */
export const syncedBefore = () => typeof readBaseRecord()?.user === 'string'

/**
 * Le serveur vient de répondre « sans session » (401) à une action du compte (mot de passe,
 * pseudo : une connexion sur un autre appareil a fermé celle-ci) : le menu du compte propose de
 * se reconnecter.
 */
export const markExpired = () => setStatus('expired')

/** Le pseudo vient de changer (Données › Mon compte). */
export function renameAccount(name: string) {
  const { account } = useSyncStore.getState()
  if (account) useSyncStore.setState({ account: { ...account, name } })
}

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

/** Refusée par le serveur : rien ne repart tout seul, le menu du compte dit pourquoi. */
function refused(refusal: string) {
  useSyncStore.setState({ status: 'refused', refusal })
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
  const body = (await response.json()) as CollectionResponse
  if (!body.collection || !body.shopping) return null
  // Lu comme le stockage du navigateur : seuls ses champs connus.
  const document = {
    collection: readCollection(body.collection)!,
    shopping: readShopping(body.shopping)!,
  }
  const hash = await documentHash(document)
  return { version: body.version, hash, tag: tagOf(response), document }
}

/**
 * Le dernier envoi resté sans réponse (coupé, délai dépassé) : il est peut-être enregistré. Si le
 * serveur montre ensuite ce document à la version attendue, c'est celui de cet appareil : il
 * devient la version échangée, sans fausse question de conflit.
 */
let sent: { version: number; hash: string } | null = null

/**
 * Envoie le document à partir de la version `base` : `saved` s'il est enregistré, `stale` si le
 * serveur a changé depuis (on compare de nouveau), `stopped` sinon (hors ligne, session expirée,
 * refusé : le statut le dit).
 */
async function push(
  document: SyncDocument,
  hash: string,
  base: { version: number; tag?: string },
): Promise<'saved' | 'stale' | 'stopped'> {
  sent = { version: base.version + 1, hash }
  const body = JSON.stringify({ baseVersion: base.version, baseTag: base.tag, ...document })
  const response = await call('PUT', { body })
  // Sans réponse, ou une réponse illisible (coupée en route), ou une panne passagère (502 pendant
  // un redémarrage…) : l'envoi est peut-être passé (`sent`), il repartira.
  const saved =
    response?.ok && ((await response.json().catch(() => null)) as CollectionSaved | null)
  if (saved) {
    sent = null
    writeBase({ version: saved.version, hash, tag: saved.tag })
    setStatus('synced')
    return 'saved'
  }
  if (!response || response.ok || response.status >= 500) {
    offline()
    return 'stopped'
  }
  sent = null
  if (response.status === 409) return 'stale'
  if (response.status === 401) {
    setStatus('expired')
    return 'stopped'
  }
  // Refusé, pour de bon : un document qui ne passe pas les contrôles du serveur (la règle en
  // cause, relue ici avec le même code), trop gros, ou une origine refusée (l'adresse du site
  // n'est pas celle que connaît le serveur).
  refused(
    response.status === 403
      ? 'il refuse les envois depuis cette adresse, que son réglage BETTER_AUTH_URL ne nomme pas'
      : response.status === 413
        ? 'elle dépasse 5 Mo'
        : (documentProblem(document) ?? 'elle ne passe pas ses contrôles'),
  )
  return 'stopped'
}

/** Une synchronisation à la fois, tous onglets confondus (sans `navigator.locks` : cet onglet). */
const exclusive = (task: () => Promise<void>) =>
  navigator.locks ? navigator.locks.request('pokedex-sync', task) : task()

/** Compare la collection de cet appareil à celle du serveur, et fait ce que dit `decide`. */
export function sync(): Promise<void> {
  if (!user || useSyncStore.getState().status === 'conflict') return Promise.resolve()
  return exclusive(async () => {
    try {
      await compare()
    } catch (error) {
      // Une réponse illisible (coupée, délai dépassé pendant sa lecture) : une panne passagère.
      // Écrite en console : une erreur du code se lirait sinon comme « Hors ligne ».
      console.error('Synchronisation interrompue', error)
      offline()
    }
  })
}

/** Le texte enregistré de la version échangée quand le conflit est apparu (`keepServer`). */
let conflictBase: string | null = null

/** Le tour de `sync`, sous le verrou. */
async function compare() {
  // Un autre appareil peut écrire entre la lecture et l'envoi : on recommence alors.
  for (let attempt = 0; attempt < 3 && user; attempt++) {
    if (useSyncStore.getState().status !== 'synced') setStatus('syncing')
    let base = readBase()
    const document = currentDocument()
    const hash = await documentHash(document)
    const response = await call('GET', { etag: base ? etagOf(base) : undefined })
    // Déconnecté pendant l'échange : plus rien à synchroniser.
    if (!user) return
    if (!response) return offline()
    if (response.status === 401) return setStatus('expired')

    if (response.status === 304) {
      // Le serveur en est toujours à la version échangée (un 304 ne répond qu'à elle).
      const known = base!
      if (hash === known.hash) return setStatus('synced')
      if ((await push(document, hash, known)) !== 'stale') return
      continue
    }

    if (!response.ok) return offline()
    const server = await readServer(response)
    // Le dernier envoi, resté sans réponse, était passé : il devient la version échangée.
    if (server && sent && server.version === sent.version && server.hash === sent.hash) {
      writeBase(server)
      base = server
      sent = null
    }
    const current = {
      version: server?.version ?? 0,
      hash: server?.hash ?? null,
      tag: server?.tag,
      empty: !server || isEmptyDocument(server.document),
    }
    const step = decide({ hash, empty: isEmptyDocument(document) }, base, current)
    if (step === 'noop') return setStatus('synced')
    if (step === 'adopt') {
      // Modifiée pendant l'échange : reprendre celle du serveur l'effacerait, on compare de
      // nouveau.
      if (!sameDocument(currentDocument(), document)) continue
      writeBase(server!)
      if (server!.hash !== hash) replaceDocument(server!.document)
      return setStatus('synced')
    }
    if (step === 'conflict') {
      conflictBase = readStored(BASE_KEY)
      return useSyncStore.setState({ status: 'conflict', conflict: server })
    }
    if ((await push(document, hash, current)) !== 'stale') return
  }
  // Trois essais sans aboutir (le serveur ou cet appareil changeait à chaque fois) : on
  // recommencera plus tard, comme après une panne, plutôt que de rester « en cours ».
  if (user) offline()
}

/** Conflit : garde la version de cet appareil, envoyée à la place de celle du serveur. */
export async function keepThisDevice() {
  const { conflict } = useSyncStore.getState()
  if (!conflict) return
  useSyncStore.setState({ status: 'syncing', conflict: null })
  try {
    await exclusive(async () => {
      const document = currentDocument()
      await push(document, await documentHash(document), conflict)
    })
    // Le serveur a encore changé depuis (409, le statut est resté « syncing ») : on compare de
    // nouveau.
    if (useSyncStore.getState().status === 'syncing') await sync()
  } catch (error) {
    console.error('Envoi interrompu', error)
    offline()
  }
}

/**
 * Conflit : reprend la version du serveur, à la place de celle de cet appareil. Si la version
 * échangée a changé depuis la question (le conflit réglé dans un autre onglet), rien n'est repris :
 * on compare de nouveau.
 */
export function keepServer() {
  const { conflict } = useSyncStore.getState()
  if (!conflict) return
  if (readStored(BASE_KEY) !== conflictBase) {
    useSyncStore.setState({ status: 'syncing', conflict: null })
    void sync()
    return
  }
  writeBase(conflict)
  replaceDocument(conflict.document)
  useSyncStore.setState({ status: 'synced', conflict: null })
}

/**
 * Les modifications de cet appareil pas encore envoyées (la dernière synchronisation a échoué) :
 * à dire avant de se déconnecter, qui les effacerait. Dans le doute (une erreur), oui.
 */
export async function hasUnsentChanges() {
  try {
    await sync()
    const document = currentDocument()
    return !isEmptyDocument(document) && readBase()?.hash !== (await documentHash(document))
  } catch (error) {
    console.error('Comparaison impossible', error)
    return true
  }
}

/**
 * Se déconnecter : la collection quitte aussi ce navigateur (elle reste sur le serveur), pour ne
 * rien laisser sur un appareil partagé. Effacée après la déconnexion : aucun onglet ne peut plus
 * envoyer la collection vide. `false` si le serveur ne répond pas : rien n'est effacé. Le client
 * Better Auth est chargé ici, à la demande : il n'alourdit pas le premier affichage.
 */
export async function signOut() {
  const { error } = await import('@/lib/auth')
    .then(({ authClient }) => authClient.signOut())
    .catch(() => ({ error: true }))
  if (error) return false
  user = null
  sent = null
  // Une synchronisation en cours finit d'abord (elle s'arrête, sans compte) : rien ne passe après
  // l'effacement.
  await exclusive(async () => {
    writeStored(BASE_KEY, null)
    replaceDocument({ collection: emptyCollection(), shopping: emptyShopping() })
    forgetVitrine()
    useSyncStore.setState({ account: null, conflict: null })
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
// Le conflit réglé dans un autre onglet (la version échangée a changé) : la question se ferme
// ici aussi, et on compare de nouveau.
window.addEventListener('storage', (event) => {
  if (event.key !== BASE_KEY || useSyncStore.getState().status !== 'conflict') return
  useSyncStore.setState({ status: 'syncing', conflict: null })
  void sync()
})
