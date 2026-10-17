import { Button, EmptyState, RadialProgress, SegmentedControl, Stat } from '@camply/ui'
import { CloudOff, Flag, House, Layers, LogIn, Wallet } from '@camply/ui/icons'
import { Suspense, use, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChartPeriodControl } from '@/components/ChartParts'
import { Logo } from '@/components/Logo'
import { Panel } from '@/components/Panel'
import { PokedexGrid } from '@/components/PokedexGrid'
import { ProgressRuler } from '@/components/ProgressRuler'
import { RegionList } from '@/components/RegionList'
import { SiteCredits } from '@/components/SiteCredits'
import { STATUS_ICONS } from '@/components/statusIcons'
import { UnlockedChart } from '@/components/UnlockedChart'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getJson } from '@/lib/api'
import type { ChartPeriod } from '@/lib/chart'
import { cx } from '@/lib/cx'
import {
  formatDate,
  formatEuro,
  formatInteger,
  formatShare,
  pageTitle,
  pokedexTitle,
  today,
  unlockedOf,
} from '@/lib/format'
import { buildPokedex, unlockEvents, type PokedexEntry } from '@/lib/pokedex'
import { tallyByStatus, trackedCards } from '@/lib/prices'
import { useSyncStore } from '@/store/sync'
import type { VitrineData } from '@/types'
import styles from './VitrinePage.module.css'

/**
 * `/vitrine` : le Pokédex public, toujours montré, la page d'accueil d'un visiteur ; en lecture
 * seule, hors de la coquille : la progression, la valeur au prix du jour, la courbe des Pokémon
 * débloqués et le classeur, d'après ce que le serveur montre (`server/vitrine.ts`). En tête, « Se
 * connecter », ou, connecté, « Mon Pokédex ». Pas proposé aux moteurs de recherche.
 */
export function VitrinePage() {
  const signedIn = useSyncStore((state) => state.account !== null)
  return (
    <div className={cx('container', styles.page)}>
      <meta name="robots" content="noindex" />
      <header className={styles.header}>
        <Logo>Pokédex</Logo>
        {signedIn ? (
          <Button asChild size="sm" variant="secondary" leftIcon={<House size={16} />}>
            <Link to="/">Mon Pokédex</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="ghost" leftIcon={<LogIn size={16} />}>
            <Link to="/connexion">Se connecter</Link>
          </Button>
        )}
      </header>
      <main className={styles.main}>
        <Suspense fallback={<p className="muted">Chargement du Pokédex…</p>}>
          <VitrineContent />
        </Suspense>
      </main>
      <footer className={styles.footer}>
        <SiteCredits />
      </footer>
    </div>
  )
}

function VitrineContent() {
  const shown = use(getJson<VitrineData>('/api/vitrine'))
  if (!shown) {
    // camply n'offre pas de titre `h1` à `EmptyState` : celui de la page, pour les lecteurs d'écran.
    return (
      <>
        <title>{pageTitle('Pokédex public')}</title>
        <h1 className="visually-hidden">Pokédex public</h1>
        <EmptyState
          headingLevel={2}
          icon={<CloudOff size={22} />}
          title="Le Pokédex ne peut pas s’afficher"
          description="Le serveur ne répond pas pour le moment : réessayez dans un instant."
        />
      </>
    )
  }
  return <Vitrine {...shown} />
}

type Shown = 'all' | 'unlocked' | 'chosen'

/** Une carte choisie, pas encore obtenue : l'objectif. */
const isChosen = (entry: PokedexEntry) => entry.card !== null && !entry.unlocked

/**
 * `owner` : le pseudo du compte, pour « Le Pokédex de … » ; `prices` : ceux de ses cartes
 * possédées, envoyés avec elles (sans prix, la valeur est « — »).
 */
function Vitrine({ owner, collection, prices }: VitrineData) {
  const heading = owner ? pokedexTitle(owner) : 'Un Pokédex de cartes japonaises'
  const { entries, progress, generations } = useMemo(() => buildPokedex(collection), [collection])
  const owned = useMemo(
    () => tallyByStatus(trackedCards(collection, prices)).owned,
    [collection, prices],
  )
  const unlocks = useMemo(() => unlockEvents(collection), [collection])
  const [period, setPeriod] = useState<ChartPeriod>('month')
  const [shown, setShown] = useState<Shown>('all')
  // Sur téléphone, la réglette n'est qu'une image : la liste des régions la remplace.
  const narrow = useMediaQuery('(max-width: 40rem)')
  const chosen = entries.filter(isChosen).length
  const visible =
    shown === 'all'
      ? entries
      : entries.filter(shown === 'unlocked' ? (entry) => entry.unlocked : isChosen)
  const updated = formatDate(collection.updatedAt)

  return (
    <div className={styles.layout}>
      <div className={styles.intro}>
        <RadialProgress
          value={progress.percent}
          size={112}
          thickness={9}
          label="Pokémon débloqués"
          aria-valuetext={unlockedOf(progress)}
        >
          <span className={cx(styles.ring, 'numeric')}>{formatShare(progress.percent)}</span>
        </RadialProgress>
        <div>
          <title>{heading}</title>
          <h1 className={styles.title}>{heading}</h1>
          <p className="muted">
            Une carte par Pokémon : {unlockedOf(progress, 'Pokémon')}.
            {updated && ` Mis à jour le ${updated}.`}
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat
          label="Pokémon débloqués"
          icon={<STATUS_ICONS.owned size={18} />}
          value={formatInteger(progress.unlocked)}
          hint={`sur ${formatInteger(progress.total)}`}
        />
        <Stat
          label="Valeur de la collection"
          icon={<Wallet size={18} />}
          value={prices ? formatEuro(owned.value) : '—'}
          hint="au prix Cardmarket du jour"
        />
        <Stat
          label="Cartes choisies"
          icon={<Layers size={18} />}
          value={formatInteger(chosen)}
          hint="pas encore obtenues"
        />
        <Stat
          label="Régions complètes"
          icon={<Flag size={18} />}
          value={formatInteger(generations.filter((row) => row.missing === 0).length)}
          hint={`sur ${formatInteger(generations.length)}`}
        />
      </div>

      <Panel title="Par région">
        {narrow ? (
          <RegionList generations={generations} />
        ) : (
          <ProgressRuler generations={generations} linked={false} />
        )}
      </Panel>

      <Panel
        title="Progression"
        description="Les Pokémon débloqués, jour après jour."
        actions={<ChartPeriodControl value={period} onChange={setPeriod} />}
      >
        <UnlockedChart events={unlocks} period={period} day={today()} />
      </Panel>

      <section className={styles.binder} aria-labelledby="classeur">
        <div className={styles.binderHead}>
          <h2 id="classeur">Le classeur</h2>
          <SegmentedControl
            aria-label="Pokémon montrés"
            size="sm"
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'unlocked', label: `Débloqués (${formatInteger(progress.unlocked)})` },
              { value: 'chosen', label: `Choisies (${formatInteger(chosen)})` },
            ]}
            value={shown}
            onChange={setShown}
          />
        </div>
        {visible.length > 0 ? (
          <PokedexGrid entries={visible} generations={generations} linked={false} />
        ) : (
          <p className="muted">Aucun Pokémon à montrer ici pour l’instant.</p>
        )}
      </section>
    </div>
  )
}
