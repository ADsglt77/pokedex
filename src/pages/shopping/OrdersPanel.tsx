import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Select,
  Stack,
  Table,
  type Column,
  type SelectOption,
  type SortState,
} from '@camply/ui'
import { Eye, PackageCheck, Pencil, Plus, Receipt, Trash2 } from '@camply/ui/icons'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExternalLink } from '@/components/ExternalLink'
import { TableCount } from '@/components/TableCount'
import { useCollectionAction } from '@/hooks/useNotify'
import { cx } from '@/lib/cx'
import { formatDate, formatEuro, plural, today } from '@/lib/format'
import {
  cardCount,
  LATE_AFTER_DAYS,
  latePendingOrders,
  newOrder,
  orderSpent,
  supplierLabel,
} from '@/lib/orders'
import { sortChoice, sortOf } from '@/lib/table-sort'
import { useShoppingStore } from '@/store/shopping'
import type { Order } from '@/types'
import { LateOrdersAlert, OrderDetail, OrderStateBadge } from './OrderDetail'
import { OrderForm } from './OrderForm'
import page from './ShoppingPage.module.css'
import styles from './OrdersPanel.module.css'

/**
 * Les tris de l'en-tête, en liste (`.stack-sort`) : chaque colonne, dans un sens puis l'autre ;
 * sans tri, l'ordre du registre (par date à chaque enregistrement, `sortOrders` ; tel quel après un
 * import).
 */
const SORTS: SelectOption[] = [
  { value: '', label: 'Sans tri, dans l’ordre du registre' },
  { value: 'date:desc', label: 'Date, la plus récente d’abord' },
  { value: 'date:asc', label: 'Date, la plus ancienne d’abord' },
  { value: 'total:desc', label: 'Total, la plus chère d’abord' },
  { value: 'total:asc', label: 'Total, la moins chère d’abord' },
  { value: 'cards:desc', label: 'Cartes, le plus de cartes d’abord' },
  { value: 'cards:asc', label: 'Cartes, le moins de cartes d’abord' },
  { value: 'state:asc', label: 'État : annulées, en cours, puis reçues' },
  { value: 'state:desc', label: 'État : reçues, en cours, puis annulées' },
  { value: 'supplier:asc', label: 'Fournisseur, de A à Z' },
  { value: 'supplier:desc', label: 'Fournisseur, de Z à A' },
]

/**
 * Le registre des commandes : en ajouter, en ouvrir une pour voir ses cartes, les corriger, les
 * marquer reçues, les supprimer.
 */
export function OrdersPanel() {
  const act = useCollectionAction()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)
  // Le tri, contrôlé : l'en-tête du tableau, ou le choix « Trier par » qui le remplace en liste.
  const [sort, setSort] = useState<SortState | null>(null)
  const newButton = useRef<HTMLButtonElement>(null)
  // Suivie par son id : ouverte, elle reflète ce qu'on y change (« Marquer reçue »).
  const opened = orders.find((order) => order.id === openId)
  const late = new Set(latePendingOrders(orders, today()).map((order) => order.id))

  // Affichée tout de suite : « Marquer reçue » disparaît, le focus va ailleurs (voir ses appels).
  const receive = (order: Order) =>
    flushSync(() =>
      act(
        () =>
          useShoppingStore
            .getState()
            .saveOrder({ ...order, state: 'received', receivedAt: today() }),
        `Commande reçue : ${plural(cardCount(order.lines), 'carte possédée', 'cartes possédées')}.`,
      ),
    )

  // La fenêtre fermée d'abord, puis le focus à « Nouvelle commande » : elle le rendrait au bouton
  // de la commande supprimée.
  const remove = (order: Order) => {
    flushSync(() => {
      setDeleting(null)
      act(() => useShoppingStore.getState().deleteOrder(order.id), 'Commande supprimée.', 'info')
    })
    newButton.current?.focus()
  }

  return (
    <Stack gap={5} className={page.panel}>
      <div className={styles.listHead}>
        <p className="muted">
          Une commande enregistrée met à jour le statut de ses cartes et compte dans le budget du
          mois de sa date d’achat. Ouvrez-en une pour voir ses cartes et leur prix de revient.
        </p>
        <Button
          ref={newButton}
          leftIcon={<Plus size={16} />}
          onClick={() => setEditing(newOrder(today()))}
        >
          Nouvelle commande
        </Button>
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
        <div className="stack-sort">
          <div className="stack-sort-choice">
            <Select
              label="Trier par"
              size="sm"
              options={SORTS}
              value={sortChoice(sort)}
              onChange={(choice) => setSort(sortOf(choice))}
            />
          </div>
          <Table
            className={cx('stack-table', styles.orders)}
            data={orders}
            rowKey={(order) => order.id}
            sort={sort}
            onSortChange={setSort}
            columns={orderColumns(late, {
              onReceive: receive,
              onView: (order) => setOpenId(order.id),
              onEdit: setEditing,
              onDelete: setDeleting,
            })}
          />
        </div>
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

      <DeleteOrderDialog
        order={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove(deleting!)}
      />
    </Stack>
  )
}

/**
 * Les colonnes du registre ; `late` : les commandes en retard. L'état et « Marquer reçue » juste
 * après la date : sur téléphone, sans faire défiler.
 */
function orderColumns(
  late: ReadonlySet<string>,
  {
    onReceive,
    onView,
    onEdit,
    onDelete,
  }: {
    onReceive: (order: Order) => void
    onView: (order: Order) => void
    onEdit: (order: Order) => void
    /** Demande d'abord (`DeleteOrderDialog`). */
    onDelete: (order: Order) => void
  },
): Column<Order>[] {
  return [
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
        <span className={page.stacked}>
          <span className={styles.badges}>
            <OrderStateBadge state={order.state} />
            {late.has(order.id) && (
              <Badge size="sm" tone="warn">
                En retard
              </Badge>
            )}
          </span>
          {order.receivedAt && <span className="muted">le {formatDate(order.receivedAt)}</span>}
          {order.state === 'pending' && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<PackageCheck size={14} />}
              onClick={() => {
                onReceive(order)
                // Le bouton disparaît avec l'état « en cours » : « Voir » la commande.
                document.querySelector<HTMLElement>(`[data-order="${order.id}"]`)?.focus()
              }}
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
        <span className={page.stacked}>
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
      cell: (order) => <TableCount count={cardCount(order.lines)} one="carte" many="cartes" />,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      sortValue: (order) => orderSpent(order),
      cell: (order) => (
        <span className={page.stacked}>
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
              data-order={order.id}
              label={`Voir ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onView(order)}
            >
              <Eye size={15} />
            </IconButton>
            <IconButton
              label={`Modifier ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onEdit(order)}
            >
              <Pencil size={15} />
            </IconButton>
            <IconButton
              label={`Supprimer ${name}`}
              size="sm"
              variant="ghost"
              onClick={() => onDelete(order)}
            >
              <Trash2 size={15} />
            </IconButton>
          </span>
        )
      },
    },
  ]
}

/** La question avant de supprimer une commande (`order`) : ce que deviennent ses cartes. */
function DeleteOrderDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: Order | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmDialog
      open={order !== null}
      title="Supprimer cette commande ?"
      confirmLabel="Supprimer"
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <p>
        {order?.state === 'cancelled'
          ? 'Elle disparaît du registre.'
          : 'Elle disparaît du registre et du budget.'}{' '}
        {order?.state === 'pending' &&
          'Ses cartes encore commandées retrouvent leur état d’avant la commande.'}
        {order?.state === 'received' &&
          'Ses cartes restent possédées, sans le prix payé ni la date qu’elle leur avait donnés.'}
      </p>
      {order?.state !== 'cancelled' && (
        <p>
          Pour une commande annulée, préférez l’état « Annulée » : elle reste dans l’historique.
        </p>
      )}
    </ConfirmDialog>
  )
}
