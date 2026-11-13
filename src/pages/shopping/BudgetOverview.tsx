import { Stat } from '@camply/ui'
import { SpentThisMonthStat, WishlistStat } from '@/components/ShoppingStats'
import { usePokedex } from '@/hooks/usePokedex'
import { spentThisMonth } from '@/lib/budget'
import { formatEuro, formatInteger, plural } from '@/lib/format'
import { summarize } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { SUMMARY_STAT } from '@/hooks/useStatSize'

/** Le mois en cours en un coup d'œil : dépensé, restant, liste d'achats, Pokémon à débloquer. */
export function BudgetOverview() {
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const ordered = useCollectionStore((state) => summarize(state.collection).ordered)
  const { progress } = usePokedex()
  const spent = spentThisMonth(orders)

  return (
    <div className="stat-line">
      <SpentThisMonthStat summary />
      <Stat
        {...SUMMARY_STAT}
        label="Restant ce mois-ci"
        value={formatEuro(Math.max(0, budget.monthly - spent))}
        hint={`${formatEuro(Math.max(0, budget.ceiling - spent))} jusqu’au plafond`}
      />
      <WishlistStat summary />
      <Stat
        {...SUMMARY_STAT}
        label="Pokémon à débloquer"
        value={formatInteger(progress.missing)}
        hint={plural(ordered, 'carte commandée', 'cartes commandées')}
      />
    </div>
  )
}
