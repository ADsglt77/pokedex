import { Button, Card, Progress, Stat } from '@camply/ui'
import { Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { PageHeader } from '@/components/PageHeader'
import { PricedValue } from '@/components/PricedValue'
import { SeriesGrid } from '@/components/SeriesGrid'
import { SetLogo } from '@/components/SetLogo'
import { useCollectionAction } from '@/hooks/useNotify'
import { useStatSize } from '@/hooks/useStatSize'
import { cardLanguage } from '@/lib/collection'
import { catalogLanguage } from '@/lib/filters'
import {
  details,
  formatDate,
  formatEuro,
  formatInteger,
  formatShare,
  pageTitle,
  plural,
} from '@/lib/format'
import { progressPercent } from '@/lib/pokedex'
import { findSeries, seriesProgress, seriesRemoval } from '@/lib/series'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'
import { useShoppingStore } from '@/store/shopping'
import type { CollectionData, SeriesCollection } from '@/types'
import styles from './SeriesPage.module.css'

/**
 * La page d'une collection d'extension (`/collections/M6A`, `?langue=fr` pour une française,
 * `seriesPath`) : son nom et le drapeau de sa langue, son logo, ses cartes possédées sur toutes,
 * leur valeur, le coût pour la compléter (et combien de cartes à acheter n'ont pas de prix) ; puis
 * toutes ses cartes (`SeriesGrid`), chacune ouvrant sa fenêtre. Une collection inconnue : la page
 * introuvable. Une collection qui disparaît sous la page (supprimée ici, son début annulé par
 * « Annuler », supprimée sur un autre appareil) ramène aux Collections.
 */
export function SeriesPage() {
  const { set = '' } = useParams()
  const [params] = useSearchParams()
  const language = catalogLanguage(params)
  const collection = useCollectionStore((state) => state.collection)
  const series = findSeries(collection, set, language)
  // La collection montrée ici (sa langue et son code) : si elle disparaît, retour aux Collections.
  const key = `${language} ${set}`
  const [shown, setShown] = useState<string | null>(null)
  if (series && shown !== key) setShown(key)
  if (!series) return shown === key ? <Navigate to="/collections" replace /> : <NotFoundPage />

  // Une clé par collection : une carte ouverte, ou les cartes déjà dessinées, ne passent pas d'une
  // collection à l'autre (l'historique mène de l'une à l'autre sans changer de page).
  return (
    <div key={key} className="container">
      <title>{pageTitle(series.name)}</title>
      <PageHeader
        title={
          <>
            {series.name}
            <LanguageFlag language={language} of="set" />
          </>
        }
        actions={<RemoveSeries collection={collection} series={series} />}
      >
        {details(`Extension ${series.set}`, `commencée le ${formatDate(series.startedAt)}`)}
      </PageHeader>
      <SeriesSummary collection={collection} series={series} />
      <section className={styles.cards}>
        <h2 className={styles.heading}>Ses cartes</h2>
        <SeriesGrid collection={collection} series={series} linked />
      </section>
    </div>
  )
}

/**
 * Le logo de l'extension (son code s'il n'y en a pas), puis où en est la collection : ses cartes
 * possédées sur toutes et la barre, leur valeur au prix du jour, le coût de celles à acheter (ni
 * possédées ni commandées), sans celles qui n'ont pas de prix, dites à part.
 */
function SeriesSummary({
  collection,
  series,
}: {
  collection: CollectionData
  series: SeriesCollection
}) {
  const statSize = useStatSize()
  const prices = usePrices()
  const { owned, total, value, toComplete, unpriced } = seriesProgress(collection, series, prices)
  const percent = progressPercent(owned, total)
  return (
    <Card padding="none" className={styles.summary}>
      <div className={styles.art}>
        <SetLogo
          set={{ language: cardLanguage(series), id: series.set, logo: true }}
          size="hd"
          className={styles.logo}
        />
      </div>
      <div className={styles.figures}>
        <Stat
          variant="plain"
          size={statSize}
          label="Cartes possédées"
          value={
            <span className="numeric">
              {formatInteger(owned)} / {formatInteger(total)}
            </span>
          }
          hint={formatShare(percent)}
        />
        <Stat
          variant="plain"
          size={statSize}
          label="Valeur"
          value={<PricedValue>{formatEuro(value)}</PricedValue>}
          hint="Ses cartes possédées, au prix du jour"
        />
        <Stat
          variant="plain"
          size={statSize}
          label="Pour la compléter"
          value={<PricedValue>{formatEuro(toComplete)}</PricedValue>}
          hint={
            <PricedValue text>
              {unpriced > 0
                ? `Sans compter ${plural(unpriced, 'carte', 'cartes')} sans prix`
                : 'Ses cartes à acheter, au prix du jour'}
            </PricedValue>
          }
        />
        <Progress size="sm" value={percent} aria-hidden className={styles.bar} />
      </div>
    </Card>
  )
}

/**
 * « Supprimer la collection » : une confirmation dit ce qui reste (les cartes possédées, au
 * Pokédex ; commandées ou dans une commande, comme cartes seules ; ajoutées seules, telles
 * quelles) et ce qui part (les cartes à acheter), d'après `seriesRemoval` ; puis la page ramène
 * aux Collections (`SeriesPage`), la suppression annoncée avec « Annuler ».
 */
function RemoveSeries({
  collection,
  series,
}: {
  collection: CollectionData
  series: SeriesCollection
}) {
  const act = useCollectionAction()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const [confirming, setConfirming] = useState(false)
  const { owned, kept, alone, dropped } = seriesRemoval(collection, series, orders)
  const stays = [
    owned.length > 0 && `${plural(owned.length, 'carte possédée', 'cartes possédées')}, au Pokédex`,
    kept.length > 0 &&
      `${plural(kept.length, 'carte commandée ou dans une commande', 'cartes commandées ou dans une commande')}, comme ${kept.length > 1 ? 'cartes seules' : 'carte seule'}`,
    alone.length > 0 &&
      `${plural(alone.length, 'carte ajoutée seule', 'cartes ajoutées seules')}, ${alone.length > 1 ? 'telles quelles' : 'telle quelle'}`,
  ].filter((part) => part !== false)

  const remove = () =>
    act(
      () => useCollectionStore.getState().removeSeries(series.set, cardLanguage(series)),
      `Collection ${series.name} supprimée.`,
      'info',
    )

  return (
    <>
      <Button
        variant="ghost"
        tone="danger"
        leftIcon={<Trash2 size={16} />}
        onClick={() => setConfirming(true)}
      >
        Supprimer la collection
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Supprimer la collection ${series.name} ?`}
        confirmLabel="Supprimer la collection"
        onClose={() => setConfirming(false)}
        onConfirm={remove}
      >
        <p>Ce qui reste : {stays.length > 0 ? stays.join(' ; ') : 'aucune carte'}.</p>
        <p>
          Ce qui part :{' '}
          {dropped.length > 0
            ? plural(dropped.length, 'carte à acheter', 'cartes à acheter')
            : 'aucune carte'}
          .
        </p>
      </ConfirmDialog>
    </>
  )
}
