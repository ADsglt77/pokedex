/**
 * Les prix Cardmarket : ceux du jour, demandés pour les seules cartes affichées (l'API du site,
 * `/api/prices/collection` pour celles de la collection, `/api/prices/selection` pour les autres :
 * une extension du catalogue, les cartes d'un Pokémon, un id saisi), que la tâche d'ingestion
 * `prices` met à jour (`server/jobs/prices.ts`), et leur historique (`/api/prices/<id>` pour une
 * carte, `/api/histories` pour la collection). Les réponses s'ajoutent : une carte dont le prix est
 * connu n'est plus redemandée. Facultatifs : sans eux (serveur arrêté, base encore vide), `null`,
 * et l'app s'affiche sans prix.
 */

import { create } from 'zustand'
import { forget, getJson } from '@/lib/api'
import { historiesOf } from '@/lib/prices'
import { settled } from '@/lib/settled'
import { useCollectionStore } from '@/store/collection'
import type { CardPriceHistory, CollectionData, PriceFile, PriceHistories } from '@/types'

interface PriceState {
  /** Les prix reçus, toutes demandes confondues ; `null` avant la première réponse. */
  prices: PriceFile | null
  /** Les ids dont une réponse est arrivée, avec ou sans prix ce jour. */
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
 * Demande les prix des cartes `ids` qui ne sont pas encore connus, sous le chemin `list` (le service
 * worker garde une copie par chemin : celle de la collection n'est pas remplacée par celle d'une
 * extension). Redemandés après une panne passagère (`getJson`, une minute après au plus tôt).
 */
function requestPrices(list: 'collection' | 'selection', ids: readonly number[]) {
  const { known } = usePriceStore.getState()
  const wanted = [...new Set(ids)].filter((id) => !known.has(id)).sort((a, b) => a - b)
  if (!wanted.length) return
  const response = getJson<PriceFile>(`/api/prices/${list}?ids=${wanted.join()}`)
  if (followed.has(response)) return
  followed.add(response)
  response.then((file) =>
    usePriceStore.setState((state) =>
      // Une réponse d'une autre forme (un serveur pas encore à jour) compte comme pas de prix.
      file?.cards
        ? {
            prices: { date: file.date, cards: { ...state.prices?.cards, ...file.cards } },
            known: new Set([...state.known, ...wanted]),
            failed: new Set([...state.failed].filter((id) => !wanted.includes(id))),
          }
        : { failed: new Set([...state.failed, ...wanted]) },
    ),
  )
}

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

/** Les cartes dont on veut les prix : `ids`, sinon celles de la collection. */
function useWanted(ids?: readonly number[]) {
  const collection = useCollectionStore((state) => state.collection)
  if (ids) return { list: 'selection' as const, wanted: ids }
  return { list: 'collection' as const, wanted: collectionIds(collection) }
}

/**
 * Les prix du jour des cartes `ids` (sans `ids` : celles de la collection), demandés s'ils ne sont
 * pas encore connus ; `null` tant que leur réponse n'est pas arrivée, ou sans prix. Les prix rendus
 * peuvent aussi en contenir d'autres : `priceOf` lit celui de chaque carte, par son id.
 */
export function usePrices(ids?: readonly number[]) {
  const { list, wanted } = useWanted(ids)
  requestPrices(list, wanted)
  return usePriceStore((state) =>
    wanted.every((id) => state.known.has(id)) ? (state.prices ?? NO_CARDS) : null,
  )
}

/**
 * Les prix de ces cartes (sans `ids` : celles de la collection) ont été demandés, et ils manquent :
 * on peut le dire (pas en chargement).
 */
export function usePricesMissing(ids?: readonly number[]) {
  const { list, wanted } = useWanted(ids)
  requestPrices(list, wanted)
  return usePriceStore((state) => wanted.some((id) => state.failed.has(id)))
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
