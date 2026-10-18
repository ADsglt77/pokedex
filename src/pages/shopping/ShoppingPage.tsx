import { Badge, Tab, TabList, TabPanel, Tabs } from '@camply/ui'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import {
  parseShopping,
  serializeShopping,
  type ShoppingView,
  type WishlistFilters,
} from '@/lib/filters'
import { pageTitle } from '@/lib/format'
import { pendingCount } from '@/lib/orders'
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
 * le registre des commandes et le suivi du budget. L'onglet ouvert et les filtres de la liste sont
 * dans l'adresse (`?vue=`, `q`, `generation`, `tri` : `parseShopping`) : ils survivent à
 * l'ouverture d'une fiche et au retour. Les réglages de l'assistant sont gardés ici, l'onglet
 * caché étant démonté.
 */
export function ShoppingPage() {
  const [params, setParams] = useSearchParams()
  const { view, filters } = useMemo(() => parseShopping(params), [params])
  // Change l'onglet ou des filtres, et garde le reste : changer d'onglet garde les filtres.
  const update = (change: { view?: ShoppingView; filters?: Partial<WishlistFilters> }) =>
    setParams(
      (current) => {
        const now = parseShopping(current)
        return serializeShopping(change.view ?? now.view, { ...now.filters, ...change.filters })
      },
      {
        // Pas une entrée d'historique par onglet, par filtre ou par frappe.
        replace: true,
        preventScrollReset: true,
        // Le routeur passe ses mises à jour dans une transition : le champ de recherche, qui lit
        // l'adresse, suivrait la frappe en retard. La liste, elle, reste différée (WishlistPanel).
        flushSync: change.filters !== undefined && 'search' in change.filters,
        // Sans relancer le chargement de la route : sinon le curseur du champ part au bout du texte
        // (voir usePokedexFilters).
        defaultShouldRevalidate: false,
      },
    )
  const openView = (next: ShoppingView) => update({ view: next })
  const { rows } = useWishlist()
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

      <Tabs
        value={view}
        onChange={(next) => openView(next as ShoppingView)}
        defaultValue="liste"
        className={styles.tabs}
      >
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
          <WishlistPanel
            filters={filters}
            onFiltersChange={(patch) => update({ filters: patch })}
          />
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
