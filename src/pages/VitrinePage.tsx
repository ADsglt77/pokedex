import { Button, EmptyState, SegmentedControl, Skeleton, Stat } from '@camply/ui'
import { CircleDashed, House, Lock, LogIn, UserPlus } from '@camply/ui/icons'
import { Suspense, use, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChartPeriodControl } from '@/components/ChartParts'
import { FavoritesFan } from '@/components/FavoritesFan'
import { Panel } from '@/components/Panel'
import { PokedexGrid } from '@/components/PokedexGrid'
import { RegionProgress } from '@/components/RegionProgress'
import { SeriesGrid } from '@/components/SeriesGrid'
import { SeriesLine } from '@/components/SeriesLine'
import { StandalonePage } from '@/components/StandalonePage'
import { Unavailable } from '@/components/Unavailable'
import { UnlockedChart } from '@/components/UnlockedChart'
import { usePokedexGrid } from '@/hooks/usePokedexGrid'
import { useRetry } from '@/hooks/useRetry'
import { SUMMARY_STAT } from '@/hooks/useStatSize'
import { isPseudo } from '@/lib/account'
import { requestFailed } from '@/lib/api'
import type { ChartPeriod } from '@/lib/chart'
import { vitrineUrl } from '@/lib/filters'
import {
  formatDate,
  formatEuro,
  formatInteger,
  formatShare,
  pageTitle,
  pokedexTitle,
  unlockedOf,
} from '@/lib/format'
import {
  buildPokedex,
  unlockEvents,
  type GenerationProgress,
  type PokedexEntry,
} from '@/lib/pokedex'
import { tallyByStatus, trackedCards } from '@/lib/prices'
import { seriesId, seriesProgress } from '@/lib/series'
import { NotFound } from '@/pages/NotFoundPage'
import { loadVitrine, useAccountStore } from '@/store/account'
import type { CollectionData, PriceFile, SeriesCollection, VitrineData } from '@/types'
import styles from './VitrinePage.module.css'

/**
 * `/pseudo` : le Pokédex public d'un compte, toujours montré ; en lecture seule, hors de la
 * coquille : la progression, la valeur au prix du jour, la courbe des Pokémon débloqués, le
 * classeur, puis les collections d'extensions (leur progression, leur valeur et toutes leurs
 * cartes, `SeriesGrid`), d'après ce que le serveur montre (`worker/vitrine.ts`). En tête, « Se
 * connecter » et « Créer un compte », ou, connecté, « Mon Pokédex ». Toute adresse d'un seul
 * segment qui n'est pas une page du site y mène : un pseudo inconnu, ou ce qui n'en est pas un
 * (`/achat`), est la page introuvable (`NotFound`, celle de la coquille). Sans réponse du serveur,
 * « Réessayer ». Pas proposé aux moteurs de recherche.
 */
export function VitrinePage() {
  const signedIn = useAccountStore((state) => state.account !== null)
  const pseudo = useParams().pseudo!
  return (
    <StandalonePage
      actions={
        signedIn ? (
          <Button asChild size="sm" variant="secondary" leftIcon={<House size={16} />}>
            <Link to="/">Mon Pokédex</Link>
          </Button>
        ) : (
          <div className={styles.actions}>
            <Button asChild size="sm" variant="ghost" leftIcon={<LogIn size={16} />}>
              <Link to="/connexion">Se connecter</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" leftIcon={<UserPlus size={16} />}>
              <Link to="/inscription">Créer un compte</Link>
            </Button>
          </div>
        )
      }
    >
      <meta name="robots" content="noindex" />
      {isPseudo(pseudo) ? (
        <Suspense fallback={<VitrineSkeleton />}>
          <VitrineContent key={pseudo} pseudo={pseudo} />
        </Suspense>
      ) : (
        <NotFound pseudo />
      )}
    </StandalonePage>
  )
}

/** L'ébauche de la page tant qu'elle arrive, à la taille de ce qui vient : la page ne saute pas. */
function VitrineSkeleton() {
  return (
    <div className={styles.layout}>
      <p className="visually-hidden">Chargement du Pokédex…</p>
      <div className={styles.intro}>
        <Skeleton variant="rect" className={styles.fanSkeleton} />
        <div className={styles.headline}>
          <Skeleton className={styles.titleSkeleton} />
          <Skeleton width="min(26rem, 100%)" />
        </div>
      </div>
      <Skeleton variant="rect" className={styles.statSkeleton} />
      <Skeleton variant="rect" height="9rem" />
      <Skeleton variant="rect" height="20rem" />
    </div>
  )
}

function VitrineContent({ pseudo }: { pseudo: string }) {
  const retry = useRetry(vitrineUrl(pseudo))
  const shown = use(loadVitrine(pseudo))
  if (shown) return <Vitrine {...shown} />
  if (!requestFailed(vitrineUrl(pseudo))) return <NotFound pseudo />
  return (
    <>
      <title>{pageTitle('Pokédex public')}</title>
      <h1 className="visually-hidden">Pokédex public</h1>
      <Unavailable headingLevel={2} title="Le Pokédex ne peut pas s’afficher" retry={retry} />
    </>
  )
}

type Shown = 'all' | 'unlocked' | 'wanted'

/** Un Pokémon à obtenir : une carte choisie, aucune obtenue. L'objectif. */
const isWanted = (entry: PokedexEntry) => entry.card !== null && !entry.unlocked

/**
 * `owner` : le pseudo du compte, pour « Le Pokédex de … » ; `prices` : ceux de ses cartes
 * possédées, envoyés avec elles (sans prix, la valeur est « — »).
 */
function Vitrine({ owner, collection, prices }: VitrineData) {
  const heading = pokedexTitle(owner)
  const { entries, progress, generations } = useMemo(() => buildPokedex(collection), [collection])
  const owned = useMemo(
    () => tallyByStatus(trackedCards(collection, prices)).owned,
    [collection, prices],
  )
  const unlocks = useMemo(() => unlockEvents(collection), [collection])
  const [period, setPeriod] = useState<ChartPeriod>('month')
  const wanted = entries.filter(isWanted).length
  const updated = formatDate(collection.updatedAt)

  return (
    <div className={styles.layout}>
      <div className={styles.intro}>
        {/* Ses favorites en éventail plutôt qu'un anneau de pourcentage (D-07) : le sujet, ce sont
            les cartes ; le pourcentage est dans la phrase. */}
        <div className={styles.fan}>
          <FavoritesFan entries={entries} eager />
        </div>
        <div className={styles.headline}>
          <title>{pageTitle(heading)}</title>
          <h1 className={styles.title}>{heading}</h1>
          <p className="muted">
            {unlockedOf(progress, 'Pokémon')} ({formatShare(progress.percent)}).
            {updated && ` Mis à jour le ${updated}.`}
            {collection.series.length > 0 && (
              // Le classeur compte plus de 1 000 pochettes : les collections sont loin sous lui.
              <>
                {' '}
                <a href="#collections">Voir ses collections</a>.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="stat-line">
        <Stat
          {...SUMMARY_STAT}
          label="Pokémon débloqués"
          value={formatInteger(progress.unlocked)}
          hint={`sur ${formatInteger(progress.total)}`}
        />
        <Stat
          {...SUMMARY_STAT}
          label="Valeur de la collection"
          value={prices ? formatEuro(owned.value) : '—'}
          hint="au prix Cardmarket du jour"
        />
        <Stat
          {...SUMMARY_STAT}
          label="Pokémon à obtenir"
          value={formatInteger(wanted)}
          hint="une carte choisie, aucune obtenue"
        />
        <Stat
          {...SUMMARY_STAT}
          label="Régions complètes"
          value={formatInteger(generations.filter((row) => row.missing === 0).length)}
          hint={`sur ${formatInteger(generations.length)}`}
        />
      </div>

      <Panel title="Par région">
        <RegionProgress generations={generations} linked={false} />
      </Panel>

      <Panel
        title="Progression"
        description="Les Pokémon débloqués, jour après jour."
        // Sans courbe, pas de période à choisir.
        actions={unlocks.length > 0 && <ChartPeriodControl value={period} onChange={setPeriod} />}
      >
        <UnlockedChart events={unlocks} period={period} />
      </Panel>

      <VitrineBinder
        entries={entries}
        generations={generations}
        unlocked={progress.unlocked}
        wanted={wanted}
      />

      {collection.series.length > 0 && (
        <section className={styles.binder} aria-labelledby="collections">
          <h2 id="collections">Collections</h2>
          <div className={styles.collections}>
            {collection.series.map((series) => (
              <VitrineSeries
                key={seriesId(series)}
                collection={collection}
                series={series}
                prices={prices}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * Le classeur du Pokédex public : tous ses Pokémon, ou seulement les débloqués ou ceux à obtenir
 * (`shown`). Un composant à part : ce choix ne redessine que lui, pas les statistiques, la courbe
 * ni les collections.
 */
function VitrineBinder({
  entries,
  generations,
  unlocked,
  wanted,
}: {
  entries: PokedexEntry[]
  generations: GenerationProgress[]
  unlocked: number
  wanted: number
}) {
  const [shown, setShown] = useState<Shown>('all')
  const visible = useMemo(
    () =>
      shown === 'all'
        ? entries
        : entries.filter(shown === 'unlocked' ? (entry) => entry.unlocked : isWanted),
    [entries, shown],
  )
  // Toutes les pochettes ; le choix des Pokémon montrés masque les autres.
  const grid = usePokedexGrid(entries, visible)
  return (
    <section className={styles.binder} aria-labelledby="classeur">
      <div className={styles.binderHead}>
        <h2 id="classeur">Le classeur</h2>
        <SegmentedControl
          aria-label="Pokémon montrés"
          size="sm"
          options={[
            { value: 'all', label: 'Tous' },
            { value: 'unlocked', label: `Débloqués (${formatInteger(unlocked)})` },
            { value: 'wanted', label: `À obtenir (${formatInteger(wanted)})` },
          ]}
          value={shown}
          onChange={setShown}
        />
      </div>
      {/* Rien de montré : chaque génération est masquée, la grille reste. */}
      <PokedexGrid {...grid} generations={generations} linked={false} headingLevel={3} />
      {visible.length === 0 &&
        (shown === 'unlocked' ? (
          <EmptyState
            icon={<Lock size={22} />}
            title="Aucun Pokémon débloqué pour l’instant"
            description="Un Pokémon est débloqué dès qu’une de ses cartes est possédée."
            actions={<Button onClick={() => setShown('all')}>Voir tous les Pokémon</Button>}
          />
        ) : (
          <EmptyState
            icon={<CircleDashed size={22} />}
            title="Aucun Pokémon à obtenir"
            description="Les Pokémon dont une carte est choisie, aucune obtenue, apparaissent ici."
            actions={<Button onClick={() => setShown('all')}>Voir tous les Pokémon</Button>}
          />
        ))}
    </section>
  )
}

/**
 * Une collection d'extension : sa ligne (`SeriesLine`, son nom pour titre), ses cartes possédées
 * et leur valeur au prix du jour (« — » sans prix), puis toutes ses cartes en lecture seule. Jamais
 * ce qu'il faudrait pour la compléter : le Pokédex public ne dit rien des achats.
 */
function VitrineSeries({
  collection,
  series,
  prices,
}: {
  collection: CollectionData
  series: SeriesCollection
  prices: PriceFile | null
}) {
  const { owned, total, value } = seriesProgress(collection, series, prices)
  return (
    <div className={styles.series}>
      <SeriesLine series={series} owned={owned} total={total} heading>
        <span>
          <span className="muted">Valeur </span>
          <span className="numeric">{prices ? formatEuro(value) : '—'}</span>
        </span>
      </SeriesLine>
      <SeriesGrid collection={collection} series={series} linked={false} />
    </div>
  )
}
