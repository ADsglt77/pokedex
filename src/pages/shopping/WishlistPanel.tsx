import { Button, EmptyState, Input, Select, Stack } from '@camply/ui'
import { ListChecks, Search } from '@camply/ui/icons'
import { useDeferredValue, useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { FiltersPopover } from '@/components/FiltersPopover'
import { NoMatch } from '@/components/NoMatch'
import { GENERATION_OPTIONS } from '@/config/pokedex'
import { useFollowLinks } from '@/hooks/useFollowLinks'
import { useGrowingList } from '@/hooks/useGrowingList'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  DEFAULT_WISHLIST_FILTERS,
  pokedexUrl,
  type WishlistFilters,
  type WishlistSort,
} from '@/lib/filters'
import { plural, toOptions } from '@/lib/format'
import { filterWishlist, type WishRow } from '@/lib/wishlist'
import type { GenerationId } from '@/types'
import { WishCard } from './WishCard'
import page from './ShoppingPage.module.css'
import styles from './WishlistPanel.module.css'

const SORT_LABELS: Record<WishlistSort, string> = {
  price: 'Par prix croissant',
  'price-desc': 'Par prix décroissant',
  drop: 'Plus fortes baisses (30 jours)',
  dex: 'Par numéro de Pokédex',
}

/** Les cartes dessinées d'un coup : plus qu'un grand écran n'en montre. */
const CARDS_STEP = 40

/**
 * La liste d'achats (`rows`, celle de la page : `useWishlist`) : les cartes voulues pour vos
 * Pokémon et vos collections d'extensions, ni possédées ni commandées, chacune une fois ;
 * chercher, filtrer (une carte sans Pokémon n'a pas de génération), trier. Ses filtres sont dans
 * l'adresse, lus et changés par la page (`ShoppingPage`) : ils survivent à l'ouverture d'une fiche
 * et au retour.
 */
export function WishlistPanel({
  rows,
  filters,
  onFiltersChange: set,
}: {
  rows: WishRow[]
  filters: WishlistFilters
  onFiltersChange: (change: Partial<WishlistFilters>) => void
}) {
  const followLinks = useFollowLinks()
  // La liste suit la saisie dès que le navigateur a le temps : la frappe reste fluide.
  const shownFilters = useDeferredValue(filters)
  const shown = useMemo(() => filterWishlist(rows, shownFilters), [rows, shownFilters])
  // Jusqu'à un millier de cartes : dessinées au fur et à mesure du défilement.
  const { limit, sentinel, more } = useGrowingList(shown.length, CARDS_STEP)
  // Sur téléphone, les listes passent dans un panneau « Filtres » : la liste commence plus haut.
  const compact = useMediaQuery('(max-width: 40rem)')
  const searchField = useRef<HTMLInputElement>(null)

  if (rows.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        className={page.panel}
        icon={<ListChecks size={22} />}
        title="Rien à acheter pour l’instant"
        description="Les cartes de vos Pokémon et de vos collections d’extensions que vous n’avez pas encore arrivent ici : choisissez-les dans le catalogue ou sur la fiche d’un Pokémon, ou commencez la collection d’une extension."
        actions={
          <>
            <Button asChild>
              <Link to="/catalogue">Choisir dans le catalogue</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to={pokedexUrl({ possession: 'missing' })}>Voir les Pokémon à débloquer</Link>
            </Button>
          </>
        }
      />
    )
  }

  const selects = (
    <>
      <Select
        aria-label="Génération"
        options={GENERATION_OPTIONS}
        value={String(filters.generation ?? '')}
        onChange={(value) => set({ generation: (Number(value) || null) as GenerationId | null })}
      />
      <Select
        aria-label="Trier par"
        options={toOptions(SORT_LABELS)}
        value={filters.sort}
        onChange={(sort) => set({ sort })}
      />
    </>
  )

  return (
    <Stack gap={5} className={page.panel}>
      <div className={styles.toolbar}>
        <Input
          ref={searchField}
          className={styles.search}
          type="search"
          aria-label="Rechercher dans la liste d’achats"
          placeholder="Nom, numéro ou référence…"
          leftIcon={<Search size={16} />}
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
        />
        {compact ? (
          <FiltersPopover
            label={`Filtres et tri${filters.generation ? ' (1 filtre actif)' : ''}`}
            active={filters.generation ? 1 : 0}
            className={styles.filtersButton}
          >
            {selects}
          </FiltersPopover>
        ) : (
          selects
        )}
      </div>

      <p className="muted" aria-live="polite">
        {plural(shown.length, 'carte à acheter', 'cartes à acheter')}
      </p>

      {shown.length === 0 ? (
        <NoMatch
          title="Aucune carte ne correspond à ces filtres"
          onReset={() => set(DEFAULT_WISHLIST_FILTERS)}
          search={searchField}
        />
      ) : (
        // Le clic de ses liens se lit ici, une fois pour toute la liste.
        <div className="growing">
          <ul className={styles.wishGrid} onClick={followLinks}>
            {shown.slice(0, limit).map((row) => (
              <li key={row.card.id}>
                <WishCard row={row} />
              </li>
            ))}
          </ul>
          {more && <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />}
        </div>
      )}
    </Stack>
  )
}
