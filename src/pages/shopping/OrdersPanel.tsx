import { Badge, Button, EmptyState, IconButton, Stack, Table } from '@camply/ui'
import { PackageCheck, Pencil, Plus, Receipt, Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExternalLink } from '@/components/ExternalLink'
import { ORDER_STATE_LABELS } from '@/config/shopping'
import { useCollectionAction } from '@/hooks/useNotify'
import { today } from '@/lib/budget'
import { formatDate, formatEuro, formatInteger, plural } from '@/lib/format'
import { cardCount, newOrder, orderSpent, supplierLabel } from '@/lib/orders'
import { useShoppingStore } from '@/store/shopping'
import type { Order } from '@/types'
import { OrderForm } from './OrderForm'
import styles from './ShoppingPage.module.css'

const STATE_TONES = { pending: 'info', received: 'success', cancelled: 'neutral' } as const

/** Le registre des commandes : en ajouter, les corriger, les marquer reçues, les supprimer. */
export function OrdersPanel() {
  const act = useCollectionAction()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const [editing, setEditing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)

  const receive = (order: Order) =>
    act(
      () =>
        useShoppingStore.getState().saveOrder({ ...order, state: 'received', receivedAt: today() }),
      `Commande reçue : ${plural(cardCount(order.lines), 'carte possédée', 'cartes possédées')}.`,
    )

  const remove = (order: Order) =>
    act(() => useShoppingStore.getState().deleteOrder(order.id), 'Commande supprimée.', 'info')

  return (
    <Stack gap={5} className={styles.panel}>
      <div className={styles.listHead}>
        <p className="muted">
          Une commande enregistrée met à jour le statut de ses cartes et compte dans le budget du
          mois de sa date d’achat.
        </p>
        <Button leftIcon={<Plus size={16} />} onClick={() => setEditing(newOrder(today()))}>
          Nouvelle commande
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<Receipt size={22} />}
          title="Aucune commande enregistrée"
          description="Après avoir commandé, enregistrez la commande avec les prix payés : vos cartes passent en « commandée », puis en « possédée » à la réception. Les commandes passées s’enregistrent de la même façon, directement « reçues »."
        />
      ) : (
        <Table
          className={styles.table}
          data={orders}
          rowKey={(order) => order.id}
          columns={[
            {
              key: 'date',
              header: 'Date',
              sortValue: (order) => order.date,
              cell: (order) => formatDate(order.date),
            },
            {
              key: 'supplier',
              header: 'Fournisseur',
              sortValue: (order) => supplierLabel(order),
              cell: (order) => (
                <span className={styles.stacked}>
                  {order.link ? (
                    <ExternalLink href={order.link}>{supplierLabel(order)}</ExternalLink>
                  ) : (
                    supplierLabel(order)
                  )}
                  {order.reference && <span className="muted">{order.reference}</span>}
                </span>
              ),
            },
            {
              key: 'cards',
              header: 'Cartes',
              align: 'right',
              sortValue: (order) => cardCount(order.lines),
              cell: (order) => formatInteger(cardCount(order.lines)),
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              sortValue: (order) => orderSpent(order),
              cell: (order) => (
                <span className={styles.stacked}>
                  {formatEuro(orderSpent(order))}
                  {order.refunded > 0 && (
                    <span className="muted">remboursé {formatEuro(order.refunded)}</span>
                  )}
                </span>
              ),
            },
            {
              key: 'state',
              header: 'État',
              sortValue: (order) => order.state,
              cell: (order) => (
                <span className={styles.stacked}>
                  <Badge size="sm" tone={STATE_TONES[order.state]}>
                    {ORDER_STATE_LABELS[order.state]}
                  </Badge>
                  {order.receivedAt && (
                    <span className="muted">le {formatDate(order.receivedAt)}</span>
                  )}
                </span>
              ),
            },
            {
              key: 'actions',
              header: <span className="visually-hidden">Actions</span>,
              align: 'right',
              cell: (order) => (
                <span className={styles.rowActions}>
                  {order.state === 'pending' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<PackageCheck size={14} />}
                      onClick={() => receive(order)}
                    >
                      Marquer reçue
                    </Button>
                  )}
                  <IconButton
                    label={`Modifier la commande du ${formatDate(order.date)}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(order)}
                  >
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    label={`Supprimer la commande du ${formatDate(order.date)}`}
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(order)}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </span>
              ),
            },
          ]}
        />
      )}

      {editing && <OrderForm order={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer cette commande ?"
        confirmLabel="Supprimer"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting!)}
      >
        <p>
          Elle disparaît du registre et du budget.{' '}
          {deleting?.state === 'pending' &&
            'Ses cartes encore commandées retrouvent leur état d’avant la commande.'}
          {deleting?.state === 'received' && 'Ses cartes restent possédées.'}
        </p>
        {deleting?.state !== 'cancelled' && (
          <p>
            Pour une commande annulée, préférez l’état « Annulée » : elle reste dans l’historique.
          </p>
        )}
      </ConfirmDialog>
    </Stack>
  )
}
