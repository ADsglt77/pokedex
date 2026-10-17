import { Badge, Tab, TabList, TabPanel, Tabs } from '@camply/ui'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { SHOPPING_VIEWS } from '@/lib/filters'
import { pageTitle } from '@/lib/format'
import { pendingCount } from '@/lib/orders'
import { DEFAULT_WISHLIST_FILTERS, type WishlistFilters } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import { BudgetOverview } from './BudgetOverview'
import { BudgetPanel } from './BudgetPanel'
import { OrdersPanel } from './OrdersPanel'
import { PlannerPanel, type PlannerSettings } from './PlannerPanel'
import { useWishlist } from '@/hooks/useWishlist'
import { WishlistPanel } from './WishlistPanel'
import styles from './ShoppingPage.module.css'

/**
 * Achats (`/achats`) : le budget du mois, la liste d'achats, l'assistant de la prochaine commande,
 * le registre des commandes et le suivi du budget. L'onglet ouvert est dans l'adresse (`?vue=`) ;
 * les filtres de la liste et les réglages de l'assistant sont gardés ici, l'onglet caché étant
 * démonté.
 */
export function ShoppingPage() {
  const [params, setParams] = useSearchParams()
  const view = SHOPPING_VIEWS.find((known) => known === params.get('vue')) ?? 'liste'
  // `vue` est le seul paramètre de l'adresse ; la liste, l'onglet par défaut, n'en a pas.
  const openView = (next: string) =>
    setParams(next === 'liste' ? {} : { vue: next }, { replace: true, preventScrollReset: true })
  const { rows } = useWishlist()
  const [filters, setFilters] = useState<WishlistFilters>(DEFAULT_WISHLIST_FILTERS)
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
  // Sur téléphone, les onglets défilent de côté : l'onglet ouvert est amené dans la rangée (sans
  // faire défiler la page, contrairement à `scrollIntoView`).
  const tabList = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const list = tabList.current
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !tab) return
    list.scrollLeft = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2
  }, [view])
  const pending = useShoppingStore((state) => pendingCount(state.shopping.orders))

  return (
    <div className="container">
      <title>{pageTitle('Achats')}</title>
      <PageHeader title="Achats">
        Les cartes de vos Pokémon pas encore obtenues, votre budget et vos commandes. Les prix sont
        ceux du marché (Cardmarket) : une indication, pas une offre de vendeur.
      </PageHeader>

      <BudgetOverview />

      <Tabs value={view} onChange={openView} defaultValue="liste" className={styles.tabs}>
        <TabList ref={tabList} aria-label="Achats" className={styles.tabList}>
          <Tab value="liste">
            Liste d’achats <Badge size="sm">{rows.length}</Badge>
          </Tab>
          <Tab value="prochaine-commande">Prochaine commande</Tab>
          <Tab ref={ordersTab} value="commandes">
            Commandes{' '}
            {pending > 0 && (
              <Badge size="sm">
                {pending}
                <span className={styles.badgeWords}> en cours</span>
              </Badge>
            )}
          </Tab>
          <Tab value="budget">Budget</Tab>
        </TabList>
        <TabPanel value="liste">
          <WishlistPanel filters={filters} onFiltersChange={setFilters} />
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
