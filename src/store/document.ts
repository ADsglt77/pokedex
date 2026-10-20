/**
 * Le document du compte : la collection et les achats, ensemble (une commande modifie les deux).
 * Ce qu'envoie `store/account.ts`, ce que rétablit « Annuler », ce que remplace un import.
 */

import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CollectionDocument } from '@/types'

export const currentDocument = (): CollectionDocument => ({
  collection: useCollectionStore.getState().collection,
  shopping: useShoppingStore.getState().shopping,
})

/** Rien n'a changé de l'un à l'autre : les stores remplacent leurs données, sans les modifier. */
export const sameDocument = (a: CollectionDocument, b: CollectionDocument) =>
  a.collection === b.collection && a.shopping === b.shopping

/** Remplace la collection et les achats. */
export function replaceDocument(document: CollectionDocument) {
  useCollectionStore.getState().replaceCollection(document.collection)
  useShoppingStore.getState().replaceShopping(document.shopping)
}
