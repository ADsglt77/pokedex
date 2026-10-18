import { Stat } from '@camply/ui'
import { Flag, Package } from '@camply/ui/icons'
import { SpentThisMonthStat, WishlistStat } from '@/components/ShoppingStats'
import { usePokedex } from '@/hooks/usePokedex'
import { spentThisMonth } from '@/lib/budget'
import { formatEuro, formatInteger, plural } from '@/lib/format'
import { summarize } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { useStatSize } from '@/hooks/useStatSize'

/** Le mois en cours en un coup d'œil : dépensé, restant, liste d'achats, Pokémon à débloquer. */
export function BudgetOverview() {
  const statSize = useStatSize()
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const ordered = useCollectionStore((state) => summarize(state.collection).ordered)
  const { progress } = usePokedex()
  const spent = spentThisMonth(orders)

  return (
    <div className="stat-grid">
      <SpentThisMonthStat />
      <Stat
        size={statSize}
        label="Restant ce mois-ci"
        icon={<Flag size={18} />}
        value={formatEuro(Math.max(0, budget.monthly - spent))}
        hint={`${formatEuro(Math.max(0, budget.ceiling - spent))} jusqu’au plafond`}
      />
      <WishlistStat />
      <Stat
        size={statSize}
        label="Pokémon à débloquer"
        icon={<Package size={18} />}
        value={formatInteger(progress.missing)}
        hint={plural(ordered, 'carte commandée', 'cartes commandées')}
      />
    </div>
  )
}
