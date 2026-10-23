import { useMemo } from 'react'
import { wishlistRows } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'

/** La liste d'achats prête à afficher et à planifier. */
export function useWishlist() {
  const prices = usePrices()
  const collection = useCollectionStore((state) => state.collection)
  return useMemo(() => wishlistRows(collection, prices), [collection, prices])
}
