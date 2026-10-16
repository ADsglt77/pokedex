import { Badge, Button, EmptyState, Input, Popover, Select, Stack } from '@camply/ui'
import { ListChecks, Search, SlidersHorizontal } from '@camply/ui/icons'
import { Link } from 'react-router'
import { GENERATION_OPTIONS } from '@/config/pokedex'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { pokedexUrl } from '@/lib/filters'
import { plural, toOptions } from '@/lib/format'
import {
  DEFAULT_WISHLIST_FILTERS,
  filterWishlist,
  type WishlistFilters,
  type WishlistSort,
} from '@/lib/wishlist'
import type { GenerationId } from '@/types'
import { useWishlist } from '@/hooks/useWishlist'
import { WishCard } from './WishCard'
import styles from './ShoppingPage.module.css'

const SORT_LABELS: Record<WishlistSort, string> = {
  price: 'Par prix croissant',
  'price-desc': 'Par prix décroissant',
  drop: 'Plus fortes baisses (30 jours)',
  dex: 'Par numéro de Pokédex',
}

/**
 * La liste d'achats : la carte de chaque Pokémon, ni possédée ni commandée ; chercher, filtrer,
 * trier. Ses filtres sont gardés par la page (`ShoppingPage`) : l'onglet caché est
 * démonté.
 */
export function WishlistPanel({
  filters,
  onFiltersChange,
}: {
  filters: WishlistFilters
  onFiltersChange: (filters: WishlistFilters) => void
}) {
  const { rows } = useWishlist()
  const shown = filterWishlist(rows, filters)
  const set = (change: Partial<WishlistFilters>) => onFiltersChange({ ...filters, ...change })
  // Sur téléphone, les listes passent dans un panneau « Filtres » : la liste commence plus haut.
  const compact = useMediaQuery('(max-width: 40rem)')

  if (rows.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        className={styles.panel}
        icon={<ListChecks size={22} />}
        title="Rien à acheter pour l’instant"
        description="Choisissez la carte de vos Pokémon, dans le catalogue ou sur leur fiche : celles que vous n’avez pas encore arrivent ici."
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
    <Stack gap={5} className={styles.panel}>
      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          type="search"
          aria-label="Rechercher dans la liste d’achats"
          placeholder="Nom, numéro ou référence…"
          leftIcon={<Search size={16} />}
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
        />
        {compact ? (
          <Popover
            placement="bottom-end"
            trigger={
              <Button
                variant="secondary"
                leftIcon={<SlidersHorizontal size={15} />}
                aria-label={`Filtres et tri${filters.generation ? ' (1 filtre actif)' : ''}`}
                className={styles.filtersButton}
              >
                Filtres
                {filters.generation && (
                  <Badge variant="solid" size="sm">
                    1
                  </Badge>
                )}
              </Button>
            }
          >
            <Stack gap={3} className={styles.filtersPanel}>
              {selects}
            </Stack>
          </Popover>
        ) : (
          selects
        )}
      </div>

      <p className="muted" aria-live="polite">
        {plural(shown.length, 'carte à acheter', 'cartes à acheter')}
      </p>

      {shown.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="Aucune carte ne correspond"
          description="Changez la recherche ou les filtres."
          actions={
            <Button variant="secondary" onClick={() => onFiltersChange(DEFAULT_WISHLIST_FILTERS)}>
              Effacer les filtres
            </Button>
          }
        />
      ) : (
        <ul className={styles.wishGrid}>
          {shown.map((row) => (
            <li key={row.card.id}>
              <WishCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </Stack>
  )
}
