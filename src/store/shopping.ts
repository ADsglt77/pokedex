/**
 * Les achats : commandes et budget. Un store Zustand à part, enregistré sous sa propre clé : la
 * collection garde son format. Une commande met aussi à jour
 * les statuts de ses cartes dans la collection (voir `applyOrder`).
 */

import { create } from 'zustand'
import { updateBudget } from '@/lib/budget'
import { applyOrder, previousOf, sortOrders } from '@/lib/orders'
import { parseStored, readShopping } from '@/lib/transfer'
import * as rules from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import type { BudgetSettings, Order, ShoppingData } from '@/types'
import { persist, readStored } from './persist'

const SHOPPING_KEY = 'pokedex-collection.shopping'

const loadShopping = (text: string | null) =>
  readShopping(parseStored(text)) ?? rules.emptyShopping()

interface ShoppingStore {
  shopping: ShoppingData
  setBudget: (change: Partial<BudgetSettings>) => void
  /** Enregistre une commande, nouvelle ou modifiée, et la reporte sur la collection. */
  saveOrder: (order: Order) => void
  /** Retire une commande ; ses cartes encore « commandée » retrouvent leur état d'avant. */
  deleteOrder: (orderId: string) => void
  /** Remplace tous les achats : import. */
  replaceShopping: (shopping: ShoppingData) => void
}

export const useShoppingStore = create<ShoppingStore>()((set, get) => {
  const update = (change: (shopping: ShoppingData, now: string) => ShoppingData) =>
    set({ shopping: change(get().shopping, new Date().toISOString()) })

  /**
   * Passe la commande `orderId` à `order` (`null` : supprimée), dans le registre et la collection.
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
    shopping: loadShopping(readStored(SHOPPING_KEY)),

    setBudget: (change) => update((shopping, now) => updateBudget(shopping, change, now)),
    saveOrder: (order) => replaceOrder(order.id, order),
    deleteOrder: (orderId) => replaceOrder(orderId, null),
    replaceShopping: (shopping) => set({ shopping }),
  }
})

persist(
  useShoppingStore,
  SHOPPING_KEY,
  (state) => state.shopping,
  (text) => ({ shopping: loadShopping(text) }),
)
