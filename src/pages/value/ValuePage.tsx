import { Alert, Skeleton, Stack, Stat } from '@camply/ui'
import { Flag } from '@camply/ui/icons'
import { Suspense, use, useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { PriceChart } from '@/components/PriceChart'
import { STATUS_ICONS } from '@/components/statusIcons'
import { usePokedex } from '@/hooks/usePokedex'
import { formatDate, formatEuro, pageTitle, plural } from '@/lib/format'
import {
  collectionHistory,
  completionByGeneration,
  gainPercent,
  tallyByStatus,
  trackedCards,
  type Tally,
} from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { loadPriceHistory, usePrices, usePricesMissing } from '@/store/prices'
import type { PokemonCard } from '@/types'
import { CardsTable, CompletionTable } from './ValueTables'
import styles from './ValuePage.module.css'

/** « 3 cartes · payées 120,00 € · 1 sans prix » */
function tallyHint(tally: Tally, withPaid: boolean): string {
  return [
    plural(tally.count, 'carte', 'cartes'),
    withPaid && tally.paid > 0 && `payées ${formatEuro(tally.paid)}`,
    tally.unpriced > 0 && `${tally.unpriced} sans prix`,
  ]
    .filter(Boolean)
    .join(' · ')
}

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
  const toComplete = completion.reduce(
    (total, { cost }) => ({
      value: total.value + cost.value,
      priced: total.priced + cost.priced,
      unpriced: total.unpriced + cost.unpriced,
    }),
    { value: 0, priced: 0, unpriced: 0 },
  )
  const owned = cards.filter((card) => card.status === 'owned').map((card) => card.card)

  return (
    <div className="container">
      <title>{pageTitle('Valeur')}</title>
      <PageHeader title="Valeur">
        Prix du marché Cardmarket{prices && ` du ${formatDate(prices.date)}`}, en euros. Une
        estimation : l’état de la carte et le vendeur font varier le prix réel.
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
            hint={[
              plural(toComplete.priced, 'Pokémon chiffré', 'Pokémon chiffrés'),
              toComplete.unpriced > 0 && `${toComplete.unpriced} sans carte chiffrée`,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        </div>

        <Stack as="section" gap={4} aria-labelledby="history-title">
          <h2 id="history-title" className={styles.title}>
            Valeur de ma collection
          </h2>
          <p className="muted">
            Vos cartes possédées aujourd’hui, au prix de chaque jour. Un nouveau point chaque jour.
          </p>
          <Suspense fallback={<Skeleton height="7rem" />}>
            <CollectionChart cards={owned} />
          </Suspense>
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="cards-title">
          <h2 id="cards-title" className={styles.title}>
            Mes cartes
          </h2>
          <CardsTable cards={cards} />
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="completion-title">
          <h2 id="completion-title" className={styles.title}>
            Pour compléter, par génération
          </h2>
          <p className="muted">
            Pour chaque Pokémon à débloquer, sa carte candidate la moins chère. Ceux dont une carte
            est déjà commandée n’y sont pas : ils comptent dans les commandes.
          </p>
          <CompletionTable rows={completion} />
        </Stack>
      </Stack>
    </div>
  )
}

function CollectionChart({ cards }: { cards: PokemonCard[] }) {
  const history = use(loadPriceHistory())
  return <PriceChart points={collectionHistory(history, cards)} label="Valeur de ma collection" />
}
