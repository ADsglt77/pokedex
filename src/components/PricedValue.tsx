import { Skeleton } from '@camply/ui'
import type { ReactNode } from 'react'
import { usePrices, usePricesMissing } from '@/store/prices'

/**
 * Ce qui se lit au prix du jour (un montant, un décompte « sans prix ») : affiché avec les prix,
 * « — » s'ils manquent, une ébauche tant qu'ils arrivent (`text` : de la hauteur d'une ligne,
 * sinon de celle de la valeur d'un `Stat`). Sans prix, chaque carte compterait « sans prix ».
 */
export function PricedValue({ children, text = false }: { children: ReactNode; text?: boolean }) {
  const prices = usePrices()
  const missing = usePricesMissing()
  if (prices) return children
  if (missing) return '—'
  return text ? (
    <Skeleton variant="text" width="7rem" />
  ) : (
    <Skeleton width="7rem" height="1.75rem" />
  )
}
