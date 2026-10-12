import { Badge, type Column, Stack, Stat, Table } from '@camply/ui'
import { Calculator, Receipt, Truck, Wallet } from '@camply/ui/icons'
import { EuroInput } from '@/components/CommitInput'
import { useCollectionAction } from '@/hooks/useNotify'
import { costPerSpecies, spendingByMonth, spendingBySupplier, spentOn } from '@/lib/budget'
import { findCard } from '@/lib/catalog'
import { formatEuro, formatInteger, formatMonth, plural } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { BudgetSettings } from '@/types'
import styles from './ShoppingPage.module.css'

const BUDGET_FIELDS: { key: keyof BudgetSettings; label: string; hint: string }[] = [
  { key: 'monthly', label: 'Budget du mois', hint: 'Ce que vous dépensez d’habitude.' },
  { key: 'ceiling', label: 'Plafond du mois', hint: 'Au-delà, une confirmation est demandée.' },
  {
    key: 'shippingReserve',
    label: 'Réserve pour le port',
    hint: 'Gardée sur le budget de la prochaine commande.',
  },
]

type Row = ReturnType<typeof spendingByMonth>[number]

/** Les colonnes communes aux deux tableaux : nombre de commandes et de cartes. */
const COUNT_COLUMNS: Column<Row>[] = [
  {
    key: 'orders',
    header: 'Commandes',
    align: 'right',
    cell: (row) => formatInteger(row.orders),
  },
  { key: 'cards', header: 'Cartes', align: 'right', cell: (row) => formatInteger(row.cards) },
]

/** Le budget : ses réglages, et ce que disent les commandes, par mois et par fournisseur. */
export function BudgetPanel() {
  const act = useCollectionAction()
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const collection = useCollectionStore((state) => state.collection)
  const months = spendingByMonth(orders)
  const suppliers = spendingBySupplier(orders)
  const total = spentOn(orders)
  const perSpecies = costPerSpecies(orders, (cardId) => findCard(cardId, collection)?.dexIds ?? [])

  return (
    <Stack gap={8} className={styles.panel}>
      <Stack gap={4}>
        <h2 className={styles.sectionTitle}>Réglages</h2>
        <div className={styles.formGrid3}>
          {BUDGET_FIELDS.map(({ key, label, hint }) => (
            <EuroInput
              key={key}
              label={label}
              hint={hint}
              value={budget[key]}
              onCommit={(value) =>
                act(
                  () => useShoppingStore.getState().setBudget({ [key]: value ?? 0 }),
                  `${label} : ${formatEuro(value ?? 0)}.`,
                )
              }
            />
          ))}
        </div>
      </Stack>

      <div className="stat-grid">
        <Stat
          label="Dépensé en tout"
          icon={<Wallet size={18} />}
          value={formatEuro(total.spent)}
          hint={`${plural(total.orders, 'commande', 'commandes')} · ${plural(total.cards, 'carte', 'cartes')}`}
        />
        <Stat
          label="Port et frais"
          icon={<Truck size={18} />}
          value={formatEuro(total.shipping)}
          hint="Cumulés, toutes commandes comprises."
        />
        <Stat
          label="Coût moyen d’un Pokémon"
          icon={<Calculator size={18} />}
          value={perSpecies.average === null ? '—' : formatEuro(perSpecies.average)}
          hint={`Pour ${plural(perSpecies.species, 'Pokémon acheté', 'Pokémon achetés')}, port compris.`}
        />
        <Stat
          label="Commandes"
          icon={<Receipt size={18} />}
          value={formatInteger(orders.length)}
          hint={`dont ${formatInteger(orders.filter((order) => order.state === 'pending').length)} en cours`}
        />
      </div>

      <Stack gap={4}>
        <h2 className={styles.sectionTitle}>Mois par mois</h2>
        <Table
          className={styles.table}
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
              cell: (row) => formatEuro(row.shipping),
            },
            {
              key: 'spent',
              header: 'Dépensé',
              align: 'right',
              cell: (row) => (
                <span className={styles.stacked}>
                  {formatEuro(row.spent)}
                  {row.spent > budget.ceiling ? (
                    <Badge size="sm" tone="danger">
                      Plafond dépassé
                    </Badge>
                  ) : (
                    row.spent > budget.monthly && (
                      <Badge size="sm" tone="warn">
                        Au-delà du budget
                      </Badge>
                    )
                  )}
                </span>
              ),
            },
          ]}
        />
      </Stack>

      <Stack gap={4}>
        <h2 className={styles.sectionTitle}>Par fournisseur</h2>
        <Table
          className={styles.table}
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
        <p className="muted">
          Chaque commande compte une fois, dans le mois de sa date d’achat : cartes, port et frais,
          moins le remboursé. Une commande annulée ne compte pas.
        </p>
      </Stack>
    </Stack>
  )
}
