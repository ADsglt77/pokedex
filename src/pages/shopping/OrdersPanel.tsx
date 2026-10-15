import { Badge, Button, EmptyState, IconButton, Stack, Table } from '@camply/ui'
import { Download, Eye, PackageCheck, Pencil, Plus, Receipt, Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExternalLink } from '@/components/ExternalLink'
import { LateOrdersAlert } from './LateOrdersAlert'
import { useCollectionAction, useNotify } from '@/hooks/useNotify'
import { formatDate, formatEuro, formatInteger, plural, today } from '@/lib/format'
import {
  cardCount,
  LATE_AFTER_DAYS,
  latePendingOrders,
  newOrder,
  orderSpent,
  supplierLabel,
} from '@/lib/orders'
import { downloadCsv, ordersCsv } from '@/lib/transfer'
import { useShoppingStore } from '@/store/shopping'
import type { Order } from '@/types'
import { OrderDetail, OrderStateBadge } from './OrderDetail'
import { OrderForm } from './OrderForm'
import styles from './ShoppingPage.module.css'

/**
 * Le registre des commandes : en ajouter, en ouvrir une pour voir ses cartes, les corriger, les
 * marquer reçues, les supprimer, les exporter.
 */
export function OrdersPanel() {
  const act = useCollectionAction()
  const notify = useNotify()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)
  // Suivie par son id : ouverte, elle reflète ce qu'on y change (« Marquer reçue »).
  const opened = orders.find((order) => order.id === openId)
  const late = new Set(latePendingOrders(orders, today()).map((order) => order.id))

  const receive = (order: Order) =>
    act(
      () =>
        useShoppingStore.getState().saveOrder({ ...order, state: 'received', receivedAt: today() }),
      `Commande reçue : ${plural(cardCount(order.lines), 'carte possédée', 'cartes possédées')}.`,
    )

  const remove = (order: Order) =>
    act(() => useShoppingStore.getState().deleteOrder(order.id), 'Commande supprimée.', 'info')

  const exportCsv = () => {
    const file = downloadCsv('commandes', ordersCsv(orders))
    notify(`${plural(orders.length, 'commande exportée', 'commandes exportées')} : ${file}.`)
  }

  return (
    <Stack gap={5} className={styles.panel}>
      <div className={styles.listHead}>
        <p className="muted">
          Une commande enregistrée met à jour le statut de ses cartes et compte dans le budget du
          mois de sa date d’achat. Ouvrez-en une pour voir ses cartes et leur prix de revient.
        </p>
        <Stack direction="horizontal" gap={2} wrap>
          <Button
            variant="secondary"
            leftIcon={<Download size={16} />}
            disabled={orders.length === 0}
            onClick={exportCsv}
          >
            Exporter en CSV
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={() => setEditing(newOrder(today()))}>
            Nouvelle commande
          </Button>
        </Stack>
      </div>

      {late.size > 0 && (
        <LateOrdersAlert
          title={`${plural(late.size, 'commande en cours', 'commandes en cours')} depuis plus de ${LATE_AFTER_DAYS} jours`}
        />
      )}

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
          onRowClick={(order) => setOpenId(order.id)}
          // L'état et « Marquer reçue » juste après la date : sur téléphone, sans faire défiler.
          columns={[
            {
              key: 'date',
              header: 'Date',
              sortValue: (order) => order.date,
              cell: (order) => formatDate(order.date),
            },
            {
              key: 'state',
              header: 'État',
              sortValue: (order) => order.state,
              cell: (order) => (
                <span className={styles.stacked}>
                  <span className={styles.badges}>
                    <OrderStateBadge state={order.state} />
                    {late.has(order.id) && (
                      <Badge size="sm" tone="warn">
                        En retard
                      </Badge>
                    )}
                  </span>
                  {order.receivedAt && (
                    <span className="muted">le {formatDate(order.receivedAt)}</span>
                  )}
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
                </span>
              ),
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
              key: 'actions',
              header: <span className="visually-hidden">Actions</span>,
              align: 'right',
              cell: (order) => {
                const name = `la commande ${supplierLabel(order)} du ${formatDate(order.date)}`
                return (
                  <span className={styles.rowActions}>
                    <IconButton
                      label={`Voir ${name}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenId(order.id)}
                    >
                      <Eye size={15} />
                    </IconButton>
                    <IconButton
                      label={`Modifier ${name}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(order)}
                    >
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      label={`Supprimer ${name}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleting(order)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </span>
                )
              },
            },
          ]}
        />
      )}

      {opened && (
        <OrderDetail
          order={opened}
          onClose={() => setOpenId(null)}
          onReceive={() => receive(opened)}
          onEdit={() => {
            setOpenId(null)
            setEditing(opened)
          }}
          onDelete={() => {
            setOpenId(null)
            setDeleting(opened)
          }}
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
          {deleting?.state === 'received' &&
            'Ses cartes restent possédées, sans le prix payé ni la date qu’elle leur avait donnés.'}
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
