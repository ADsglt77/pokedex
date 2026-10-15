/**
 * Le document de cet appareil : la collection et les achats, ensemble (une commande modifie les
 * deux). Ce que synchronise `store/sync.ts`, ce que rétablit « Annuler », ce que remplace un import.
 */

import type { SyncDocument } from '@/lib/sync'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CollectionData, ShoppingData } from '@/types'

export const currentDocument = (): SyncDocument => ({
  collection: useCollectionStore.getState().collection,
  shopping: useShoppingStore.getState().shopping,
})

/** Rien n'a changé de l'un à l'autre : les stores remplacent leurs données, sans les modifier. */
export const sameDocument = (a: SyncDocument, b: SyncDocument) =>
  a.collection === b.collection && a.shopping === b.shopping

/** Remplace la collection et les achats ; sans achats (un export d'avant eux), ils restent. */
export function replaceDocument(document: {
  collection: CollectionData
  shopping: ShoppingData | null
}) {
  useCollectionStore.getState().replaceCollection(document.collection)
  if (document.shopping) useShoppingStore.getState().replaceShopping(document.shopping)
}
