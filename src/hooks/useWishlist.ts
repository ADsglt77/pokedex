import { useMemo } from 'react'
import { usePokedex } from '@/hooks/usePokedex'
import { takenSpecies, wishlistRows } from '@/lib/wishlist'
import { usePrices } from '@/store/prices'

/** La liste d'achats prête à afficher, et les Pokémon déjà obtenus ou commandés. */
export function useWishlist() {
  const prices = usePrices()
  const { entries } = usePokedex()
  const rows = useMemo(() => wishlistRows(entries, prices), [entries, prices])
  const taken = useMemo(() => takenSpecies(entries), [entries])
  return { rows, taken }
}
