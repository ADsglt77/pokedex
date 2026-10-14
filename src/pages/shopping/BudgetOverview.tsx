import { Stat } from '@camply/ui'
import { Flag, ListChecks, Package, Wallet } from '@camply/ui/icons'
import { usePokedex } from '@/hooks/usePokedex'
import { spentThisMonth } from '@/lib/budget'
import { isToBuy } from '@/lib/collection'
import { details, formatEuro, formatInteger, plural } from '@/lib/format'
import { summarize } from '@/lib/pokedex'
import { wishlistEstimate } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { useWishlist } from '@/hooks/useWishlist'
import { BudgetMeter } from '@/components/BudgetMeter'

/** Le mois en cours en un coup d'œil : dépensé, restant, liste d'achats, Pokémon à débloquer. */
export function BudgetOverview() {
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const ordered = useCollectionStore((state) => summarize(state.collection).ordered)
  const { progress } = usePokedex()
  const { rows, taken } = useWishlist()
  const spent = spentThisMonth(orders)
  const estimate = wishlistEstimate(rows, taken)

  return (
    <div className="stat-grid">
      <Stat
        label="Dépensé ce mois-ci"
        icon={<Wallet size={18} />}
        value={formatEuro(spent)}
        hint={<BudgetMeter spent={spent} budget={budget} />}
      />
      <Stat
        label="Restant ce mois-ci"
        icon={<Flag size={18} />}
        value={formatEuro(Math.max(0, budget.monthly - spent))}
        hint={`${formatEuro(Math.max(0, budget.ceiling - spent))} jusqu’au plafond`}
      />
      <Stat
        label="Liste d’achats"
        icon={<ListChecks size={18} />}
        value={plural(rows.filter(isToBuy).length, 'carte', 'cartes')}
        hint={details(
          `environ ${formatEuro(estimate.value)}`,
          estimate.unpriced > 0 && `${formatInteger(estimate.unpriced)} sans prix`,
        )}
      />
      <Stat
        label="Pokémon à débloquer"
        icon={<Package size={18} />}
        value={formatInteger(progress.missing)}
        hint={plural(ordered, 'carte commandée', 'cartes commandées')}
      />
    </div>
  )
}
