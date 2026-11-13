import { Stat } from '@camply/ui'
import { ListChecks, Wallet } from '@camply/ui/icons'
import { BudgetMeter } from '@/components/BudgetMeter'
import { PricedValue } from '@/components/PricedValue'
import { useWishlist } from '@/hooks/useWishlist'
import { spentThisMonth } from '@/lib/budget'
import { details, formatEuro, formatInteger, plural } from '@/lib/format'
import { wishlistEstimate } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import { SUMMARY_STAT, useStatSize } from '@/hooks/useStatSize'

/**
 * Le dépensé du mois et sa jauge face au budget : en tuile sur l'accueil, dans la ligne de résumé
 * des Achats (`summary`).
 */
export function SpentThisMonthStat({ summary = false }: { summary?: boolean }) {
  const statSize = useStatSize()
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const spent = spentThisMonth(orders)
  return (
    <Stat
      {...(summary ? SUMMARY_STAT : { size: statSize })}
      label="Dépensé ce mois-ci"
      icon={<Wallet size={18} />}
      value={formatEuro(spent)}
      hint={<BudgetMeter spent={spent} budget={budget} />}
    />
  )
}

/**
 * La liste d'achats : ses cartes à acheter et leur coût au prix du jour (en tuile sur l'accueil,
 * dans la ligne de résumé des Achats : `summary`).
 */
export function WishlistStat({ summary = false }: { summary?: boolean }) {
  const statSize = useStatSize()
  const rows = useWishlist()
  const estimate = wishlistEstimate(rows)
  return (
    <Stat
      {...(summary ? SUMMARY_STAT : { size: statSize })}
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
