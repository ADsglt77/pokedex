import { Alert, Skeleton, Stack, Stat } from '@camply/ui'
import { Flag } from '@camply/ui/icons'
import { Suspense, use, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { PriceChart } from '@/components/PriceChart'
import { STATUS_ICONS } from '@/components/statusIcons'
import { usePokedex } from '@/hooks/usePokedex'
import {
  details,
  formatDate,
  formatEuro,
  formatInteger,
  monthRange,
  pageTitle,
  plural,
  today,
} from '@/lib/format'
import { spendingByMonth } from '@/lib/budget'
import {
  collectionHistory,
  completionByGeneration,
  completionCost,
  gainPercent,
  tallyByStatus,
  trackedCards,
  type Tally,
} from '@/lib/prices'
import { unlockedByMonth } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { loadPriceHistories, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import { CardsTable, CompletionTable } from './ValueTables'
import styles from './ValuePage.module.css'

/** « 3 cartes · payées 120,00 € · 1 sans prix » */
const tallyHint = (tally: Tally, withPaid: boolean) =>
  details(
    plural(tally.count, 'carte', 'cartes'),
    withPaid && tally.paid > 0 && `payées ${formatEuro(tally.paid)}`,
    tally.unpriced > 0 && `${formatInteger(tally.unpriced)} sans prix`,
  )

/**
 * Valeur : ce que vaut la collection au prix Cardmarket du jour, ce qu'elle a coûté, ce que
 * coûterait de la compléter, et son évolution.
 */
export function ValuePage() {
  const prices = usePrices()
  const pricesMissing = usePricesMissing()
  const collection = useCollectionStore((state) => state.collection)
  const { entries } = usePokedex()
  const cards = useMemo(() => trackedCards(collection, prices), [collection, prices])
  const tallies = tallyByStatus(cards)
  const completion = useMemo(() => completionByGeneration(entries, prices), [entries, prices])
  const toComplete = useMemo(() => completionCost(entries, prices), [entries, prices])
  const owned = cards.filter((card) => card.status === 'owned').map((card) => card.card)

  return (
    <div className="container">
      <title>{pageTitle('Valeur')}</title>
      <PageHeader title="Valeur">
        Prix du marché Cardmarket
        {prices?.cardmarket && ` du ${formatDate(prices.cardmarket.date)}`}, en euros ; pour les
        cartes sans id Cardmarket, celui de TCGplayer, converti. Une estimation : l’état de la carte
        et le vendeur font varier le prix réel.
      </PageHeader>

      {pricesMissing && (
        <Alert tone="info" title="Les prix ne sont pas disponibles pour le moment.">
          Ils sont relus chaque jour par le serveur. Les prix payés que vous avez notés restent
          visibles ci-dessous.
        </Alert>
      )}

      <Stack gap={8} className={styles.page}>
        <div className="stat-grid">
          <Stat
            label="Ma collection"
            icon={<STATUS_ICONS.owned size={18} />}
            value={formatEuro(tallies.owned.value)}
            delta={gainPercent(tallies.owned.paidCardsValue, tallies.owned.paid)}
            hint={tallyHint(tallies.owned, true)}
          />
          <Stat
            label="Commandées"
            icon={<STATUS_ICONS.ordered size={18} />}
            value={formatEuro(tallies.ordered.value)}
            hint={tallyHint(tallies.ordered, true)}
          />
          <Stat
            label="Souhaitées"
            icon={<STATUS_ICONS.wanted size={18} />}
            value={formatEuro(tallies.wanted.value)}
            hint={tallyHint(tallies.wanted, false)}
          />
          <Stat
            label="Pour compléter le Pokédex"
            icon={<Flag size={18} />}
            value={formatEuro(toComplete.value)}
            hint={details(
              plural(toComplete.priced, 'Pokémon chiffré', 'Pokémon chiffrés'),
              toComplete.unpriced > 0 && `${formatInteger(toComplete.unpriced)} sans prix`,
              toComplete.noCard > 0 && `${formatInteger(toComplete.noCard)} sans carte`,
            )}
          />
        </div>

        <Stack as="section" gap={4} aria-labelledby="history-title">
          <h2 id="history-title">Valeur de ma collection</h2>
          <p className="muted">
            Vos cartes possédées aujourd’hui, au prix de chaque jour. Un nouveau point chaque jour.
          </p>
          {owned.length > 0 ? (
            <Suspense fallback={<Skeleton height="7rem" />}>
              <CollectionChart cards={owned} />
            </Suspense>
          ) : (
            <p className="muted">Aucune carte possédée pour l’instant : pas de courbe à tracer.</p>
          )}
        </Stack>

        <MonthlyCharts />

        <Stack as="section" gap={4} aria-labelledby="cards-title">
          <h2 id="cards-title">Mes cartes</h2>
          <CardsTable cards={cards} />
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="completion-title">
          <h2 id="completion-title">Pour compléter, par génération</h2>
          <p className="muted">
            Pour chaque Pokémon à débloquer, le prix de sa carte ; ceux sans carte, ou dont la carte
            n’a pas de prix, sont comptés à part. Ceux dont la carte est déjà commandée n’y sont pas
            : ils comptent dans les commandes.
          </p>
          <CompletionTable rows={completion} />
        </Stack>
      </Stack>
    </div>
  )
}

function CollectionChart({ cards }: { cards: PokemonCard[] }) {
  // Les cartes sans id Cardmarket n'ont pas de prix : elles ne pèsent pas sur la courbe. La même
  // carte Cardmarket possédée pour deux Pokémon compte deux fois, comme dans la valeur du jour ;
  // son historique n'est demandé qu'une fois.
  const ids = cards.flatMap((card) => card.cardmarket ?? []).sort((a, b) => a - b)
  const histories = use(loadPriceHistories(ids))
  return <PriceChart points={collectionHistory(histories)} label="Valeur de ma collection" />
}

/** Au fil des mois : les Pokémon débloqués (cumul) et ce que coûtent les commandes de chaque mois. */
function MonthlyCharts() {
  const collection = useCollectionStore((state) => state.collection)
  const orders = useShoppingStore((state) => state.shopping.orders)
  const month = today().slice(0, 7)
  const unlocked = useMemo(() => unlockedByMonth(collection, month), [collection, month])
  const spent = useMemo(() => {
    const byMonth = new Map(spendingByMonth(orders).map(({ key, spent }) => [key, spent]))
    const first = [...byMonth.keys()].sort()[0]
    return first
      ? monthRange(first, month).map((key) => ({ date: `${key}-01`, value: byMonth.get(key) ?? 0 }))
      : []
  }, [orders, month])

  return (
    <Stack as="section" gap={4} aria-labelledby="months-title">
      <h2 id="months-title">Au fil des mois</h2>
      <div className={styles.months}>
        <Stack gap={3}>
          <h3 className={styles.chartTitle}>Pokémon débloqués</h3>
          {unlocked.length >= 2 ? (
            <PriceChart points={unlocked} label="Pokémon débloqués" format={formatInteger} />
          ) : (
            <p className="muted">
              La courbe se dessine dès votre deuxième mois de cartes obtenues.
            </p>
          )}
        </Stack>
        <Stack gap={3}>
          <h3 className={styles.chartTitle}>Dépenses par mois</h3>
          {spent.length >= 2 ? (
            <PriceChart points={spent} label="Dépenses par mois" />
          ) : (
            <p className="muted">La courbe se dessine dès votre deuxième mois de commandes.</p>
          )}
        </Stack>
      </div>
    </Stack>
  )
}
