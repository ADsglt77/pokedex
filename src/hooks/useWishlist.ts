import { useMemo } from 'react'
import { usePokedex } from '@/hooks/usePokedex'
import { takenSpecies, wishlistRows } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'
import { useShoppingStore } from '@/store/shopping'

/** La liste d'achats prête à afficher, et les Pokémon déjà obtenus ou commandés. */
export function useWishlist() {
  const preferences = useShoppingStore((state) => state.shopping.preferences)
  const collection = useCollectionStore((state) => state.collection)
  const prices = usePrices()
  const { entries } = usePokedex()
  const rows = useMemo(
    () => wishlistRows(preferences, collection, prices),
    [preferences, collection, prices],
  )
  const taken = useMemo(() => takenSpecies(entries), [entries])
  return { rows, taken }
}
