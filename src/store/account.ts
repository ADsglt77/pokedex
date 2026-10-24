/**
 * Le compte connecté et sa collection, gardée par le serveur seul (`/api/collection`,
 * `server/collection.ts`) : lue à la connexion, gardée en mémoire, et chaque modification envoyée
 * compressée une demi-seconde après (un échange à la fois), aussitôt si la page passe en
 * arrière-plan (un téléphone peut la geler, puis la fermer). Rien n'est gardé dans le navigateur :
 * sans réseau, rien ne s'enregistre (le menu du compte le dit, l'envoi repart au retour du réseau
 * ou de la page, et de plus en plus espacé d'ici là ; quitter la page le demande d'abord). Chaque
 * envoi part de la version lue (`version`) : changée ailleurs entre-temps (un autre onglet, un
 * autre appareil), le serveur la refuse (409) et l'app relit la sienne, sans rien écraser ; il
 * porte aussi le compte d'où il vient : parti juste après une connexion à un autre compte, le
 * serveur le refuse (401). Un envoi resté sans réponse repart d'abord tel quel : déjà enregistré,
 * le serveur le reconnaît. Refusée pour de bon (« Envoi refusé »), la collection reste à
 * enregistrer, sans repartir telle quelle. Au retour sur la page, ou quand un autre onglet vient
 * d'enregistrer, la collection est relue si rien n'attend d'être envoyé, et seulement si elle a
 * changé ; jamais celle d'un autre compte ; une modification faite pendant cette lecture n'est pas
 * écrasée (`load`). Sans connexion, l'app ne s'ouvre pas : on voit la connexion, ou le Pokédex
 * public d'un compte (`router.tsx`).
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
import type { AccountUser, CollectionDocument, CollectionResponse, CollectionSaved } from '@/types'

/**
 * - `saved` : tout est enregistré ; `saving` : un envoi en cours ;
 * - `offline` : le serveur ne répond pas, la modification attend ;
 * - `expired` : la session est fermée (ou c'est celle d'un autre compte), il faut se reconnecter ;
 *   ce qui attend part alors ;
 * - `reloaded` : changée ailleurs, la collection a été relue (la dernière modification d'ici
 *   n'est pas enregistrée) ;
 * - `refused` : le serveur refuse la collection (`refusal` dit pourquoi) ; elle attend une
 *   nouvelle modification.
 */
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'expired' | 'reloaded' | 'refused'

export const useAccountStore = create<{
  /** Le compte connecté ; `null` : personne (`router.tsx`). */
  account: AccountUser | null
  status: SaveStatus
  /** Pourquoi le serveur refuse la collection (statut `refused`). */
  refusal: string | null
  /** Le poids du dernier document envoyé, en octets, décompressé (0 avant le premier envoi). */
  weight: number
}>(() => ({ account: null, status: 'saved', refusal: null, weight: 0 }))

const setStatus = (status: SaveStatus) => useAccountStore.setState({ status })

/** La version du serveur d'où part la collection en mémoire. */
let version = 0
/**
 * Les modifications faites, et la dernière enregistrée (ou abandonnée : relue après un 409,
 * déconnexion) : égales, rien n'attend. La dernière refusée pour de bon (`refused`) attend encore,
 * mais ne repart pas telle quelle.
 */
let edits = 0
let saved = 0
let refused = 0
/** La collection relue du serveur : ce n'est pas une modification à envoyer. */
let loading = false
/**
 * Un envoi : le numéro de la modification et le document qu'il porte, son corps (compressé ou
 * non, `gzip`).
 */
interface Sending {
  sending: number
  document: CollectionDocument
  body: Blob
  gzip: boolean
}
/** Le dernier envoi resté sans réponse (peut-être enregistré) : il repart tel quel, avant tout. */
let unanswered: Sending | null = null
/**
 * Les essais d'affilée restés sans réponse (ou sans relecture après un 409) : le suivant attend
 * d'autant plus.
 */
let failures = 0

/** Une modification attend encore d'être enregistrée (refusée comprise) : à dire avant de partir. */
export const hasUnsavedChanges = () => edits !== saved

/**
 * Les échanges avec le serveur, un à la fois. Une erreur (une réponse illisible : un portail Wi-Fi
 * qui répond à la place du serveur) : « Hors ligne » et un nouvel essai, si une modification
 * attend ; sinon rien ne change.
 */
let queue: Promise<unknown> = Promise.resolve()
const inTurn = (task: () => Promise<unknown>) =>
  (queue = queue.then(task).catch((error: unknown) => {
    console.error('Échange avec le serveur interrompu', error)
    if (hasUnsavedChanges()) retryLater()
  }))

/**
 * Un appel à l'API ; `null` sans réponse (hors ligne, serveur arrêté). Le délai d'un envoi grandit
 * avec lui : 15 s, plus 10 s par Mo envoyé (un réseau lent).
 */
const call = (method: 'GET' | 'PUT', query = '', sent?: Sending) =>
  fetch(`/api/collection${query}`, {
    method,
    body: sent?.body,
    cache: 'no-store',
    headers: sent && {
      'Content-Type': 'application/json',
      ...(sent.gzip && { 'Content-Encoding': 'gzip' }),
    },
    signal: AbortSignal.timeout(15_000 + ((sent?.body.size ?? 0) / 1_000_000) * 10_000),
  }).catch(() => null)

/**
 * Relit la collection du serveur, à la place de celle en mémoire ; `false` sans réponse, la session
 * fermée, ou celle d'un autre compte (connecté entre-temps dans un autre onglet) : `expired`, et
 * rien n'est remplacé. Sans rien en attente, elle n'est lue que changée depuis la version en
 * mémoire (`?version=`) : inchangée, rien n'est remplacé (« Annuler » garde ses références, rien ne
 * se redessine). Une modification faite pendant la lecture n'est pas écrasée : la collection en
 * mémoire reste, et l'envoi qui attend part de la version d'avant (changée ailleurs entre-temps, le
 * serveur la refuse, 409, et elle est relue). Relue, son poids est connu (l'avertissement des 80 %).
 */
async function load(account: string) {
  const before = edits
  const response = await call('GET', hasUnsavedChanges() ? '' : `?version=${version}`)
  if (response?.status === 401) setStatus('expired')
  if (!response?.ok) return false
  const text = await response.text()
  const body = JSON.parse(text) as CollectionResponse
  if (body.account !== account) {
    setStatus('expired')
    return false
  }
  if (edits !== before || body.collection === undefined) return true
  version = body.version
  saved = edits
  useAccountStore.setState({ weight: new Blob([text]).size })
  loading = true
  // Lue comme un fichier importé : seuls ses champs connus.
  replaceDocument({
    collection: readCollection(body.collection) ?? emptyCollection(),
    shopping: readShopping(body.shopping) ?? emptyShopping(),
  })
  loading = false
  return true
}

/** Relit la collection, si rien n'attend d'être envoyé (changée sur un autre appareil, un autre onglet). */
const refresh = (account: string) =>
  void inTurn(async () => !hasUnsavedChanges() && (await load(account)) && setStatus('saved'))

let retry: ReturnType<typeof setTimeout> | undefined

/**
 * Sans réponse, ou une panne passagère (502 pendant un redémarrage) : « Hors ligne », et l'envoi
 * repart de plus en plus tard (30 s, 60 s, 120 s… 5 min au plus) ; au retour du réseau ou de la
 * page, aussitôt.
 */
function retryLater() {
  setStatus('offline')
  clearTimeout(retry)
  retry = setTimeout(save, Math.min(30_000 * 2 ** failures++, 300_000))
}

/**
 * Un document à envoyer, compressé (`gzip`) si le navigateur le sait, et son poids décompressé, en
 * octets. `CompressionStream` manque à Safari avant 16.4 et à Firefox avant 113 : le document part
 * alors tel quel, que le serveur accepte aussi.
 */
async function pack(text: string) {
  const raw = new Blob([text])
  if (typeof CompressionStream === 'undefined') return { body: raw, gzip: false, weight: raw.size }
  const compressed = raw.stream().pipeThrough(new CompressionStream('gzip'))
  return { body: await new Response(compressed).blob(), gzip: true, weight: raw.size }
}

/** Un autre onglet de ce navigateur vient d'enregistrer : `{ account, version }`. */
const channel = new BroadcastChannel('collection')

/**
 * Envoie la collection, si une modification attend : ni la session fermée (il faut se
 * reconnecter), ni la collection refusée telle quelle (seule une nouvelle modification repart). Un
 * envoi resté sans réponse repart d'abord tel quel (déjà enregistré, le serveur le reconnaît), puis
 * ce qui a changé depuis.
 */
async function push(): Promise<void> {
  const { account, status } = useAccountStore.getState()
  if (edits === saved || !account || status === 'expired') return
  if (edits === refused) return setStatus('refused')
  setStatus('saving')
  const resent = unanswered !== null
  if (!unanswered) {
    // Le numéro et le document, lus ensemble avant toute attente : une modification faite pendant
    // la compression n'est pas comptée comme envoyée, elle part ensuite.
    const sending = edits
    const document = currentDocument()
    const { body, gzip, weight } = await pack(
      JSON.stringify({ account: account.id, baseVersion: version, ...document }),
    )
    unanswered = { sending, document, body, gzip }
    useAccountStore.setState({ weight })
  }
  const sent = unanswered
  const response = await call('PUT', '', sent)
  if (!response || response.status >= 500) return retryLater()
  // Refusé sans être lu (la session fermée), ou une réponse illisible (coupée) : l'envoi reste
  // sans réponse, et repartira tel quel.
  if (response.status === 401) return setStatus('expired')
  const answer = response.ok ? ((await response.json()) as CollectionSaved) : null
  unanswered = null
  if (answer) {
    failures = 0
    version = answer.version
    saved = sent.sending
    channel.postMessage({ account: account.id, version })
    if (edits === saved) setStatus('saved')
    // Renvoyé tel quel : ce qui a changé depuis part à son tour.
    else if (resent) return push()
    return
  }
  if (response.status === 409) {
    // La version du serveur, relue à la place de celle d'ici ; une modification faite pendant la
    // lecture part encore (`load`). Sans réponse, l'envoi repartira (refusé, puis relu), de plus en
    // plus tard : les essais ne repartent de zéro qu'une fois la collection relue.
    if (await load(account.id)) {
      failures = 0
      if (!hasUnsavedChanges()) setStatus('reloaded')
    } else if (useAccountStore.getState().status !== 'expired') retryLater()
    return
  }
  // Refusée pour de bon : la règle en cause (relue ici avec le même code, sur le document envoyé),
  // trop grosse, ou une origine refusée (l'adresse du site n'est pas celle que connaît le serveur).
  // Elle reste à enregistrer (la déconnexion propose l'export), mais ne repart pas telle quelle. Un
  // renvoi refusé alors que d'autres modifications attendent : elles partent à leur tour.
  failures = 0
  refused = sent.sending
  if (resent && edits !== refused) return push()
  useAccountStore.setState({
    status: 'refused',
    refusal:
      response.status === 403
        ? 'il refuse les envois depuis cette adresse, que son réglage BETTER_AUTH_URL ne nomme pas'
        : response.status === 413
          ? 'elle dépasse 5 Mo'
          : (documentProblem(sent.document) ?? 'elle ne passe pas ses contrôles'),
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
 * que la coquille attendra (`router.tsx`), sont demandées en même temps. Reconnecté au même compte
 * (« Se reconnecter », sa session fermée) avec une modification en attente : elle reste, et part
 * depuis sa version (changée ailleurs entre-temps, le serveur la refuse, 409, et elle est relue).
 */
export async function signIn(account: AccountUser) {
  if (account.id === useAccountStore.getState().account?.id && hasUnsavedChanges()) {
    forgetVitrine(account.name)
    useAccountStore.setState({ account, status: 'saving' })
    save()
    return true
  }
  await leave()
  void loadSpecies()
  if (!(await inTurn(() => load(account.id)))) return false
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
    : 'Connecté, mais votre collection n’a pas pu être lue\u00a0: réessayez dans un instant.'
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

/**
 * Plus de compte en mémoire : ni sa collection (elle reste sur le serveur), ni ses envois en
 * attente.
 */
async function leave() {
  const { account } = useAccountStore.getState()
  useAccountStore.setState({ account: null, status: 'saved', refusal: null, weight: 0 })
  clearTimeout(timer)
  clearTimeout(retry)
  await queue
  version = 0
  saved = edits
  unanswered = null
  failures = 0
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

// Au retour du réseau, ce qui attend repart. La page passe en arrière-plan : ce qui attend part
// aussitôt. Elle revient : ce qui attend repart, ou la collection est relue (changée sur un autre
// appareil). Rien tant que la session est fermée.
window.addEventListener('online', save)
document.addEventListener('visibilitychange', () => {
  const { account, status } = useAccountStore.getState()
  if (!account || status === 'expired') return
  if (hasUnsavedChanges()) {
    clearTimeout(timer)
    save()
  } else if (document.visibilityState === 'visible') refresh(account.id)
})
// Un autre onglet vient d'enregistrer : celui-ci relit la collection, si rien n'y attend (sinon,
// son envoi est refusé, 409, et elle est relue).
channel.onmessage = ({ data }: MessageEvent<{ account: string; version: number }>) => {
  const { account, status } = useAccountStore.getState()
  if (account?.id === data.account && data.version !== version && status !== 'expired') {
    refresh(account.id)
  }
}
// Quitter la page avec une modification pas encore enregistrée : le navigateur le demande.
window.addEventListener('beforeunload', (event) => {
  if (hasUnsavedChanges()) event.preventDefault()
})
