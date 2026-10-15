import { Badge, Banner, Button, IconButton, Kbd, Progress, useCommandPalette } from '@camply/ui'
import {
  ChartLine,
  Database,
  Grid3x3,
  House,
  Layers,
  Search,
  ShoppingCart,
  type IconProps,
} from '@camply/ui/icons'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { AccountMenu } from '@/components/AccountMenu'
import { AppSearch } from '@/components/AppSearch'
import { ExternalLink } from '@/components/ExternalLink'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePokedex } from '@/hooks/usePokedex'
import { POKECARDEX } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import { formatDecimal, formatInteger, today } from '@/lib/format'
import { latePendingOrders } from '@/lib/orders'
import { DAY } from '@/lib/time'
import { useCollectionStore } from '@/store/collection'
import { useLastExport, useStorageFailure } from '@/store/persist'
import { useShoppingStore } from '@/store/shopping'
import { useSyncStore } from '@/store/sync'
import styles from './AppShell.module.css'

interface Place {
  to: string
  label: string
  icon: ComponentType<IconProps>
}

/** La navigation, par usage : la collection, puis ce qui coûte. Données est à part (réglages). */
const GROUPS: { label: string; places: Place[] }[] = [
  {
    label: 'Collection',
    places: [
      { to: '/', label: 'Accueil', icon: House },
      { to: '/pokedex', label: 'Pokédex', icon: Grid3x3 },
      { to: '/catalogue', label: 'Catalogue', icon: Layers },
    ],
  },
  {
    label: 'Achats et valeur',
    places: [
      { to: '/achats', label: 'Achats', icon: ShoppingCart },
      { to: '/valeur', label: 'Valeur', icon: ChartLine },
    ],
  },
]
const DATA: Place = { to: '/donnees', label: 'Données', icon: Database }
/** La barre d'onglets du téléphone : cinq au plus, Données passe dans la barre du haut. */
const TABS = GROUPS.flatMap((group) => group.places)

/** La page ouverte : la fiche d'un Pokémon fait partie du Pokédex. */
const isCurrent = (to: string, path: string) =>
  to === '/'
    ? path === '/'
    : path.startsWith(to) || (to === '/pokedex' && path.startsWith('/pokemon'))

/** Ctrl K, ou ⌘ K sur un Mac. */
const SEARCH_KEYS = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K'

/** L'action des avertissements de l'app (stockage, sauvegarde) : la section Exporter des Données. */
const exportAction = (
  <Button asChild size="sm" variant="soft">
    <Link to="/donnees#exporter">Exporter</Link>
  </Button>
)

/**
 * Le logo : un Pokédex. Boîtier rouge, grande lentille bleue cerclée de blanc, trois voyants
 * (rouge, jaune, vert), charnière et écran. Le même dessin sert d'icône d'onglet
 * (`public/favicon.svg`).
 */
function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={styles.logo}>
      <rect x="1" y="1" width="30" height="30" rx="8" className={styles.logoShell} />
      <path d="M1 21.5h30" className={styles.logoHinge} />
      <circle cx="10.5" cy="11" r="6.75" className={styles.logoRing} />
      <circle cx="10.5" cy="11" r="4.75" className={styles.logoLens} />
      <circle cx="8.9" cy="9.4" r="1.5" className={styles.logoGlint} />
      <circle cx="19.5" cy="7.5" r="1.5" className={cx(styles.logoLed, styles.logoLedRed)} />
      <circle cx="23.25" cy="7.5" r="1.5" className={cx(styles.logoLed, styles.logoLedYellow)} />
      <circle cx="27" cy="7.5" r="1.5" className={cx(styles.logoLed, styles.logoLedGreen)} />
      <rect x="6" y="24.5" width="20" height="3.5" rx="1.5" className={styles.logoScreen} />
    </svg>
  )
}

function Brand() {
  return (
    <Link to="/" className={styles.brand}>
      <Logo />
      <span>
        <span className={styles.brandMine}>Mon</span> Pokédex
      </span>
    </Link>
  )
}

/**
 * La coquille de toutes les pages. Grand écran : une barre latérale (recherche, navigation par
 * groupes, progression, données et compte). Tablette et téléphone : une barre en haut (recherche,
 * données, compte) et une barre d'onglets en bas. Partout : la recherche (Ctrl K), le lien
 * d'évitement, les avertissements de l'app, le pied de page, le focus et le défilement à chaque
 * changement de page.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const storageFailed = useStorageFailure((state) => state.failed)
  const main = useRef<HTMLElement>(null)
  const shownPath = useRef(pathname)
  const [searching, setSearching] = useCommandPalette()
  // Le compte n'existe qu'une fois (il suit la session et ouvre la question d'un conflit) : dans
  // la barre latérale ou dans la barre du haut.
  const wide = useMediaQuery('(min-width: 64rem)')

  // À chaque nouvelle page, le focus va au contenu (lecteurs d'écran, navigation au clavier).
  useEffect(() => {
    if (shownPath.current === pathname) return
    shownPath.current = pathname
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  const search = () => setSearching(true)

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Aller au contenu
      </a>

      <aside className={styles.sidebar} aria-label="Barre latérale">
        <Brand />
        <button type="button" className={styles.searchField} onClick={search}>
          <Search size={16} aria-hidden="true" />
          <span>Rechercher…</span>
          <Kbd size="sm" className={styles.searchKeys}>
            {SEARCH_KEYS}
          </Kbd>
        </button>
        <nav aria-label="Navigation principale" className={styles.sideNav}>
          {GROUPS.map((group) => (
            <div key={group.label} className={styles.group}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.places.map((place) => (
                <SideLink key={place.to} place={place} pathname={pathname} />
              ))}
            </div>
          ))}
        </nav>
        <ProgressCard />
        <div className={styles.sideFoot}>
          <SideLink place={DATA} pathname={pathname} />
          {wide && <AccountMenu />}
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <Brand />
          <div className={styles.topActions}>
            <IconButton label="Rechercher" variant="ghost" onClick={search}>
              <Search size={18} />
            </IconButton>
            <IconButton
              asChild
              label="Données et sauvegarde"
              variant={isCurrent(DATA.to, pathname) ? 'soft' : 'ghost'}
            >
              <Link to={DATA.to} aria-current={isCurrent(DATA.to, pathname) ? 'page' : undefined}>
                <Database size={18} />
              </Link>
            </IconButton>
            {!wide && <AccountMenu compact />}
          </div>
        </header>

        {storageFailed ? (
          <div className={cx('container', styles.notice)}>
            <Banner tone="warn" action={exportAction}>
              Le navigateur n’enregistre plus vos modifications (stockage plein ou bloqué) : elles
              seront perdues en fermant la page. Exportez votre collection pour les garder.
            </Banner>
          </div>
        ) : (
          <BackupReminder />
        )}

        <main id="main" ref={main} tabIndex={-1} className={styles.main}>
          {/* Une clé par adresse : chaque page (et chaque fiche) repart d'un état neuf. */}
          <div key={pathname} className={styles.page}>
            <Outlet />
          </div>
        </main>

        <footer className={cx('container', styles.footer)}>
          Espèces PokéAPI, cartes et images{' '}
          <ExternalLink href={POKECARDEX}>Pokécardex</ExternalLink>, prix Cardmarket. Projet
          personnel, sans lien avec Nintendo, Creatures, Game Freak ou The Pokémon Company.
        </footer>
      </div>

      <nav aria-label="Navigation principale" className={styles.tabbar}>
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={styles.tab}
            aria-current={isCurrent(to, pathname) ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <AppSearch open={searching} onClose={() => setSearching(false)} />

      <ScrollRestoration
        // Revenir au Pokédex avec les mêmes filtres, même par un lien, retrouve la position.
        getKey={(location) =>
          location.pathname === '/pokedex' ? location.pathname + location.search : location.key
        }
      />
    </div>
  )
}

/** Un lien de la barre latérale ; les achats signalent les commandes en retard. */
function SideLink({ place, pathname }: { place: Place; pathname: string }) {
  const { to, label, icon: Icon } = place
  const late = useShoppingStore((state) =>
    to === '/achats' ? latePendingOrders(state.shopping.orders, today()).length : 0,
  )
  return (
    <Link
      to={to}
      className={styles.sideLink}
      aria-current={isCurrent(to, pathname) ? 'page' : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      {late > 0 && (
        <Badge size="sm" tone="warn" className={styles.sideBadge}>
          {formatInteger(late)}
          <span className="visually-hidden"> en retard</span>
        </Badge>
      )}
    </Link>
  )
}

/** La progression, toujours sous les yeux : ce qui est débloqué sur 1 025, vers le Pokédex. */
function ProgressCard() {
  const { progress } = usePokedex()
  return (
    <Link to="/pokedex" className={styles.progressCard}>
      <span className={styles.progressHead}>
        <span>Progression</span>
        <span className="numeric">{formatDecimal(progress.percent)} %</span>
      </span>
      <Progress size="sm" value={progress.percent} aria-hidden />
      <span className={cx(styles.progressCount, 'numeric')}>
        {formatInteger(progress.unlocked)} débloqués sur {formatInteger(progress.total)}
      </span>
    </Link>
  )
}

/**
 * Le rappel de sauvegarde, sans compte connecté : la collection n'existe que dans ce navigateur
 * (connecté, elle est sur le serveur, sauvegardé). Il paraît quand elle a changé depuis le dernier
 * export et que celui-ci date d'un mois, ou, sans export, dès 5 cartes. Fermé, il revient au
 * prochain chargement.
 */
function BackupReminder() {
  const synced = useSyncStore((state) => state.status !== 'local')
  const lastExport = useLastExport((state) => state.at)
  const collection = useCollectionStore((state) => state.collection)
  const [now] = useState(() => Date.now())
  const last = lastExport ? Date.parse(lastExport) : NaN
  const changed = collection.updatedAt !== null && !(Date.parse(collection.updatedAt) <= last)
  const due = Number.isNaN(last)
    ? Object.keys(collection.customCards).length >= 5
    : now - last > 30 * DAY
  if (synced || !changed || !due) return null
  return (
    <div className={cx('container', styles.notice)}>
      <Banner tone="info" dismissible action={exportAction}>
        {Number.isNaN(last)
          ? 'Votre collection n’existe que dans ce navigateur : exportez-la pour en garder une copie.'
          : 'Votre dernier export date de plus d’un mois, et votre collection a changé depuis.'}
      </Banner>
    </div>
  )
}
