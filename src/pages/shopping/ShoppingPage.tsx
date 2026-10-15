import { Badge, Tab, TabList, TabPanel, Tabs } from '@camply/ui'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'
import { isToBuy } from '@/lib/collection'
import { DEFAULT_WISHLIST_FILTERS, underMaxCount, type WishlistFilters } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import { BudgetOverview } from './BudgetOverview'
import { BudgetPanel } from './BudgetPanel'
import { OrdersPanel } from './OrdersPanel'
import { PlannerPanel, type PlannerSettings } from './PlannerPanel'
import { useWishlist } from '@/hooks/useWishlist'
import { WishlistPanel } from './WishlistPanel'
import styles from './ShoppingPage.module.css'

const VIEWS = ['liste', 'prochaine-commande', 'commandes', 'budget'] as const
/** Le filtre « sous le prix maximum » dans l'adresse : `/achats?filtre=sous-max`. */
const UNDER_MAX = 'sous-max'

/**
 * Achats (`/achats`) : le budget du mois, la liste d'achats, l'assistant de la prochaine commande,
 * le registre des commandes et le suivi du budget. L'onglet ouvert est dans l'adresse (`?vue=`),
 * comme le filtre « sous le prix maximum » (`?filtre=sous-max`, le lien de l'accueil y mène) ;
 * les filtres de la liste et les réglages de l'assistant sont gardés ici, l'onglet caché étant
 * démonté.
 */
export function ShoppingPage() {
  const [params, setParams] = useSearchParams()
  const view = VIEWS.find((known) => known === params.get('vue')) ?? 'liste'
  // Un paramètre de l'adresse changé, les autres gardés.
  const setParam = (name: string, value: string | null) =>
    setParams(
      (current) => {
        const address = new URLSearchParams(current)
        if (value === null) address.delete(name)
        else address.set(name, value)
        return address
      },
      { replace: true, preventScrollReset: true },
    )
  const openView = (next: string) => setParam('vue', next === 'liste' ? null : next)
  const { rows } = useWishlist()
  const [filters, setFilters] = useState<WishlistFilters>(() => ({
    ...DEFAULT_WISHLIST_FILTERS,
    underMax: params.get('filtre') === UNDER_MAX,
  }))
  const changeFilters = (next: WishlistFilters) => {
    setFilters(next)
    if (next.underMax !== filters.underMax) setParam('filtre', next.underMax ? UNDER_MAX : null)
  }
  const [planner, setPlanner] = useState<PlannerSettings>({})
  // Une commande enregistrée depuis le plan ouvre « Commandes » : le focus va à son onglet, le
  // bouton du plan disparaissant avec le sien.
  const ordersTab = useRef<HTMLButtonElement>(null)
  const focusOrders = useRef(false)
  useEffect(() => {
    if (view !== 'commandes' || !focusOrders.current) return
    focusOrders.current = false
    ordersTab.current?.focus()
  }, [view])
  const underMax = underMaxCount(rows)
  const pending = useShoppingStore(
    (state) => state.shopping.orders.filter((order) => order.state === 'pending').length,
  )

  return (
    <div className="container">
      <title>{pageTitle('Achats')}</title>
      <PageHeader title="Achats">
        Votre liste d’achats, votre budget et vos commandes. Les prix sont ceux du marché
        (Cardmarket) : une indication, pas une offre de vendeur.
      </PageHeader>

      <BudgetOverview />

      <Tabs value={view} onChange={openView} defaultValue="liste" className={styles.tabs}>
        <TabList aria-label="Achats" className={styles.tabList}>
          <Tab value="liste">
            Liste d’achats <Badge size="sm">{rows.filter(isToBuy).length}</Badge>
            {underMax > 0 && (
              <Badge size="sm" tone="success">
                {underMax} sous le prix maximum
              </Badge>
            )}
          </Tab>
          <Tab value="prochaine-commande">Prochaine commande</Tab>
          <Tab ref={ordersTab} value="commandes">
            Commandes {pending > 0 && <Badge size="sm">{pending}</Badge>}
          </Tab>
          <Tab value="budget">Budget</Tab>
        </TabList>
        <TabPanel value="liste">
          <WishlistPanel filters={filters} onFiltersChange={changeFilters} />
        </TabPanel>
        <TabPanel value="prochaine-commande">
          <PlannerPanel
            settings={planner}
            onSettingsChange={setPlanner}
            onOrderSaved={() => {
              focusOrders.current = true
              openView('commandes')
            }}
          />
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
