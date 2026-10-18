import { Badge, Banner, Button, IconButton, Kbd, Progress, useCommandPalette } from '@camply/ui'
import {
  ChartLine,
  Database,
  Grid3x3,
  House,
  Layers,
  Moon,
  Search,
  ShoppingCart,
  Sun,
  type IconProps,
} from '@camply/ui/icons'
import { useEffect, useRef, type ComponentType } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { Logo } from '@/components/Logo'
import { SiteCredits } from '@/components/SiteCredits'
import { shoppingUrl } from '@/lib/filters'
import { AccountMenu } from '@/components/AccountMenu'
import { AppSearch } from '@/components/AppSearch'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePokedex } from '@/hooks/usePokedex'
import { cx } from '@/lib/cx'
import { formatInteger, formatShare, today, unlockedOf } from '@/lib/format'
import { latePendingOrders } from '@/lib/orders'
import { useStorageFailure } from '@/store/persist'
import { useShoppingStore } from '@/store/shopping'
import { toggleTheme, useThemeStore } from '@/store/theme'
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
      { to: shoppingUrl(), label: 'Achats', icon: ShoppingCart },
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

/** L'action de l'avertissement du stockage : la section Exporter des Données. */
const exportAction = (
  <Button asChild size="sm" variant="soft">
    <Link to="/donnees#exporter">Exporter</Link>
  </Button>
)

/**
 * Passer à l'autre thème (sombre, clair) : une ligne de la barre latérale, ou l'icône seule dans
 * la barre du haut (`compact`).
 */
function ThemeButton({ compact = false }: { compact?: boolean }) {
  const theme = useThemeStore((state) => state.theme)
  const label = theme === 'dark' ? 'Thème clair' : 'Thème sombre'
  const Icon = theme === 'dark' ? Sun : Moon
  if (compact) {
    return (
      <IconButton label={label} variant="ghost" onClick={toggleTheme}>
        <Icon size={18} />
      </IconButton>
    )
  }
  return (
    <button type="button" className={cx(styles.sideLink, styles.sideButton)} onClick={toggleTheme}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

/** Le logo et le nom ; sur un petit téléphone, « Mon » puis le nom s'effacent (le nom reste lu). */
function Brand() {
  return (
    <Link to="/" className={styles.brand}>
      <Logo>
        <span className={styles.brandName}>
          <span className={styles.brandMine}>Mon </span>Pokédex
        </span>
      </Logo>
    </Link>
  )
}

/**
 * La coquille de toutes les pages. Grand écran : une barre latérale (recherche, navigation par
 * groupes, progression, données, thème et compte). Tablette et téléphone : une barre en haut
 * (recherche, données, thème, compte) et une barre d'onglets en bas. Partout : la recherche
 * (Ctrl K), le lien d'évitement, les avertissements de l'app, le pied de page, le focus et le
 * défilement à chaque changement de page.
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
          <Kbd size="sm" className="shortcut">
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
          <ThemeButton />
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
            <ThemeButton compact />
            {!wide && <AccountMenu compact />}
          </div>
        </header>

        {storageFailed && (
          <div className={cx('container', styles.notice)}>
            <Banner tone="warn" action={exportAction}>
              Le navigateur n’enregistre plus vos modifications (stockage plein ou bloqué) : elles
              seront perdues en fermant la page. Exportez votre collection pour les garder.
            </Banner>
          </div>
        )}

        <main id="main" ref={main} tabIndex={-1} className={styles.main}>
          {/* Une clé par adresse : chaque page (et chaque fiche) repart d'un état neuf. */}
          <div key={pathname} className={styles.page}>
            <Outlet />
          </div>
        </main>

        <footer className={cx('container', styles.footer)}>
          <SiteCredits />
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
            <LateBadge to={to} className={styles.tabBadge} />
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

/**
 * Les commandes en retard, sur le lien des achats (barre latérale et barre d'onglets) : rien
 * ailleurs, ni sans retard.
 */
function LateBadge({ to, className }: { to: string; className?: string }) {
  const late = useShoppingStore((state) =>
    to === shoppingUrl() ? latePendingOrders(state.shopping.orders, today()).length : 0,
  )
  if (late === 0) return null
  return (
    <Badge size="sm" tone="warn" className={className}>
      {formatInteger(late)}
      <span className="visually-hidden"> en retard</span>
    </Badge>
  )
}

/** Un lien de la barre latérale ; les achats signalent les commandes en retard. */
function SideLink({ place, pathname }: { place: Place; pathname: string }) {
  const { to, label, icon: Icon } = place
  return (
    <Link
      to={to}
      className={styles.sideLink}
      aria-current={isCurrent(to, pathname) ? 'page' : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <LateBadge to={to} className={styles.sideBadge} />
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
        <span className="numeric">{formatShare(progress.percent)}</span>
      </span>
      <Progress size="sm" value={progress.percent} aria-hidden />
      <span className={cx(styles.progressCount, 'numeric')}>{unlockedOf(progress)}</span>
    </Link>
  )
}
