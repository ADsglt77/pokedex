/**
 * Les prix Cardmarket : ceux du jour, demandés pour les seules cartes affichées (`/api/prices`, par
 * paquets de 200 : celles de la collection, d'une extension du catalogue, d'un Pokémon, un id
 * saisi), que l'API des données met à jour (sa tâche `prices`), et leur historique
 * (`/api/prices/<id>` pour une carte, `/api/histories` pour la collection, gardés par id). Les
 * réponses s'ajoutent : une carte dont le prix ou l'historique est connu n'est plus redemandée,
 * sauf au retour sur une page restée ouverte plus de 6 h (`refreshPrices`). Facultatifs : sans eux
 * (serveur arrêté, base encore vide), `null`, et l'app s'affiche sans prix. Et les lignes de la
 * liste de souhaits Cardmarket (`/api/wants`), demandées par paquets comme les historiques.
 */

import { create } from 'zustand'
import { fetchFresh, forget, getJson, markFailed, retryDue } from '@/lib/api'
import { historiesOf, loadInBatches, priceBatches } from '@/lib/prices'
import { settled } from '@/lib/settled'
import { HOUR } from '@/lib/time'
import { useCollectionStore } from '@/store/collection'
import type {
  CardPriceHistory,
  CollectionData,
  PriceFile,
  PriceHistories,
  WantsLines,
} from '@/types'

interface PriceState {
  /**
   * Les prix reçus, toutes demandes confondues (une clé par carte qui a eu sa réponse, `null` sans
   * prix ce jour) ; `null` avant la première réponse.
   */
  prices: PriceFile | null
  /** Les ids dont une réponse est arrivée depuis le dernier rafraîchissement, avec ou sans prix. */
  known: ReadonlySet<number>
  /** Les ids dont la demande a échoué (serveur arrêté, prix jamais lus) : redemandés plus tard. */
  failed: ReadonlySet<number>
}

const usePriceStore = create<PriceState>(() => ({
  prices: null,
  known: new Set(),
  failed: new Set(),
}))

/** Sans carte à chiffrer (une collection vide) : des prix, sans aucune carte. */
const NO_CARDS: PriceFile = { date: '', cards: {} }

/** Les réponses déjà suivies : une même réponse de `getJson` n'est lue qu'une fois. */
const followed = new WeakSet<Promise<PriceFile | null>>()

/** Les paquets fixes de chaque liste (`priceBatches`), coupés une fois pour toutes. */
const batchesOf = new WeakMap<readonly number[], number[][]>()

/**
 * Les listes déjà demandées : l'état des prix à ce moment, et quand. Des centaines de montants
 * demandent la même liste à chaque rendu : elle n'est revue que si l'état a changé depuis (une
 * réponse, une panne), ou si l'une de ses cartes est en panne depuis une minute (redemandable,
 * `getJson`).
 */
const requested = new WeakMap<readonly number[], { state: PriceState; at: number }>()

/**
 * Les adresses déjà demandées (prix du jour, historiques) : oubliées pour les redemander
 * (`refreshPrices`).
 */
const priceUrls = new Set<string>()

/** L'heure de la dernière réponse des prix (ms), avec ou sans prix. */
let answeredAt = 0

/**
 * Les historiques reçus pour la collection, par id Cardmarket (`null` : le serveur n'en a pas) :
 * une carte possédée de plus n'en fait demander qu'un, pas toute la collection. Oubliés au
 * rafraîchissement des prix (`refreshPrices`).
 */
const histories = new Map<number, CardPriceHistory | null>()

/**
 * La dernière liste d'historiques demandée (`loadPriceHistories`) : sa promesse, la même pour la
 * même liste (lue par `use()`), et l'heure de sa panne.
 */
let lastHistories: {
  key: string
  histories: Promise<CardPriceHistory[] | null>
  failedAt?: number
} | null = null

/**
 * Demande les prix des cartes `ids` qui ne sont pas encore connus : les paquets fixes de 200 de la
 * liste (`priceBatches` : une collection de plusieurs extensions en a des milliers) dont une carte
 * n'a pas encore sa réponse ; le serveur répond pour chaque carte (`null` sans prix). Redemandés
 * après une panne (`getJson`, une minute après au plus tôt).
 */
function requestPrices(ids: readonly number[]) {
  const state = usePriceStore.getState()
  const last = requested.get(ids)
  if (last?.state === state && !(check(state, ids).missing && retryDue(last.at))) return
  requested.set(ids, { state, at: Date.now() })
  let batches = batchesOf.get(ids)
  if (!batches) batchesOf.set(ids, (batches = priceBatches(ids)))
  requestBatches(batches.filter((batch) => batch.some((id) => !state.known.has(id))))
}

/** La réponse d'un paquet de prix, et ses cartes. */
interface Answer {
  url: string
  batch: readonly number[]
  file: PriceFile | null
}

/**
 * Demande les prix de ces paquets, une demande chacun (une demande en cours ou en panne n'est pas
 * refaite : `getJson`), et ajoute leurs réponses aux autres en une fois : un rafraîchissement en a
 * des dizaines, et chaque montant affiché se redessinerait à chacune.
 */
function requestBatches(batches: readonly number[][]) {
  const answers = batches.flatMap((batch) => {
    const url = `/api/prices?ids=${batch.join()}`
    priceUrls.add(url)
    const response = getJson<PriceFile>(url)
    if (followed.has(response)) return []
    followed.add(response)
    return [response.then((file): Answer => ({ url, batch, file }))]
  })
  if (answers.length === 0) return
  void Promise.all(answers).then((files) => {
    answeredAt = Date.now()
    // Un 404 (des prix pas encore lus) ou une réponse d'une autre forme (un serveur pas encore à
    // jour) : une panne passagère, redemandée une minute après au plus tôt.
    for (const { url, file } of files) if (!file?.cards) markFailed(url)
    usePriceStore.setState((state) => withAnswers(state, files))
  })
}

/**
 * L'état des prix, ces réponses ajoutées. En panne, seules les cartes encore sans réponse sont en
 * échec : un prix déjà là reste valable.
 */
function withAnswers(state: PriceState, files: readonly Answer[]): PriceState {
  const cards = { ...state.prices?.cards }
  const known = new Set(state.known)
  const failed = new Set(state.failed)
  let date: string | null = null
  for (const { batch, file } of files) {
    if (file?.cards) {
      Object.assign(cards, file.cards)
      date = file.date
      for (const id of batch) {
        known.add(id)
        failed.delete(id)
      }
    } else for (const id of batch) if (!known.has(id)) failed.add(id)
  }
  return { prices: date === null ? state.prices : { date, cards }, known, failed }
}

/**
 * Redemande les prix et les historiques de tout ce qui est affiché : la tâche des prix les met à
 * jour toutes les 6 h, et une page (une app installée) reste ouverte des jours. Les prix déjà reçus
 * restent affichés en attendant les nouveaux.
 */
function refreshPrices() {
  for (const url of priceUrls) forget(url)
  priceUrls.clear()
  histories.clear()
  lastHistories = null
  // Des prix neufs (les mêmes) : chaque montant affiché se redessine, et redemande les siens.
  usePriceStore.setState((state) => ({
    prices: state.prices && { ...state.prices },
    known: new Set(),
    failed: new Set(),
  }))
}

// Au retour sur la page, plus de 6 h après la dernière réponse.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && answeredAt && Date.now() - answeredAt > 6 * HOUR) {
    refreshPrices()
  }
})

const idsOfCollection = new WeakMap<CollectionData, number[]>()

/** Les ids Cardmarket des cartes de la collection, calculés une fois par collection. */
function collectionIds(collection: CollectionData) {
  let ids = idsOfCollection.get(collection)
  if (!ids) {
    ids = Object.values(collection.customCards).flatMap((card) => card.cardmarket ?? [])
    idsOfCollection.set(collection, ids)
  }
  return ids
}

/** Ces cartes ont-elles leur réponse, et l'une d'elles a-t-elle échoué : une fois par état et par liste. */
const checked = new WeakMap<
  PriceState,
  WeakMap<readonly number[], { ready: boolean; missing: boolean }>
>()

function check(state: PriceState, wanted: readonly number[]) {
  let byList = checked.get(state)
  if (!byList) checked.set(state, (byList = new WeakMap()))
  let result = byList.get(wanted)
  if (!result) {
    // Une carte déjà reçue (avant un rafraîchissement, `refreshPrices`) est prête : son prix
    // reste affiché en attendant le nouveau.
    const cards = state.prices?.cards ?? {}
    result = {
      ready: wanted.every((id) => state.known.has(id) || id in cards),
      missing: wanted.some((id) => state.failed.has(id)),
    }
    byList.set(wanted, result)
  }
  return result
}

/**
 * Les cartes dont on veut les prix : `ids`, sinon celles de la collection (suivie seulement dans
 * ce cas : une extension du catalogue ne se redessine pas à chaque changement de la collection).
 */
function useWanted(ids?: readonly number[]) {
  const collection = useCollectionStore((state) => (ids ? null : state.collection))
  return ids ?? collectionIds(collection!)
}

/**
 * Les prix du jour des cartes `ids` (sans `ids` : celles de la collection), demandés s'ils ne sont
 * pas encore connus ; `null` tant que leur réponse n'est pas arrivée, ou sans prix. Les prix rendus
 * peuvent aussi en contenir d'autres : `priceOf` lit celui de chaque carte, par son id.
 */
export function usePrices(ids?: readonly number[]) {
  const wanted = useWanted(ids)
  requestPrices(wanted)
  return usePriceStore((state) => (check(state, wanted).ready ? (state.prices ?? NO_CARDS) : null))
}

/**
 * Les prix de ces cartes (sans `ids` : celles de la collection) ont été demandés, et ils manquent :
 * on peut le dire (pas en chargement).
 */
export function usePricesMissing(ids?: readonly number[]) {
  const wanted = useWanted(ids)
  requestPrices(wanted)
  return usePriceStore((state) => check(state, wanted).missing)
}

/**
 * L'historique d'une carte Cardmarket (son nom et ses prix), chargé à la demande ; `null` si le
 * serveur ne la connaît pas, ou ne répond pas en 10 s (l'enregistrement d'une carte l'attend : la
 * fenêtre ne doit pas rester bloquée ; redemandé plus tard). La même promesse pour un id, lue par
 * `use()`, jusqu'au rafraîchissement des prix (`refreshPrices`).
 */
export function loadPriceHistory(cardmarket: number) {
  const url = `/api/prices/${cardmarket}`
  priceUrls.add(url)
  return getJson<CardPriceHistory>(url, 10_000)
}

/**
 * Les historiques des cartes `cardmarkets` (au moins une) : ceux déjà reçus, et les autres
 * demandés au serveur (`/api/histories`, chaque id une fois, par paquets de 1 000 l'un après
 * l'autre : `loadInBatches`), relus dans l'ordre de la liste (`historiesOf`) ; `null` si le serveur
 * ne répond pas pour l'un des paquets (une courbe partielle serait fausse ; redemandés une minute
 * après au plus tôt, la prochaine fois qu'ils servent, `getJson`). La même promesse pour la même
 * liste, lue par `use()`.
 */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  if (lastHistories?.key === key && !retryDue(lastHistories.failedAt)) {
    return lastHistories.histories
  }
  const unknown = cardmarkets.filter((id) => !histories.has(id))
  const current: NonNullable<typeof lastHistories> = {
    key,
    histories: settled(
      loadInBatches(unknown, (batch) => {
        const url = `/api/histories?ids=${batch.join()}`
        priceUrls.add(url)
        return getJson<PriceHistories>(url)
      }).then((found) => {
        if (!found) {
          current.failedAt = Date.now()
          return null
        }
        for (const id of unknown) histories.set(id, found[id] ?? null)
        return historiesOf(histories, cardmarkets)
      }),
    ),
  }
  lastHistories = current
  return current.histories
}

/**
 * Les lignes des produits Cardmarket `ids` pour « Ajouter une deck list » d'une liste de souhaits
 * (`/api/wants`), demandées à chaque appel (`fetchFresh`), par paquets de 1 000 l'un après l'autre
 * (`loadInBatches` : l'API en refuse plus de 1 025, et un plan de cases d'extensions à quelques
 * centimes les dépasse), réunies ; `null` s'il en manque un. Lue par `use()`.
 */
export const loadWantsLines = (ids: readonly number[]) =>
  settled(loadInBatches(ids, (batch) => fetchFresh<WantsLines>(`/api/wants?ids=${batch.join()}`)))
