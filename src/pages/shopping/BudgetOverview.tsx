import { Progress, Stat } from '@camply/ui'
import { Flag, ListChecks, Package, Wallet } from '@camply/ui/icons'
import { usePokedex } from '@/hooks/usePokedex'
import { monthOf, spentIn, today } from '@/lib/budget'
import { isToBuy, summarize } from '@/lib/collection'
import { formatEuro, formatInteger, plural } from '@/lib/format'
import { wishlistEstimate } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { useWishlist } from './useWishlist'
import styles from './ShoppingPage.module.css'

/** Le mois en cours en un coup d'œil : dépensé, restant, liste d'achats, Pokémon à obtenir. */
export function BudgetOverview() {
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const ordered = useCollectionStore((state) => summarize(state.collection).ordered)
  const { progress } = usePokedex()
  const { rows, taken } = useWishlist()
  const { spent } = spentIn(orders, monthOf(today()))
  const estimate = wishlistEstimate(rows, taken)
  const tone = spent > budget.ceiling ? 'danger' : spent > budget.monthly ? 'warn' : 'accent'

  return (
    <div className="stat-grid">
      <Stat
        label="Dépensé ce mois-ci"
        icon={<Wallet size={18} />}
        value={formatEuro(spent)}
        hint={
          <span className={styles.meter}>
            <span>
              sur {formatEuro(budget.monthly)} · plafond {formatEuro(budget.ceiling)}
            </span>
            <Progress
              value={Math.min(spent, budget.ceiling)}
              max={budget.ceiling}
              tone={tone}
              size="sm"
              aria-label="Part du plafond du mois dépensée"
            />
          </span>
        }
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
        hint={[
          `environ ${formatEuro(estimate.value)} pour ${plural(estimate.priced, 'Pokémon', 'Pokémon')}`,
          estimate.unpriced > 0 && `${estimate.unpriced} sans prix`,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <Stat
        label="Pokémon à obtenir"
        icon={<Package size={18} />}
        value={formatInteger(progress.missing)}
        hint={plural(ordered, 'carte commandée', 'cartes commandées')}
      />
    </div>
  )
}
