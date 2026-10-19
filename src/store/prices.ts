/**
 * Les prix Cardmarket : ceux du jour, demandés pour les seules cartes affichées (`/api/prices` :
 * celles de la collection, d'une extension du catalogue, d'un Pokémon, un id saisi), que l'API des
 * données met à jour (sa tâche `prices`), et leur historique (`/api/prices/<id>` pour une carte,
 * `/api/histories` pour la collection). Les réponses s'ajoutent : une carte dont le prix est
 * connu n'est plus redemandée, sauf au retour sur une page restée ouverte plus de 6 h
 * (`refreshPrices`). Facultatifs : sans eux (serveur arrêté, base encore vide), `null`, et l'app
 * s'affiche sans prix.
 */

import { create } from 'zustand'
import { forget, getJson } from '@/lib/api'
import { historiesOf } from '@/lib/prices'
import { settled } from '@/lib/settled'
import { HOUR } from '@/lib/time'
import { useCollectionStore } from '@/store/collection'
import type { CardPriceHistory, CollectionData, PriceFile, PriceHistories } from '@/types'

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

/**
 * Les listes déjà demandées, et les ids connus à ce moment : la même liste n'est revue que quand
 * une réponse est arrivée depuis (des centaines de montants la demandent à chaque rendu).
 */
const requested = new WeakMap<readonly number[], ReadonlySet<number>>()

/** Les adresses des prix déjà demandées : oubliées pour les redemander (`refreshPrices`). */
const priceUrls = new Set<string>()

/** L'heure de la dernière réponse des prix (ms). */
let answeredAt = 0

/**
 * Demande les prix des cartes `ids` qui ne sont pas encore connus ; le serveur répond pour chaque
 * carte (`null` sans prix). Redemandés après une panne (`getJson`, une minute après au plus tôt).
 */
function requestPrices(ids: readonly number[]) {
  const { known, failed } = usePriceStore.getState()
  // Une panne : redemandée (`getJson` attend une minute) à chaque rendu, comme avant.
  if (requested.get(ids) === known && (!failed.size || !ids.some((id) => failed.has(id)))) return
  requested.set(ids, known)
  const wanted = [...new Set(ids)].filter((id) => !known.has(id)).sort((a, b) => a - b)
  if (!wanted.length) return
  const url = `/api/prices?ids=${wanted.join()}`
  priceUrls.add(url)
  const response = getJson<PriceFile>(url)
  if (followed.has(response)) return
  followed.add(response)
  response.then((file) => {
    // Une réponse d'une autre forme (un serveur pas encore à jour) compte comme une panne.
    if (file?.cards) answeredAt = Date.now()
    usePriceStore.setState((state) =>
      file?.cards
        ? {
            prices: { date: file.date, cards: { ...state.prices?.cards, ...file.cards } },
            known: new Set([...state.known, ...wanted]),
            failed: new Set([...state.failed].filter((id) => !wanted.includes(id))),
          }
        : { failed: new Set([...state.failed, ...wanted]) },
    )
  })
}

/**
 * Redemande les prix de tout ce qui est affiché : la tâche des prix les met à jour toutes les 6 h,
 * et une page (une app installée) reste ouverte des jours. Ceux déjà reçus restent affichés en
 * attendant les nouveaux.
 */
function refreshPrices() {
  for (const url of priceUrls) forget(url)
  priceUrls.clear()
  // Des prix neufs (les mêmes) : chaque montant affiché se redessine, et redemande les siens.
  usePriceStore.setState((state) => ({
    prices: state.prices && { ...state.prices },
    known: new Set(),
    failed: new Set(),
  }))
}

// Au retour sur la page, après plus de 6 h sans réponse.
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
 * `use()`.
 */
export const loadPriceHistory = (cardmarket: number) =>
  getJson<CardPriceHistory>(`/api/prices/${cardmarket}`, 10_000)

/**
 * La dernière liste demandée, seule gardée : une liste d'avant (la collection a changé depuis) ne
 * revient pas, et sa réponse (les historiques de toute la collection) pèse plusieurs Mo.
 */
let last: {
  url: string
  key: string
  response: Promise<PriceHistories | null>
  histories: Promise<CardPriceHistory[] | null>
} | null = null

/**
 * Les historiques des cartes `cardmarkets` (au moins une), ceux que le serveur connaît, en une
 * demande (`/api/histories`, chaque id une fois) relue dans l'ordre de la liste (`historiesOf`) ;
 * `null` si le serveur ne répond pas. La même promesse pour la même liste, lue par `use()`, refaite
 * quand la réponse est redemandée après une panne (`getJson`).
 */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  const url = `/api/histories?ids=${[...new Set(cardmarkets)].join()}`
  if (last && last.url !== url) forget(last.url)
  const response = getJson<PriceHistories>(url)
  if (last?.key === key && last.response === response) return last.histories
  const histories = settled(response.then((found) => found && historiesOf(found, cardmarkets)))
  last = { url, key, response, histories }
  return histories
}
