import { Badge, IconButton, Kbd, Progress, useCommandPalette } from '@camply/ui'
import {
  ChartLine,
  Database,
  House,
  Layers,
  Library,
  Moon,
  Search,
  ShoppingCart,
  Sun,
  type IconProps,
} from '@camply/ui/icons'
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  Link,
  matchPath,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigation,
} from 'react-router'
import { Logo } from '@/components/Logo'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import { shoppingUrl } from '@/lib/filters'
import { AccountMenu } from '@/components/AccountMenu'
import { AppSearch } from '@/components/AppSearch'
import { returnedLink } from '@/hooks/useFollowLinks'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePokedex } from '@/hooks/usePokedex'
import { cx } from '@/lib/cx'
import { formatInteger, formatShare, today, unlockedOf } from '@/lib/format'
import { latePendingOrders } from '@/lib/orders'
import { useShoppingStore } from '@/store/shopping'
import { toggleTheme, useThemeStore } from '@/store/theme'
import styles from './AppShell.module.css'

interface Place {
  to: string
  label: string
  icon: ComponentType<IconProps>
}

/** Le lien des achats, qui seul signale les commandes en retard (`LateBadge`). */
const SHOPPING = shoppingUrl()

/** La navigation, par usage : la collection, puis ce qui coûte. Les réglages sont à part. */
const GROUPS: { label: string; places: Place[] }[] = [
  {
    label: 'Collection',
    places: [
      { to: '/', label: 'Accueil', icon: House },
      { to: '/collections', label: 'Collections', icon: Library },
      { to: '/catalogue', label: 'Catalogue', icon: Layers },
    ],
  },
  {
    label: 'Achats et valeur',
    places: [
      { to: SHOPPING, label: 'Achats', icon: ShoppingCart },
      { to: '/valeur', label: 'Valeur', icon: ChartLine },
    ],
  },
]
const DATA: Place = { to: '/donnees', label: 'Réglages', icon: Database }
/** La barre d'onglets du téléphone : cinq au plus, Réglages passe dans la barre du haut. */
const TABS = GROUPS.flatMap((group) => group.places)

/**
 * La page ouverte : le Pokédex (et la fiche d'un Pokémon, qui en fait partie) s'ouvre depuis les
 * Collections, comme la page d'une collection d'extension.
 */
const isCurrent = (to: string, path: string) =>
  to === '/'
    ? path === '/'
    : path.startsWith(to) || (to === '/collections' && /^\/(pokedex|pokemon)(\/|$)/.test(path))

/** Ctrl K, ou ⌘ K sur un Mac. */
const SEARCH_KEYS = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K'

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

/** Le logo et le nom du site ; sur un petit téléphone, le nom s'efface (il reste lu). */
function Brand() {
  return (
    <Link to="/" className={styles.brand}>
      <Logo>
        <span className={styles.brandName}>PokéCodex</span>
      </Logo>
    </Link>
  )
}

/**
 * La coquille de toutes les pages. Grand écran : une barre latérale (recherche, navigation par
 * groupes, progression, données, thème et compte). Tablette et téléphone : une barre en haut
 * (recherche, données, thème, compte) et une barre d'onglets en bas. Partout : la recherche
 * (Ctrl K), le lien d'évitement, le pied de page, le focus et le
 * défilement à chaque changement de page. Ne se redessine qu'en changeant de page : pas à chaque
 * frappe d'une recherche gardée dans l'adresse (`Shell`, mémoïsée sur le chemin).
 */
export function AppShell({ pokedex }: { pokedex: ReactNode }) {
  const { pathname } = useLocation()
  return <Shell pathname={pathname} pokedex={pokedex} />
}

const Shell = memo(function Shell({ pathname, pokedex }: { pathname: string; pokedex: ReactNode }) {
  const main = useRef<HTMLElement>(null)
  const shownPath = useRef(pathname)
  const [searching, setSearching] = useCommandPalette()
  // Le menu du compte n'existe qu'une fois : dans la barre latérale ou dans la barre du haut.
  const wide = useMediaQuery('(min-width: 64rem)')

  // À chaque nouvelle page, le focus va au contenu (lecteurs d'écran, navigation au clavier) ; de
  // retour sur la page d'un lien suivi (une pochette du Pokédex), à ce lien.
  useEffect(() => {
    if (shownPath.current === pathname) return
    shownPath.current = pathname
    const target = main.current && (returnedLink(main.current, pathname) ?? main.current)
    target?.focus({ preventScroll: true })
  }, [pathname])

  const search = () => setSearching(true)
  // Une fonction stable : la palette (mémoïsée, plus de 1 000 commandes) ne se redessine pas à
  // chaque changement de page. Montée à sa première ouverture seulement : ses commandes coûtaient
  // une soixantaine de millisecondes au premier affichage de l'app.
  const closeSearch = useCallback(() => setSearching(false), [setSearching])
  const [searchUsed, setSearchUsed] = useState(searching)
  if (searching && !searchUsed) setSearchUsed(true)
  // Le classeur, une fois ouvert, reste en vie, caché, pendant la visite des autres pages : y
  // revenir (d'une fiche, le plus souvent) le montre aussitôt, à la même position, sans refaire ses
  // 1 025 pochettes (200 à 400 ms sinon). Caché, il ne fait que suivre la collection, sans presser.
  const onPokedex = matchPath('/pokedex', pathname) !== null
  const [keepPokedex, setKeepPokedex] = useState(onPokedex)
  if (onPokedex && !keepPokedex) setKeepPokedex(true)

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Aller au contenu
      </a>
      <NavigationProgress />

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
              label="Réglages"
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

        <main id="main" ref={main} tabIndex={-1} className={styles.main}>
          {keepPokedex && (
            <Activity mode={onPokedex ? 'visible' : 'hidden'}>
              <div className={styles.page}>{pokedex}</div>
            </Activity>
          )}
          {/* Une clé par adresse : chaque page (et chaque fiche) repart d'un état neuf. */}
          {!onPokedex && (
            <div key={pathname} className={styles.page}>
              <Outlet />
            </div>
          )}
        </main>

        <footer className={cx('container', styles.footer)}>
          <SiteDisclaimer />
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
            {to === SHOPPING && <LateBadge className={styles.tabBadge} />}
          </Link>
        ))}
      </nav>

      {searchUsed && <AppSearch open={searching} onClose={closeSearch} />}

      <ScrollRestoration
        // Revenir au Pokédex avec les mêmes filtres, même par un lien, retrouve la position.
        getKey={(location) =>
          location.pathname === '/pokedex' ? location.pathname + location.search : location.key
        }
      />
    </div>
  )
})

/**
 * Une page chargée à la demande (Achats, Valeur…), sur un réseau lent : une barre fine en haut,
 * le temps que son code arrive (sans elle, rien ne bouge après le clic). À part de `Shell` : elle
 * seule se redessine pendant la navigation.
 */
function NavigationProgress() {
  const busy = useNavigation().state !== 'idle'
  if (!busy) return null
  return <Progress size="sm" aria-label="Chargement de la page" className={styles.navigating} />
}

/** Les commandes en retard, sur le lien des achats (barre latérale, onglets) ; rien sinon. */
function LateBadge({ className }: { className?: string }) {
  const late = useShoppingStore((state) => latePendingOrders(state.shopping.orders, today()).length)
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
      {to === SHOPPING && <LateBadge className={styles.sideBadge} />}
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
