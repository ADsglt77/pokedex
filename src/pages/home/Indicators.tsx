import { Stat } from '@camply/ui'
import { Package } from '@camply/ui/icons'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CollectionValueStat } from '@/components/CollectionValueStat'
import { SpentThisMonthStat, WishlistStat } from '@/components/ShoppingStats'
import { cx } from '@/lib/cx'
import { shoppingUrl } from '@/lib/filters'
import { formatInteger, today } from '@/lib/format'
import { latePendingOrders, pendingCount } from '@/lib/orders'
import { useShoppingStore } from '@/store/shopping'
import page from './HomePage.module.css'
import styles from './Indicators.module.css'

/** Une statistique qui mène à sa page. */
function StatLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.statLink}>
      {children}
    </Link>
  )
}

/** Valeur, budget du mois, liste d'achats, commandes en cours : chacun mène à sa page. */
export function Indicators() {
  const orders = useShoppingStore((state) => state.shopping.orders)
  const late = latePendingOrders(orders, today()).length

  return (
    <div className={cx('stat-grid', page.wide)}>
      <StatLink to="/valeur">
        <CollectionValueStat label="Valeur de ma collection" />
      </StatLink>
      <StatLink to={shoppingUrl({ view: 'budget' })}>
        <SpentThisMonthStat />
      </StatLink>
      <StatLink to={shoppingUrl()}>
        <WishlistStat />
      </StatLink>
      <StatLink to={shoppingUrl({ view: 'commandes' })}>
        <Stat
          label="Commandes en cours"
          icon={<Package size={18} />}
          value={formatInteger(pendingCount(orders))}
          hint={late > 0 ? `dont ${formatInteger(late)} en retard` : 'Aucune en retard'}
        />
      </StatLink>
    </div>
  )
}
