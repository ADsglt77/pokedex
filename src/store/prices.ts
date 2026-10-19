/**
 * Les prix Cardmarket : ceux du jour, demandés pour les seules cartes affichées (l'API du site,
 * `/api/prices/collection` pour celles de la collection, `/api/prices/selection` pour les autres :
 * une extension du catalogue, les cartes d'un Pokémon, un id saisi), que la tâche d'ingestion
 * `prices` met à jour (`server/jobs/prices.ts`), et leur historique (`/api/prices/<id>` pour une
 * carte, `/api/histories` pour la collection). Les réponses s'ajoutent : une carte dont le prix est
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
  /**
   * Les ids dont la demande a échoué (serveur arrêté, prix jamais lus) ou est restée sans réponse
   * (une copie du service worker faite pour d'autres cartes) : redemandés plus tard.
   */
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
 * Demande les prix des cartes `ids` qui ne sont pas encore connus, sous le chemin `list` (le service
 * worker garde une copie par chemin : celle de la collection n'est pas remplacée par celle d'une
 * extension). Le serveur répond pour chaque carte (`null` sans prix) : une carte absente de la
 * réponse vient d'une copie du service worker faite pour d'autres cartes, et compte comme une panne
 * passagère. Redemandés après une panne (`getJson`, une minute après au plus tôt).
 */
function requestPrices(list: 'collection' | 'selection', ids: readonly number[]) {
  const { known, failed } = usePriceStore.getState()
  // Une panne : redemandée (`getJson` attend une minute) à chaque rendu, comme avant.
  if (requested.get(ids) === known && (!failed.size || !ids.some((id) => failed.has(id)))) return
  requested.set(ids, known)
  const wanted = [...new Set(ids)].filter((id) => !known.has(id)).sort((a, b) => a - b)
  if (!wanted.length) return
  const url = `/api/prices/${list}?ids=${wanted.join()}`
  priceUrls.add(url)
  const response = getJson<PriceFile>(url)
  if (followed.has(response)) return
  followed.add(response)
  response.then((file) => {
    // Une réponse d'une autre forme (un serveur pas encore à jour) compte comme pas de prix.
    const answered = file?.cards ? wanted.filter((id) => id in file.cards) : []
    const missing = wanted.filter((id) => !answered.includes(id))
    // Sans réponse pour certaines : redemandées une minute plus tard, même sans nouvel affichage.
    if (file?.cards && missing.length) setTimeout(() => requestPrices(list, missing), 60_000)
    if (answered.length) answeredAt = Date.now()
    usePriceStore.setState((state) => ({
      prices: file?.cards
        ? { date: file.date, cards: { ...state.prices?.cards, ...file.cards } }
        : state.prices,
      known: new Set([...state.known, ...answered]),
      failed: new Set([...[...state.failed].filter((id) => !answered.includes(id)), ...missing]),
    }))
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
  if (ids) return { list: 'selection' as const, wanted: ids }
  return { list: 'collection' as const, wanted: collectionIds(collection!) }
}

/**
 * Les prix du jour des cartes `ids` (sans `ids` : celles de la collection), demandés s'ils ne sont
 * pas encore connus ; `null` tant que leur réponse n'est pas arrivée, ou sans prix. Les prix rendus
 * peuvent aussi en contenir d'autres : `priceOf` lit celui de chaque carte, par son id.
 */
export function usePrices(ids?: readonly number[]) {
  const { list, wanted } = useWanted(ids)
  requestPrices(list, wanted)
  return usePriceStore((state) => (check(state, wanted).ready ? (state.prices ?? NO_CARDS) : null))
}

/**
 * Les prix de ces cartes (sans `ids` : celles de la collection) ont été demandés, et ils manquent :
 * on peut le dire (pas en chargement).
 */
export function usePricesMissing(ids?: readonly number[]) {
  const { list, wanted } = useWanted(ids)
  requestPrices(list, wanted)
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

/** Les historiques d'une collection (`loadPriceHistories`). */
interface CollectionHistories {
  histories: CardPriceHistory[]
  /** Les cartes absentes de la réponse : celle gardée par le service worker, d'avant elles. */
  missing: number
}

/**
 * La dernière liste demandée, seule gardée : une liste d'avant (la collection a changé depuis) ne
 * revient pas, et sa réponse (les historiques de toute la collection) pèse plusieurs Mo.
 */
let last: {
  url: string
  key: string
  response: Promise<PriceHistories | null>
  histories: Promise<CollectionHistories | null>
} | null = null

/**
 * Les historiques des cartes `cardmarkets` (au moins une), ceux que le serveur connaît, en une
 * demande (`/api/histories`, chaque id une fois) relue dans l'ordre de la liste (`historiesOf`) ;
 * `null` si le serveur ne répond pas. Le serveur répond pour chaque id (`null` sans historique) : un
 * id absent vient d'une copie du service worker demandée avec d'autres ids (sans réseau, ou sans
 * réponse en 4 s), comptée dans `missing`. La même promesse pour la même liste, lue par `use()`,
 * refaite quand la réponse est redemandée après une panne (`getJson`).
 */
export function loadPriceHistories(cardmarkets: readonly number[]) {
  const key = cardmarkets.join()
  const url = `/api/histories?ids=${[...new Set(cardmarkets)].join()}`
  if (last && last.url !== url) forget(last.url)
  const response = getJson<PriceHistories>(url)
  if (last?.key === key && last.response === response) return last.histories
  const histories = settled(
    response.then(
      (found) =>
        found && {
          histories: historiesOf(found, cardmarkets),
          missing: cardmarkets.filter((id) => !(id in found)).length,
        },
    ),
  )
  last = { url, key, response, histories }
  return histories
}
