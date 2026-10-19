/**
 * Les achats : commandes et budget. Un store Zustand à part, en mémoire, envoyé au serveur avec la
 * collection (`store/account.ts`). Une commande met aussi à jour les statuts de ses cartes dans la
 * collection (voir `applyOrder`).
 */

import { create } from 'zustand'
import { updateBudget } from '@/lib/budget'
import { applyOrder, emptyShopping, previousOf, sortOrders } from '@/lib/orders'
import { useCollectionStore } from '@/store/collection'
import type { BudgetSettings, Order, ShoppingData } from '@/types'

interface ShoppingStore {
  shopping: ShoppingData
  setBudget: (change: Partial<BudgetSettings>) => void
  /** Enregistre une commande, nouvelle ou modifiée, et la reporte sur la collection. */
  saveOrder: (order: Order) => void
  /** Retire une commande ; ses cartes encore « commandée » retrouvent leur état d'avant. */
  deleteOrder: (orderId: string) => void
  /** Remplace tous les achats : lus sur le serveur, import. */
  replaceShopping: (shopping: ShoppingData) => void
}

export const useShoppingStore = create<ShoppingStore>()((set, get) => {
  /**
   * Passe la commande `orderId` à `edited` (`null` : supprimée), dans le registre et la collection.
   * L'état d'avant de chaque carte est relu (`previousOf`) : « Marquer reçue » comme le formulaire.
   */
  const replaceOrder = (orderId: string, edited: Order | null) => {
    const now = new Date().toISOString()
    const { shopping } = get()
    const before = shopping.orders.find((known) => known.id === orderId) ?? null
    const others = shopping.orders.filter((known) => known.id !== orderId)
    const collectionStore = useCollectionStore.getState()
    const { collection } = collectionStore
    const order = edited && {
      ...edited,
      lines: edited.lines.map((line) => ({
        ...line,
        previous: previousOf(line.cardId, before, collection),
      })),
    }
    collectionStore.replaceCollection(applyOrder(collection, before, order, others, now))
    const orders = order ? sortOrders([...others, { ...order, updatedAt: now }]) : others
    set({ shopping: { ...shopping, orders, updatedAt: now } })
  }

  return {
    shopping: emptyShopping(),

    setBudget: (change) =>
      set({ shopping: updateBudget(get().shopping, change, new Date().toISOString()) }),
    saveOrder: (order) => replaceOrder(order.id, order),
    deleteOrder: (orderId) => replaceOrder(orderId, null),
    replaceShopping: (shopping) => set({ shopping }),
  }
})
