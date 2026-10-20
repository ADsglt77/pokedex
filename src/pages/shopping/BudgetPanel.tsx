import { type Column, Stack, Stat, Table } from '@camply/ui'
import { Calculator, Receipt, Truck, Wallet } from '@camply/ui/icons'
import { costPerSpecies, spendingByMonth, spendingBySupplier, spentOn } from '@/lib/budget'
import { pendingCount } from '@/lib/orders'
import { findCard } from '@/lib/collection'
import { details, formatEuro, formatInteger, formatMonth, plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { Panel } from '@/components/Panel'
import { TableCount } from '@/components/TableCount'
import { BudgetLevelBadge } from '@/components/BudgetMeter'
import { cx } from '@/lib/cx'
import { BudgetField } from './BudgetField'
import page from './ShoppingPage.module.css'
import styles from './BudgetPanel.module.css'
import { useStatSize } from '@/hooks/useStatSize'

type Row = ReturnType<typeof spendingByMonth>[number]

/** Les colonnes communes aux deux tableaux : nombre de commandes et de cartes. */
const COUNT_COLUMNS: Column<Row>[] = [
  {
    key: 'orders',
    header: 'Commandes',
    align: 'right',
    cell: (row) => <TableCount count={row.orders} one="commande" many="commandes" />,
  },
  {
    key: 'cards',
    header: 'Cartes',
    align: 'right',
    cell: (row) => <TableCount count={row.cards} one="carte" many="cartes" />,
  },
]

/** Le budget : ses réglages, et ce que disent les commandes, par mois et par fournisseur. */
export function BudgetPanel() {
  const statSize = useStatSize()
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const collection = useCollectionStore((state) => state.collection)
  const months = spendingByMonth(orders)
  const suppliers = spendingBySupplier(orders)
  const total = spentOn(orders)
  const cancelled = orders.filter((order) => order.state === 'cancelled').length
  const perSpecies = costPerSpecies(orders, (cardId) => findCard(cardId, collection)?.dexIds ?? [])

  return (
    <Stack gap={6} className={page.panel}>
      <Panel title="Réglages" description="Enregistrés en quittant le champ ; vide vaut 0.">
        <div className={page.formGrid3}>
          <BudgetField field="monthly" />
          <BudgetField field="ceiling" />
          <BudgetField field="shippingReserve" />
        </div>
      </Panel>

      <div className="stat-grid">
        <Stat
          size={statSize}
          label="Dépensé en tout"
          icon={<Wallet size={18} />}
          value={formatEuro(total.spent)}
          hint={details(
            plural(total.orders, 'commande', 'commandes'),
            plural(total.cards, 'carte', 'cartes'),
          )}
        />
        <Stat
          size={statSize}
          label="Port et frais"
          icon={<Truck size={18} />}
          value={formatEuro(total.shipping)}
          hint="Cumulés, toutes commandes comprises."
        />
        <Stat
          size={statSize}
          label="Coût moyen d’un Pokémon"
          icon={<Calculator size={18} />}
          value={perSpecies.average === null ? '—' : formatEuro(perSpecies.average)}
          hint={`Pour ${plural(perSpecies.species, 'Pokémon acheté', 'Pokémon achetés')}, port compris.`}
        />
        <Stat
          size={statSize}
          label="Commandes"
          icon={<Receipt size={18} />}
          value={formatInteger(orders.length)}
          // Les annulées comptées à part : « Dépensé en tout » ne compte pas les annulées.
          hint={details(
            `dont ${formatInteger(pendingCount(orders))} en cours`,
            cancelled > 0 && plural(cancelled, 'annulée', 'annulées'),
          )}
        />
      </div>

      <Panel
        flush
        title="Mois par mois"
        description="Chaque commande compte une fois, dans le mois de sa date d’achat : cartes, port et frais, moins le remboursé. Une commande annulée ne compte pas."
      >
        <Table
          bordered={false}
          className={cx('stack-table', styles.months)}
          data={months}
          rowKey={(row) => row.key}
          emptyState="Aucune commande enregistrée."
          columns={[
            { key: 'key', header: 'Mois', cell: (row) => formatMonth(row.key) },
            ...COUNT_COLUMNS,
            {
              key: 'shipping',
              header: 'Port et frais',
              align: 'right',
              cell: (row) => (
                <>
                  <span className="stack-label">port et frais </span>
                  {formatEuro(row.shipping)}
                </>
              ),
            },
            {
              key: 'spent',
              header: 'Dépensé',
              align: 'right',
              cell: (row) => (
                <span className={page.stacked}>
                  {formatEuro(row.spent)}
                  <BudgetLevelBadge spent={row.spent} budget={budget} />
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <Panel title="Par fournisseur" flush>
        <Table
          bordered={false}
          className={cx('stack-table', styles.suppliers)}
          data={suppliers}
          rowKey={(row) => row.key}
          emptyState="Aucune commande enregistrée."
          columns={[
            { key: 'key', header: 'Fournisseur' },
            ...COUNT_COLUMNS,
            {
              key: 'spent',
              header: 'Dépensé',
              align: 'right',
              cell: (row) => formatEuro(row.spent),
            },
          ]}
        />
      </Panel>
    </Stack>
  )
}
