/**
 * Le compte connecté et sa collection, gardée par le serveur seul (`/api/collection`,
 * `server/collection.ts`) : lue à la connexion, gardée en mémoire, et chaque modification envoyée
 * une demi-seconde après (un échange à la fois). Rien n'est gardé dans le navigateur : sans réseau,
 * rien ne s'enregistre (le menu du compte le dit, l'envoi repart au retour du réseau ou de la page,
 * et quitter la page le demande d'abord). Chaque envoi part de la version lue (`version`) : changée
 * ailleurs entre-temps (un autre onglet, un autre appareil), le serveur la refuse (409) et l'app
 * relit la sienne, sans rien écraser ; il porte aussi le compte d'où il vient : parti juste après
 * une connexion à un autre compte, le serveur le refuse (401). Au retour sur la page, la collection est relue, si rien
 * n'attend d'être envoyé ; une modification faite pendant cette lecture n'est pas écrasée (`load`).
 * Sans connexion, l'app ne s'ouvre pas : on voit la connexion, ou le Pokédex public d'un compte
 * (`router.tsx`).
 */

import { create } from 'zustand'
import { forget } from '@/lib/api'
import { emptyCollection } from '@/lib/collection'
import { emptyShopping } from '@/lib/orders'
import { loadSpecies } from '@/lib/species'
import { documentProblem, readCollection, readShopping } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { currentDocument, replaceDocument } from '@/store/document'
import { useShoppingStore } from '@/store/shopping'
import type { AccountUser, CollectionResponse, CollectionSaved } from '@/types'

/**
 * - `saved` : tout est enregistré ; `saving` : un envoi en cours ;
 * - `offline` : le serveur ne répond pas, la modification attend ;
 * - `expired` : la session est fermée, il faut se reconnecter ;
 * - `reloaded` : changée ailleurs, la collection a été relue (la dernière modification d'ici
 *   n'est pas enregistrée) ;
 * - `refused` : le serveur refuse la collection (`refusal` dit pourquoi).
 */
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'expired' | 'reloaded' | 'refused'

export const useAccountStore = create<{
  /** Le compte connecté ; `null` : personne (`router.tsx`). */
  account: AccountUser | null
  status: SaveStatus
  /** Pourquoi le serveur refuse la collection (statut `refused`). */
  refusal: string | null
}>(() => ({ account: null, status: 'saved', refusal: null }))

const setStatus = (status: SaveStatus) => useAccountStore.setState({ status })

/** La version du serveur d'où part la collection en mémoire. */
let version = 0
/** Les modifications faites, et la dernière enregistrée (ou abandonnée) : égales, rien n'attend. */
let edits = 0
let saved = 0
/** La collection relue du serveur : ce n'est pas une modification à envoyer. */
let loading = false

/** Les échanges avec le serveur, un à la fois ; une erreur (réponse illisible) : hors ligne. */
let queue: Promise<unknown> = Promise.resolve()
const inTurn = (task: () => Promise<unknown>) =>
  (queue = queue.then(task).catch((error: unknown) => {
    console.error('Échange avec le serveur interrompu', error)
    setStatus('offline')
  }))

/** Un appel à l'API ; `null` sans réponse (hors ligne, serveur arrêté). */
const call = (method: 'GET' | 'PUT', body?: string) =>
  fetch('/api/collection', {
    method,
    body,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)

/**
 * Relit la collection du serveur, à la place de celle en mémoire ; `false` sans réponse (ou la
 * session fermée : `expired`). Une modification faite pendant la lecture (au retour sur la page)
 * n'est pas écrasée : la collection en mémoire reste, et l'envoi qui attend part de la version
 * d'avant (changée ailleurs entre-temps, le serveur la refuse, 409, et elle est relue).
 */
async function load() {
  const before = edits
  const response = await call('GET')
  if (response?.status === 401) setStatus('expired')
  if (!response?.ok) return false
  const body = (await response.json()) as CollectionResponse
  if (edits !== before) return true
  version = body.version
  saved = edits
  loading = true
  // Lue comme un fichier importé : seuls ses champs connus.
  replaceDocument({
    collection: readCollection(body.collection) ?? emptyCollection(),
    shopping: readShopping(body.shopping) ?? emptyShopping(),
  })
  loading = false
  return true
}

let retry: ReturnType<typeof setTimeout> | undefined

/** Sans réponse, ou une panne passagère (502 pendant un redémarrage) : l'envoi repart dans 30 s. */
function retryLater() {
  setStatus('offline')
  clearTimeout(retry)
  retry = setTimeout(save, 30_000)
}

/** Envoie la collection, si une modification attend. */
async function push() {
  const { account } = useAccountStore.getState()
  if (edits === saved || !account) return
  const sending = edits
  setStatus('saving')
  const document = currentDocument()
  const body = { account: account.id, baseVersion: version, ...document }
  const response = await call('PUT', JSON.stringify(body))
  if (response?.ok) {
    version = ((await response.json()) as CollectionSaved).version
    saved = sending
    if (edits === saved) setStatus('saved')
    return
  }
  if (!response || response.status >= 500) return retryLater()
  if (response.status === 409) {
    // La version du serveur, relue à la place de celle d'ici ; une modification faite pendant la
    // lecture part encore (`load`). Sans réponse, l'envoi repartira : refusé, puis relu.
    if (await load()) {
      if (!hasUnsavedChanges()) setStatus('reloaded')
    } else if (useAccountStore.getState().status !== 'expired') retryLater()
    return
  }
  if (response.status === 401) return setStatus('expired')
  // Refusée pour de bon, pas renvoyée : la règle en cause (relue ici avec le même code), trop
  // grosse, ou une origine refusée (l'adresse du site n'est pas celle que connaît le serveur).
  saved = sending
  useAccountStore.setState({
    status: 'refused',
    refusal:
      response.status === 403
        ? 'il refuse les envois depuis cette adresse, que son réglage BETTER_AUTH_URL ne nomme pas'
        : response.status === 413
          ? 'elle dépasse 5 Mo'
          : (documentProblem(document) ?? 'elle ne passe pas ses contrôles'),
  })
}

/** Envoie ce qui attend (« Réessayer », le retour du réseau). */
export const save = () => void inTurn(push)

/**
 * Le Pokédex public du compte (`/api/vitrine/<pseudo>`), lu une fois par `getJson` : oublié à la
 * connexion, à la déconnexion et au changement de pseudo, pour qu'il montre ensuite ce que le
 * compte a changé entre-temps.
 */
const forgetVitrine = (name: string) => forget(`/api/vitrine/${name.toLowerCase()}`)

/**
 * Connecté (démarrage, connexion, création du compte) : ce qu'un autre compte (une session
 * expirée) laissait en mémoire part d'abord, envois en attente compris ; puis la collection du
 * compte est lue, et le compte n'est posé qu'une fois elle lue ; `false` sans elle. Les espèces,
 * que la coquille attendra (`router.tsx`), sont demandées en même temps.
 */
export async function signIn(account: AccountUser) {
  await leave()
  void loadSpecies()
  if (!(await inTurn(load))) return false
  forgetVitrine(account.name)
  useAccountStore.setState({ account, status: 'saved', refusal: null })
  return true
}

/**
 * La réponse de Better Auth (connexion, création du compte) : le compte connecté et sa collection
 * lue (`null`) ; sinon le message à dire (`failure` : celui d'un refus).
 */
export async function openSession(
  {
    data,
    error,
  }: { data: { user: AccountUser } | null; error: { status: number; code?: string } | null },
  failure: (refused: { status: number; code?: string }) => string,
) {
  if (error || !data) return failure(error ?? { status: 0 })
  return (await signIn({ id: data.user.id, name: data.user.name }))
    ? null
    : 'Connecté, mais votre collection n’a pas pu être lue : réessayez dans un instant.'
}

/**
 * Le serveur vient de répondre « sans session » (401) à une action du compte (une connexion sur un
 * autre appareil a fermé celle-ci) : le menu du compte propose de se reconnecter.
 */
export const markExpired = () => setStatus('expired')

/** Le pseudo vient de changer (Réglages › Mon compte) : l'adresse du Pokédex public aussi. */
export function renameAccount(name: string) {
  const { account } = useAccountStore.getState()
  if (!account) return
  forgetVitrine(account.name)
  useAccountStore.setState({ account: { ...account, name } })
}

/** Une modification attend encore d'être enregistrée : à dire avant de se déconnecter. */
export const hasUnsavedChanges = () => edits !== saved

/**
 * Plus de compte en mémoire : ni sa collection (elle reste sur le serveur), ni ses envois en
 * attente.
 */
async function leave() {
  const { account } = useAccountStore.getState()
  useAccountStore.setState({ account: null, status: 'saved', refusal: null })
  clearTimeout(timer)
  clearTimeout(retry)
  await queue
  version = 0
  saved = edits
  loading = true
  replaceDocument({ collection: emptyCollection(), shopping: emptyShopping() })
  loading = false
  if (account) forgetVitrine(account.name)
}

/**
 * Se déconnecter ; `false` si le serveur ne répond pas : rien ne change. Le client Better Auth est
 * chargé ici, à la demande : il n'alourdit pas le premier affichage.
 */
export async function signOut() {
  const { error } = await import('@/lib/auth')
    .then(({ authClient }) => authClient.signOut())
    .catch(() => ({ error: true }))
  if (error) return false
  await leave()
  return true
}

/** Le compte vient d'être supprimé (Réglages › Mon compte) : comme à la déconnexion. */
export const accountDeleted = leave

// Une demi-seconde après chaque modification.
let timer: ReturnType<typeof setTimeout> | undefined
const changed = () => {
  if (loading || !useAccountStore.getState().account) return
  edits++
  clearTimeout(timer)
  timer = setTimeout(save, 500)
}
useCollectionStore.subscribe((state, previous) => {
  if (state.collection !== previous.collection) changed()
})
useShoppingStore.subscribe((state, previous) => {
  if (state.shopping !== previous.shopping) changed()
})

// Au retour du réseau, ce qui attend repart ; au retour sur la page, ce qui attend repart, ou la
// collection est relue (changée sur un autre appareil).
window.addEventListener('online', save)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !useAccountStore.getState().account) return
  if (hasUnsavedChanges()) save()
  else void inTurn(async () => !hasUnsavedChanges() && (await load()) && setStatus('saved'))
})
// Quitter la page avec une modification pas encore enregistrée : le navigateur le demande.
window.addEventListener('beforeunload', (event) => {
  if (hasUnsavedChanges()) event.preventDefault()
})
