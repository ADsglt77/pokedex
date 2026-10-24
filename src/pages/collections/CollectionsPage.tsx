import { Card, Progress } from '@camply/ui'
import { Grid3x3, Plus } from '@camply/ui/icons'
import type { ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { PageHeader } from '@/components/PageHeader'
import { PricedValue } from '@/components/PricedValue'
import { ProgressCount } from '@/components/ProgressCount'
import { SetLogo } from '@/components/SetLogo'
import { SetPicker } from '@/components/SetPicker'
import { usePokedex } from '@/hooks/usePokedex'
import { useStartCollection } from '@/hooks/useStartCollection'
import type { SetSummary } from '@/lib/card-catalog'
import { cardLanguage } from '@/lib/collection'
import { cx } from '@/lib/cx'
import { catalogLanguage, catalogParams, seriesPath } from '@/lib/filters'
import { formatEuro, formatInteger, formatShare, pageTitle } from '@/lib/format'
import { progressPercent } from '@/lib/pokedex'
import { seriesId, seriesProgress } from '@/lib/series'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'
import type { SeriesCollection } from '@/types'
import styles from './CollectionsPage.module.css'

/**
 * Les Collections (`/collections`) : le Pokédex d'abord, toujours là, puis une tuile par collection
 * d'extension, dans l'ordre où elles ont été commencées (son drapeau, son logo et son nom, ses
 * cartes possédées sur toutes, leur valeur), chacune vers sa page. « Nouvelle collection » ouvre le
 * choix d'une extension (`SetPicker`, l'interrupteur de la langue en haut, dans l'adresse :
 * `?langue=fr`) : une extension commencée y est marquée « Commencée » et mène à sa page, une autre
 * y commence sa collection (`useStartCollection`).
 */
export function CollectionsPage() {
  const series = useCollectionStore((state) => state.collection.series)
  return (
    <div className="container">
      <title>{pageTitle('Collections')}</title>
      <PageHeader title="Collections" actions={<NewCollection series={series} />}>
        Le Pokédex, puis chaque extension que vous collectionnez en entier, en japonais ou en
        français : toutes ses cartes, à obtenir une à une.
      </PageHeader>
      <ul className={styles.tiles}>
        <PokedexTile />
        {series.map((one) => (
          <SeriesTile key={seriesId(one)} series={one} />
        ))}
      </ul>
    </div>
  )
}

/**
 * « Nouvelle collection » : le choix d'une extension, dans la langue de l'adresse (l'interrupteur
 * de la fenêtre la change). Une extension commencée mène à sa page ; une autre commence sa
 * collection, puis l'ouvre (le bouton attend ses cartes).
 */
function NewCollection({ series }: { series: SeriesCollection[] }) {
  const [params, setParams] = useSearchParams()
  const language = catalogLanguage(params)
  const navigate = useNavigate()
  const { startCollection, starting } = useStartCollection()
  const started = new Set(
    series.filter((one) => cardLanguage(one) === language).map((one) => one.set),
  )
  const pick = (set: SetSummary) => {
    if (started.has(set.id)) navigate(seriesPath(set.id, set.language))
    else void startCollection(set)
  }
  return (
    <SetPicker
      label="Nouvelle collection"
      icon={<Plus size={16} />}
      variant="primary"
      loading={starting}
      language={language}
      onLanguage={(next) => setParams(catalogParams(next), { replace: true })}
      started={started}
      onPick={pick}
    />
  )
}

/**
 * Une tuile : son image (le logo de l'extension, le dessin du Pokédex), son titre, lien de toute la
 * tuile, une ligne d'aide, la barre de progression, puis ses chiffres (`children`).
 */
function Tile({
  to,
  art,
  title,
  meta,
  percent,
  children,
}: {
  to: string
  art: ReactNode
  title: ReactNode
  meta: ReactNode
  percent: number
  children: ReactNode
}) {
  return (
    <Card as="li" interactive padding="none" className={styles.tile}>
      <div className={styles.art}>{art}</div>
      <h2 className={styles.title}>
        <Link to={to} className={cx('quiet-link', styles.link)}>
          {title}
        </Link>
      </h2>
      <p className={styles.meta}>{meta}</p>
      <Progress size="sm" value={percent} aria-hidden className={styles.bar} />
      <p className={styles.figures}>{children}</p>
    </Card>
  )
}

/** Le Pokédex, toujours en premier : ses Pokémon débloqués sur 1 025. */
function PokedexTile() {
  const { progress } = usePokedex()
  return (
    <Tile
      to="/pokedex"
      art={<Grid3x3 size={40} aria-hidden="true" />}
      title="Pokédex"
      meta={`Les ${formatInteger(progress.total)} Pokémon`}
      percent={progress.percent}
    >
      <ProgressCount done={progress.unlocked} total={progress.total} what="Pokémon débloqués" />
      <span className="numeric muted">{formatShare(progress.percent)}</span>
    </Tile>
  )
}

/**
 * Une collection d'extension : son logo (son code s'il n'y en a pas), son nom et le drapeau de sa
 * langue, ses cartes possédées sur toutes, leur valeur au prix du jour.
 */
function SeriesTile({ series }: { series: SeriesCollection }) {
  const collection = useCollectionStore((state) => state.collection)
  const prices = usePrices()
  const language = cardLanguage(series)
  const { owned, total, value } = seriesProgress(collection, series, prices)
  return (
    <Tile
      to={seriesPath(series.set, language)}
      art={
        <SetLogo set={{ language, id: series.set, logo: true }} size="md" className={styles.logo} />
      }
      title={
        <>
          {series.name}
          <LanguageFlag language={language} of="set" />
        </>
      }
      meta={series.set}
      percent={progressPercent(owned, total)}
    >
      <ProgressCount done={owned} total={total} what="cartes possédées" />
      <span>
        <span className="muted">Valeur </span>
        <span className="numeric">
          <PricedValue text>{formatEuro(value)}</PricedValue>
        </span>
      </span>
    </Tile>
  )
}
