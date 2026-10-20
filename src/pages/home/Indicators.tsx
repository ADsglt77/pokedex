import { Stat } from '@camply/ui'
import { Package } from '@camply/ui/icons'
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
import { useStatSize } from '@/hooks/useStatSize'

/** Valeur, budget du mois, liste d'achats, commandes en cours : chacun mène à sa page. */
export function Indicators() {
  const statSize = useStatSize()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const late = latePendingOrders(orders, today()).length

  return (
    <div className={cx('stat-grid', page.wide)}>
      <Link to="/valeur" className={styles.statLink}>
        <CollectionValueStat label="Valeur de ma collection" />
      </Link>
      <Link to={shoppingUrl({ view: 'budget' })} className={styles.statLink}>
        <SpentThisMonthStat />
      </Link>
      <Link to={shoppingUrl()} className={styles.statLink}>
        <WishlistStat />
      </Link>
      <Link to={shoppingUrl({ view: 'commandes' })} className={styles.statLink}>
        <Stat
          size={statSize}
          label="Commandes en cours"
          icon={<Package size={18} />}
          value={formatInteger(pendingCount(orders))}
          hint={late > 0 ? `dont ${formatInteger(late)} en retard` : 'Aucune en retard'}
        />
      </Link>
    </div>
  )
}
