/**
 * Les achats : liste d'achats, commandes et budget. Un store Zustand à part, enregistré sous sa
 * propre clé : la collection et ses réglages gardent leur format. Une commande met aussi à jour
 * les statuts de ses cartes dans la collection (voir `applyOrder`).
 */

import { create } from 'zustand'
import { updateBudget } from '@/lib/budget'
import { applyOrder, sortOrders } from '@/lib/orders'
import { parseStored, readShopping } from '@/lib/transfer'
import * as rules from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import type { BudgetSettings, Order, ShoppingData } from '@/types'
import { persist } from './persist'

const SHOPPING_KEY = 'pokedex-collection.shopping'

const loadShopping = (text: string | null) =>
  readShopping(parseStored(text)) ?? rules.emptyShopping()

interface ShoppingStore {
  shopping: ShoppingData
  setDecision: (cardId: string, decision: rules.Decision | null) => void
  updatePreference: (cardId: string, change: rules.PreferenceChange) => void
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

  /** Passe la commande `orderId` à `order` (`null` : supprimée), dans le registre et la collection. */
  const replaceOrder = (orderId: string, order: Order | null) => {
    const now = new Date().toISOString()
    const { shopping } = get()
    const before = shopping.orders.find((known) => known.id === orderId) ?? null
    const others = shopping.orders.filter((known) => known.id !== orderId)
    const collectionStore = useCollectionStore.getState()
    collectionStore.replaceCollection(
      applyOrder(collectionStore.collection, before, order, others, now),
    )
    const orders = order ? sortOrders([...others, { ...order, updatedAt: now }]) : others
    set({ shopping: { ...shopping, orders, updatedAt: now } })
  }

  return {
    shopping: loadShopping(localStorage.getItem(SHOPPING_KEY)),

    setDecision: (cardId, decision) =>
      update((shopping, now) => rules.setDecision(shopping, cardId, decision, now)),
    updatePreference: (cardId, change) =>
      update((shopping, now) => rules.updatePreference(shopping, cardId, change, now)),
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
