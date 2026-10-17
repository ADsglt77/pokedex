import { DescriptionList } from '@camply/ui'
import { cx } from '@/lib/cx'
import { formatEuro } from '@/lib/format'
import { linesTotal, orderSpent } from '@/lib/orders'
import type { Order } from '@/types'
import styles from './ShoppingPage.module.css'

/** Les montants d'une commande : cartes, port et frais, remboursé, total. */
export function OrderTotals({ order }: { order: Order }) {
  return (
    <DescriptionList
      className={cx('amounts', styles.totals)}
      divided
      items={[
        { term: 'Cartes', description: formatEuro(linesTotal(order.lines)) },
        { term: 'Port et frais', description: formatEuro(order.shipping + order.fees) },
        ...(order.refunded
          ? [{ term: 'Remboursé', description: `−${formatEuro(order.refunded)}` }]
          : []),
        {
          term: order.state === 'cancelled' ? 'Total (annulée : ne compte pas)' : 'Total',
          description: <strong>{formatEuro(orderSpent({ ...order, state: 'pending' }))}</strong>,
        },
      ]}
    />
  )
}
