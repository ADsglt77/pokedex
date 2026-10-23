import { Button } from '@camply/ui'
import { Grid3x3 } from '@camply/ui/icons'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { monthOf } from '@/lib/budget'
import { localDayOf, pageTitle, plural, today } from '@/lib/format'
import { acquisitions } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { Indicators } from './Indicators'
import { ProgressPanel } from './ProgressPanel'
import { Chosen, RecentPanel, SHOWN_CARDS } from './RecentPanel'
import { StartPanel } from './StartPanel'
import { TodoPanel } from './TodoPanel'
import styles from './HomePage.module.css'

/**
 * L'accueil, un tableau de bord : la progression (en tout, par génération), ce qui attend une
 * action, la valeur et le budget du mois, puis les dernières cartes obtenues. Une collection vide
 * y trouve comment commencer.
 */
export function HomePage() {
  const collection = useCollectionStore((state) => state.collection)
  const hasOrders = useShoppingStore((state) => state.shopping.orders.length > 0)
  const obtained = acquisitions(collection)
  // Des cartes, ou des commandes (gardées par « Effacer ma collection ») : « À faire » les suit.
  const started = Object.keys(collection.customCards).length > 0 || hasOrders
  const month = monthOf(today())
  const thisMonth = obtained.filter(
    ({ acquiredAt }) => acquiredAt && monthOf(localDayOf(acquiredAt)) === month,
  ).length

  return (
    <div className="container">
      <title>{pageTitle()}</title>
      <PageHeader
        title="Mon Pokédex"
        actions={
          <Button asChild leftIcon={<Grid3x3 size={16} />}>
            <Link to="/pokedex">Ouvrir le Pokédex</Link>
          </Button>
        }
      >
        {thisMonth > 0
          ? `${plural(thisMonth, 'carte obtenue', 'cartes obtenues')} ce mois-ci.`
          : 'Vos cartes Pokémon japonaises et françaises, une par Pokémon : choisissez-les, obtenez-les, débloquez le Pokédex.'}
      </PageHeader>

      <div className={styles.dashboard}>
        <ProgressPanel />
        {started ? <TodoPanel /> : <StartPanel />}
        {started && <Indicators />}
        {obtained.length > 0 ? (
          <RecentPanel cards={obtained.slice(0, SHOWN_CARDS)} />
        ) : (
          started && <Chosen />
        )}
      </div>
    </div>
  )
}
