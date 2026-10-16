import { Stat } from '@camply/ui'
import { ListChecks, Wallet } from '@camply/ui/icons'
import { BudgetMeter } from '@/components/BudgetMeter'
import { PricedValue } from '@/components/PricedValue'
import { useWishlist } from '@/hooks/useWishlist'
import { spentThisMonth } from '@/lib/budget'
import { details, formatEuro, formatInteger, plural } from '@/lib/format'
import { wishlistEstimate } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'

/** Le dépensé du mois et sa jauge face au budget : accueil et Achats. */
export function SpentThisMonthStat() {
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const spent = spentThisMonth(orders)
  return (
    <Stat
      label="Dépensé ce mois-ci"
      icon={<Wallet size={18} />}
      value={formatEuro(spent)}
      hint={<BudgetMeter spent={spent} budget={budget} />}
    />
  )
}

/** La liste d'achats : ses cartes à acheter et leur coût au prix du jour (accueil et Achats). */
export function WishlistStat() {
  const { rows } = useWishlist()
  const estimate = wishlistEstimate(rows)
  return (
    <Stat
      label="Liste d’achats"
      icon={<ListChecks size={18} />}
      value={plural(rows.length, 'carte', 'cartes')}
      hint={
        <PricedValue text>
          {details(
            `environ ${formatEuro(estimate.value)}`,
            estimate.unpriced > 0 && `${formatInteger(estimate.unpriced)} sans prix`,
          )}
        </PricedValue>
      }
    />
  )
}
