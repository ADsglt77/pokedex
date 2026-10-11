import { ChartLine, Database, Grid3x3, House } from '@camply/ui/icons'
import { useEffect, useRef } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { cx } from '@/lib/cx'
import styles from './AppShell.module.css'

const NAV = [
  { to: '/', label: 'Accueil', icon: House, match: (path: string) => path === '/' },
  {
    to: '/pokedex',
    label: 'Pokédex',
    icon: Grid3x3,
    match: (path: string) => path.startsWith('/pokedex') || path.startsWith('/pokemon'),
  },
  { to: '/valeur', label: 'Valeur', icon: ChartLine, match: (path: string) => path === '/valeur' },
  {
    to: '/donnees',
    label: 'Données',
    icon: Database,
    match: (path: string) => path === '/donnees',
  },
]

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
 * sur téléphone), pied de page, focus et défilement à chaque changement de page.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // À chaque nouvelle page, le focus va au contenu (lecteurs d'écran, navigation au clavier).
  useEffect(() => {
    if (firstRender.current) firstRender.current = false
    else main.current?.focus({ preventScroll: true })
  }, [pathname])

  const navLinks = (className: string | undefined, withIcons: boolean) =>
    NAV.map(({ to, label, icon: Icon, match }) => (
      <Link
        key={to}
        to={to}
        className={className}
        aria-current={match(pathname) ? 'page' : undefined}
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

      <main id="main" ref={main} tabIndex={-1} className={styles.main}>
        {/* Une clé par adresse : chaque page (et chaque fiche) repart d'un état neuf. */}
        <div key={pathname} className={styles.page}>
          <Outlet />
        </div>
      </main>

      <footer className={cx('container', styles.footer)}>
        Données PokéAPI, TCGdex et TCGplayer, prix Cardmarket. Projet personnel, sans lien avec
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
