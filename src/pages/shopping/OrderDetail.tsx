import { Badge, Button, Modal, Stack } from '@camply/ui'
import { PackageCheck, Pencil, Trash2 } from '@camply/ui/icons'
import { ExternalLink } from '@/components/ExternalLink'
import { LateOrdersAlert } from '@/components/LateOrdersAlert'
import { ORDER_STATE_LABELS } from '@/config/shopping'
import { details, formatDate, formatEuro, formatInteger, today } from '@/lib/format'
import { LATE_AFTER_DAYS, latePendingOrders, supplierLabel, unitCosts } from '@/lib/orders'
import { findCard } from '@/lib/species'
import { useCollectionStore } from '@/store/collection'
import type { Order, OrderState } from '@/types'
import { CardLine } from './CardLine'
import { OrderTotals } from './OrderTotals'
import styles from './ShoppingPage.module.css'

const STATE_TONES = { pending: 'info', received: 'success', cancelled: 'neutral' } as const

/** L'état d'une commande : en cours, reçue, annulée. */
export function OrderStateBadge({ state }: { state: OrderState }) {
  return (
    <Badge size="sm" tone={STATE_TONES[state]}>
      {ORDER_STATE_LABELS[state]}
    </Badge>
  )
}

/**
 * Une commande en détail : ses cartes, leur prix et ce que chacune a réellement coûté (port, frais
 * et remboursé répartis), ses montants, et les actions du registre.
 */
export function OrderDetail({
  order,
  onClose,
  onReceive,
  onEdit,
  onDelete,
}: {
  order: Order
  onClose: () => void
  onReceive: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const collection = useCollectionStore((state) => state.collection)
  const costs = unitCosts(order)
  const late = latePendingOrders([order], today()).length > 0

  return (
    <Modal
      open
      onClose={onClose}
      title={`Commande ${supplierLabel(order)} du ${formatDate(order.date)}`}
      description={order.reference && `Référence ${order.reference}`}
      footer={
        <>
          <Button variant="secondary" leftIcon={<Pencil size={16} />} onClick={onEdit}>
            Modifier
          </Button>
          {order.state === 'pending' && (
            <Button leftIcon={<PackageCheck size={16} />} onClick={onReceive}>
              Marquer reçue
            </Button>
          )}
        </>
      }
    >
      <Stack gap={5}>
        <Stack direction="horizontal" gap={2} align="center" wrap>
          <OrderStateBadge state={order.state} />
          {order.receivedAt && <span className="muted">le {formatDate(order.receivedAt)}</span>}
        </Stack>
        {late && (
          <LateOrdersAlert
            title={`Achetée il y a plus de ${LATE_AFTER_DAYS} jours, toujours en cours`}
          />
        )}
        <ul className={styles.lines}>
          {order.lines.map((line, index) => {
            const card = findCard(line.cardId, collection)
            const detail = details(
              `${formatInteger(line.quantity)} × ${formatEuro(line.unitPrice)}`,
              // Une commande annulée n'a rien coûté.
              order.state !== 'cancelled' &&
                `revient à ${formatEuro(costs[index]!)}${line.quantity > 1 ? ' l’une' : ''}`,
            )
            return (
              <li key={line.cardId}>
                <CardLine card={card} detail={detail} />
              </li>
            )
          })}
        </ul>
        <OrderTotals order={order} />
        {order.link && (
          <p>
            <ExternalLink href={order.link}>La commande chez {supplierLabel(order)}</ExternalLink>
          </p>
        )}
        {order.note && <p className={styles.note}>{order.note}</p>}
        {/* Ici plutôt qu'en pied de fenêtre : sur téléphone, trois boutons n'y tiennent pas. */}
        <div>
          <Button
            size="sm"
            variant="ghost"
            tone="danger"
            leftIcon={<Trash2 size={14} />}
            onClick={onDelete}
          >
            Supprimer la commande
          </Button>
        </div>
      </Stack>
    </Modal>
  )
}
