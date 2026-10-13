import { Banner, Button } from '@camply/ui'
import { ChartLine, Database, Grid3x3, House, ShoppingCart } from '@camply/ui/icons'
import { useEffect, useRef } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { cx } from '@/lib/cx'
import { useStorageFailure } from '@/store/persist'
import styles from './AppShell.module.css'

const NAV = [
  { to: '/', label: 'Accueil', icon: House },
  { to: '/pokedex', label: 'Pokédex', icon: Grid3x3 },
  { to: '/valeur', label: 'Valeur', icon: ChartLine },
  { to: '/achats', label: 'Achats', icon: ShoppingCart },
  { to: '/donnees', label: 'Données', icon: Database },
]

/** L'onglet de la page : la fiche d'un Pokémon fait partie du Pokédex. */
const isCurrent = (to: string, path: string) =>
  to === '/'
    ? path === '/'
    : path.startsWith(to) || (to === '/pokedex' && path.startsWith('/pokemon'))

function Emblem() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className={styles.emblem}>
      {Array.from({ length: 9 }, (_, index) => (
        <rect
          key={index}
          x={1 + (index % 3) * 8}
          y={1 + Math.floor(index / 3) * 8}
          width="6"
          height="6"
          rx="1.5"
          className={index < 4 ? styles.emblemFilled : undefined}
        />
      ))}
    </svg>
  )
}

/**
 * La coquille de toutes les pages : lien d'évitement, en-tête et navigation (barre d'onglets en bas
 * sur téléphone), avertissement si le navigateur n'enregistre plus, pied de page, focus et
 * défilement à chaque changement de page.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const storageFailed = useStorageFailure((state) => state.failed)
  const main = useRef<HTMLElement>(null)
  const shownPath = useRef(pathname)

  // À chaque nouvelle page, le focus va au contenu (lecteurs d'écran, navigation au clavier).
  useEffect(() => {
    if (shownPath.current === pathname) return
    shownPath.current = pathname
    main.current?.focus({ preventScroll: true })
  }, [pathname])

  const navLinks = (className: string | undefined, withIcons: boolean) =>
    NAV.map(({ to, label, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        className={className}
        aria-current={isCurrent(to, pathname) ? 'page' : undefined}
      >
        {withIcons && <Icon size={20} aria-hidden="true" />}
        <span>{label}</span>
      </Link>
    ))

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Aller au contenu
      </a>

      <header className={styles.header}>
        <div className={cx('container', styles.headerInner)}>
          <Link to="/" className={styles.brand}>
            <Emblem />
            Mon Pokédex
          </Link>
          <nav aria-label="Navigation principale" className={styles.nav}>
            {navLinks(styles.navLink, false)}
          </nav>
        </div>
      </header>

      {storageFailed && (
        <Banner
          tone="warn"
          action={
            <Button asChild size="sm" variant="soft">
              <Link to="/donnees#exporter">Exporter</Link>
            </Button>
          }
        >
          Le navigateur n’enregistre plus vos modifications (stockage plein ou bloqué) : elles
          seront perdues en fermant la page. Exportez votre collection pour les garder.
        </Banner>
      )}

      <main id="main" ref={main} tabIndex={-1} className={styles.main}>
        {/* Une clé par adresse : chaque page (et chaque fiche) repart d'un état neuf. */}
        <div key={pathname} className={styles.page}>
          <Outlet />
        </div>
      </main>

      <footer className={cx('container', styles.footer)}>
        Données PokéAPI, images Pokécardex, prix Cardmarket. Projet personnel, sans lien avec
        Nintendo, Creatures, Game Freak ou The Pokémon Company.
      </footer>

      <nav aria-label="Navigation principale" className={styles.tabbar}>
        {navLinks(styles.tab, true)}
      </nav>

      <ScrollRestoration
        // Revenir au Pokédex avec les mêmes filtres, même par un lien, retrouve la position.
        getKey={(location) =>
          location.pathname === '/pokedex' ? location.pathname + location.search : location.key
        }
      />
    </div>
  )
}
