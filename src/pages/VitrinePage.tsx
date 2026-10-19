import { Button, EmptyState, RadialProgress, SegmentedControl, Skeleton, Stat } from '@camply/ui'
import {
  CloudOff,
  Flag,
  House,
  Layers,
  Lock,
  LogIn,
  SearchX,
  UserPlus,
  Wallet,
} from '@camply/ui/icons'
import { Suspense, use, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChartPeriodControl } from '@/components/ChartParts'
import { Logo } from '@/components/Logo'
import { Panel } from '@/components/Panel'
import { PokedexGrid } from '@/components/PokedexGrid'
import { ProgressRuler } from '@/components/ProgressRuler'
import { RegionList } from '@/components/RegionList'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import { STATUS_ICONS } from '@/components/statusIcons'
import { UnlockedChart } from '@/components/UnlockedChart'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { getJson, requestFailed } from '@/lib/api'
import type { ChartPeriod } from '@/lib/chart'
import { cx } from '@/lib/cx'
import { vitrinePseudo } from '@/lib/filters'
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
import { useStatSize } from '@/hooks/useStatSize'

/**
 * `/@pseudo` : le Pokédex public d'un compte, toujours montré ; en lecture seule, hors de la
 * coquille : la progression, la valeur au prix du jour, la courbe des Pokémon débloqués et le
 * classeur, d'après ce que le serveur montre (`server/vitrine.ts`). En tête, « Se connecter » et
 * « Créer un compte », ou, connecté, « Mon Pokédex ». Une autre adresse d'un seul segment
 * (`/achat`), que le routeur y mène aussi : une page introuvable. Pas proposé aux moteurs de
 * recherche.
 */
export function VitrinePage() {
  const signedIn = useSyncStore((state) => state.account !== null)
  const pseudo = vitrinePseudo(useParams().handle!)
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
          <div className={styles.actions}>
            <Button asChild size="sm" variant="ghost" leftIcon={<LogIn size={16} />}>
              <Link to="/connexion">Se connecter</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" leftIcon={<UserPlus size={16} />}>
              <Link to="/inscription">Créer un compte</Link>
            </Button>
          </div>
        )}
      </header>
      <main className={styles.main}>
        {pseudo ? (
          <Suspense fallback={<VitrineSkeleton />}>
            <VitrineContent key={pseudo} pseudo={pseudo} />
          </Suspense>
        ) : (
          <Missing vitrine={false} />
        )}
      </main>
      <footer className={styles.footer}>
        <SiteDisclaimer />
      </footer>
    </div>
  )
}

/** L'ébauche de la page tant qu'elle arrive, à la taille de ce qui vient : la page ne saute pas. */
function VitrineSkeleton() {
  return (
    <div className={styles.layout}>
      <p className="visually-hidden">Chargement du Pokédex…</p>
      <div className={styles.intro}>
        <Skeleton variant="circle" width={112} height={112} />
        <div className={styles.headline}>
          <Skeleton className={styles.titleSkeleton} />
          <Skeleton width="min(26rem, 100%)" />
        </div>
      </div>
      <div className="stat-grid">
        {['unlocked', 'value', 'chosen', 'regions'].map((stat) => (
          <Skeleton key={stat} variant="rect" className={styles.statSkeleton} />
        ))}
      </div>
      <Skeleton variant="rect" height="9rem" />
      <Skeleton variant="rect" height="20rem" />
    </div>
  )
}

/**
 * Une adresse sans Pokédex (`vitrine`) : un pseudo qui n'est à personne (ou plus : compte
 * supprimé, pseudo changé) ; sinon une autre page inconnue. camply n'offre pas de titre `h1` à
 * `EmptyState` : celui de la page, pour les lecteurs d'écran.
 */
function Missing({ vitrine }: { vitrine: boolean }) {
  return (
    <>
      <title>{pageTitle('Page introuvable')}</title>
      <h1 className="visually-hidden">Page introuvable</h1>
      <EmptyState
        headingLevel={2}
        icon={<SearchX size={22} />}
        title={vitrine ? 'Aucun Pokédex à cette adresse' : 'Cette page n’existe pas'}
        description={
          vitrine
            ? 'Vérifiez le pseudo : il a pu changer, ou le compte être supprimé.'
            : 'L’adresse ne correspond à aucune page du site.'
        }
        actions={
          <Button asChild>
            <Link to="/">Revenir à l’accueil</Link>
          </Button>
        }
      />
    </>
  )
}

function VitrineContent({ pseudo }: { pseudo: string }) {
  const url = `/api/vitrine/${pseudo}`
  const shown = use(getJson<VitrineData>(url))
  if (shown) return <Vitrine {...shown} />
  if (!requestFailed(url)) return <Missing vitrine />
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

type Shown = 'all' | 'unlocked' | 'chosen'

/** Une carte choisie, pas encore obtenue : l'objectif. */
const isChosen = (entry: PokedexEntry) => entry.card !== null && !entry.unlocked

/**
 * `owner` : le pseudo du compte, pour « Le Pokédex de … » ; `prices` : ceux de ses cartes
 * possédées, envoyés avec elles (sans prix, la valeur est « — »).
 */
function Vitrine({ owner, collection, prices }: VitrineData) {
  const statSize = useStatSize()
  const heading = pokedexTitle(owner)
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
        <div className={styles.headline}>
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
          size={statSize}
          label="Pokémon débloqués"
          icon={<STATUS_ICONS.owned size={18} />}
          value={formatInteger(progress.unlocked)}
          hint={`sur ${formatInteger(progress.total)}`}
        />
        <Stat
          size={statSize}
          label="Valeur de la collection"
          icon={<Wallet size={18} />}
          value={prices ? formatEuro(owned.value) : '—'}
          hint="au prix Cardmarket du jour"
        />
        <Stat
          size={statSize}
          label="Cartes choisies"
          icon={<Layers size={18} />}
          value={formatInteger(chosen)}
          hint="pas encore obtenues"
        />
        <Stat
          size={statSize}
          label="Régions complètes"
          icon={<Flag size={18} />}
          value={formatInteger(generations.filter((row) => row.missing === 0).length)}
          hint={`sur ${formatInteger(generations.length)}`}
        />
      </div>

      <Panel title="Par région">
        {narrow ? (
          <RegionList generations={generations} linked={false} />
        ) : (
          <ProgressRuler generations={generations} linked={false} />
        )}
      </Panel>

      <Panel
        title="Progression"
        description="Les Pokémon débloqués, jour après jour."
        // Sans courbe, pas de période à choisir.
        actions={unlocks.length > 0 && <ChartPeriodControl value={period} onChange={setPeriod} />}
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
          <PokedexGrid
            entries={visible}
            generations={generations}
            linked={false}
            headingLevel={3}
          />
        ) : shown === 'unlocked' ? (
          <EmptyState
            icon={<Lock size={22} />}
            title="Aucun Pokémon débloqué pour l’instant"
            description="Un Pokémon est débloqué quand sa carte est possédée."
            actions={<Button onClick={() => setShown('all')}>Voir tous les Pokémon</Button>}
          />
        ) : (
          <EmptyState
            icon={<Layers size={22} />}
            title="Aucune carte choisie à obtenir"
            description="Les cartes choisies, pas encore obtenues, apparaissent ici."
            actions={<Button onClick={() => setShown('all')}>Voir tous les Pokémon</Button>}
          />
        )}
      </section>
    </div>
  )
}
