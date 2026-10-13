import { Alert, Button, EmptyState, Input, Modal, Select, Stack, Switch } from '@camply/ui'
import { ListChecks, Search } from '@camply/ui/icons'
import { useState } from 'react'
import { Link } from 'react-router'
import { PreferenceFields } from '@/components/PreferenceFields'
import { GENERATION_OPTIONS } from '@/config/pokedex'
import { PRIORITY_LABELS } from '@/config/shopping'
import { cardTitle } from '@/lib/catalog'
import { useCollectionAction } from '@/hooks/useNotify'
import { pokedexUrl } from '@/lib/filters'
import { plural, toOptions } from '@/lib/format'
import {
  DEFAULT_WISHLIST_FILTERS,
  filterWishlist,
  type WishlistFilters,
  type WishlistSort,
} from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import type { GenerationId, PokemonCard, Priority } from '@/types'
import { ExportButtons } from './ExportButtons'
import { useWishlist } from './useWishlist'
import { WishCard } from './WishCard'
import styles from './ShoppingPage.module.css'

const SORT_LABELS: Record<WishlistSort, string> = {
  priority: 'Par priorité',
  price: 'Par prix croissant',
  'price-desc': 'Par prix décroissant',
  gap: 'Par écart au prix maximum',
  dex: 'Par numéro de Pokédex',
  recent: 'Par modification récente',
}

const PRIORITY_OPTIONS = [
  { value: '', label: 'Toutes les priorités' },
  ...toOptions(PRIORITY_LABELS),
]

/** La liste d'achats : chercher, filtrer, trier, modifier une carte, exporter. */
export function WishlistPanel() {
  const act = useCollectionAction()
  const { rows } = useWishlist()
  const [filters, setFilters] = useState<WishlistFilters>(DEFAULT_WISHLIST_FILTERS)
  const [editingId, setEditingId] = useState<string | null>(null)
  const shown = filterWishlist(rows, filters)
  const editing = rows.find((row) => row.card.id === editingId)
  const set = (change: Partial<WishlistFilters>) => setFilters({ ...filters, ...change })

  if (rows.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        className={styles.panel}
        icon={<ListChecks size={22} />}
        title="Votre liste d’achats est vide"
        description="Sur la fiche d’un Pokémon, ajoutez la carte que vous voulez, puis choisissez « À acheter », avec un prix maximum si vous voulez."
        actions={
          <Button asChild>
            <Link to={pokedexUrl({ possession: 'missing' })}>Voir les Pokémon à débloquer</Link>
          </Button>
        }
      />
    )
  }

  const remove = (card: PokemonCard) =>
    act(
      () => useShoppingStore.getState().setDecision(card.id, null),
      `Carte ${card.reference} retirée de la liste d’achats.`,
      'info',
    )

  return (
    <Stack gap={5} className={styles.panel}>
      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          type="search"
          aria-label="Rechercher dans la liste d’achats"
          placeholder="Nom, numéro ou référence"
          leftIcon={<Search size={16} />}
          value={filters.search}
          onChange={(event) => set({ search: event.target.value })}
        />
        <Select
          aria-label="Génération"
          options={GENERATION_OPTIONS}
          value={String(filters.generation ?? '')}
          onChange={(value) => set({ generation: (Number(value) || null) as GenerationId | null })}
        />
        <Select
          aria-label="Priorité"
          options={PRIORITY_OPTIONS}
          value={filters.priority ?? ''}
          onChange={(value) => set({ priority: (value || null) as Priority | null })}
        />
        <Select
          aria-label="Trier par"
          options={toOptions(SORT_LABELS)}
          value={filters.sort}
          onChange={(sort) => set({ sort })}
        />
      </div>
      <div className={styles.switches}>
        <Switch
          label="Sous le prix maximum"
          checked={filters.underMax}
          onChange={(event) => set({ underMax: event.target.checked })}
        />
        <Switch
          label="Aussi possédées et commandées"
          checked={filters.all}
          onChange={(event) => set({ all: event.target.checked })}
        />
      </div>

      {filters.underMax && (
        <Alert tone="info" title="Un indicateur de marché, pas une offre.">
          Le prix du marché Cardmarket de ces cartes est sous votre prix maximum. Les annonces
          réelles varient selon l’état et le vendeur : vérifiez-les sur Cardmarket.
        </Alert>
      )}

      <div className={styles.listHead}>
        <p className="muted" aria-live="polite">
          {plural(shown.length, 'carte', 'cartes')}
        </p>
        <Stack direction="horizontal" gap={2} wrap>
          <ExportButtons rows={shown} name="liste-achats" />
        </Stack>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="Aucune carte ne correspond"
          description="Changez la recherche ou les filtres."
          actions={
            <Button variant="secondary" onClick={() => setFilters(DEFAULT_WISHLIST_FILTERS)}>
              Effacer les filtres
            </Button>
          }
        />
      ) : (
        <ul className={styles.wishGrid}>
          {shown.map((row) => (
            <li key={row.card.id}>
              <WishCard
                row={row}
                onEdit={() => setEditingId(row.card.id)}
                onRemove={() => remove(row.card)}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditingId(null)}
        title={editing && `${cardTitle(editing.card)} · ${editing.card.reference}`}
        size="sm"
      >
        {editing && <PreferenceFields card={editing.card} preference={editing.preference} />}
      </Modal>
    </Stack>
  )
}
