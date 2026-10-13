import { Badge, Tab, TabList, TabPanel, Tabs } from '@camply/ui'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'
import { isToBuy } from '@/lib/collection'
import { isUnderMax } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import { BudgetOverview } from './BudgetOverview'
import { BudgetPanel } from './BudgetPanel'
import { OrdersPanel } from './OrdersPanel'
import { PlannerPanel } from './PlannerPanel'
import { useWishlist } from '@/hooks/useWishlist'
import { WishlistPanel } from './WishlistPanel'
import styles from './ShoppingPage.module.css'

const VIEWS = ['liste', 'prochaine-commande', 'commandes', 'budget'] as const
/**
 * Achats (`/achats`) : le budget du mois, la liste d'achats, l'assistant de la prochaine commande,
 * le registre des commandes et le suivi du budget. L'onglet ouvert est dans l'adresse (`?vue=`).
 */
export function ShoppingPage() {
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find((known) => known === params.get('vue')) ?? 'liste'
  const openView = (next: string) =>
    setParams(next === 'liste' ? {} : { vue: next }, { replace: true, preventScrollReset: true })
  const { rows } = useWishlist()
  const underMax = rows.filter((row) => isToBuy(row) && isUnderMax(row)).length
  const pending = useShoppingStore(
    (state) => state.shopping.orders.filter((order) => order.state === 'pending').length,
  )

  return (
    <div className="container">
      <title>{pageTitle('Achats')}</title>
      <PageHeader title="Achats">
        Votre liste d’achats, votre budget et vos commandes. Les prix sont ceux du marché Cardmarket
        : une indication, pas une offre de vendeur.
      </PageHeader>

      <BudgetOverview />

      <Tabs value={view} onChange={openView} defaultValue="liste" className={styles.tabs}>
        <TabList aria-label="Achats" className={styles.tabList}>
          <Tab value="liste">
            Liste d’achats <Badge size="sm">{rows.filter(isToBuy).length}</Badge>
            {underMax > 0 && (
              <Badge size="sm" tone="success">
                {underMax} sous le max
              </Badge>
            )}
          </Tab>
          <Tab value="prochaine-commande">Prochaine commande</Tab>
          <Tab value="commandes">Commandes {pending > 0 && <Badge size="sm">{pending}</Badge>}</Tab>
          <Tab value="budget">Budget</Tab>
        </TabList>
        <TabPanel value="liste">
          <WishlistPanel />
        </TabPanel>
        <TabPanel value="prochaine-commande">
          <PlannerPanel onOrderSaved={() => openView('commandes')} />
        </TabPanel>
        <TabPanel value="commandes">
          <OrdersPanel />
        </TabPanel>
        <TabPanel value="budget">
          <BudgetPanel />
        </TabPanel>
      </Tabs>
    </div>
  )
}
