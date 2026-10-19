import { useMemo } from 'react'
import { usePokedex } from '@/hooks/usePokedex'
import { wishlistRows } from '@/lib/wishlist'
import { usePrices } from '@/store/prices'

/** La liste d'achats prête à afficher et à planifier. */
export function useWishlist() {
  const prices = usePrices()
  const { entries } = usePokedex()
  return useMemo(() => wishlistRows(entries, prices), [entries, prices])
}
