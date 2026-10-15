import { SegmentedControl, Select, Stack, Switch } from '@camply/ui'
import { use } from 'react'
import { Link } from 'react-router'
import { CatalogCredit, CatalogGrid, CatalogTile } from '@/components/CatalogTile'
import { loadCatalog, setOption, type CatalogCard } from '@/lib/card-catalog'
import { plural } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { usePrices } from '@/store/prices'
import type { PokemonSpecies } from '@/types'

const ORDERS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'price', label: 'Plus chères' },
] as const

/** Les réglages de la grille, gardés par la fenêtre : revenir aux cartes les retrouve. */
export interface PickerView {
  order: 'recent' | 'price'
  /** L'extension montrée ; `''` : toutes. */
  set: string
  pricedOnly: boolean
}

/**
 * Les cartes japonaises du Pokémon, à choisir : leur image (Pokécardex), leur série, leur numéro
 * et leur année, leur prix Cardmarket du jour ; à filtrer par série ou aux cartes qui ont un prix.
 * `selected` : la clé de la carte choisie (« SV2A 166 »).
 */
export function CatalogPicker({
  species,
  selected,
  onPick,
  view,
  onView,
}: {
  species: PokemonSpecies
  selected: string | null
  onPick: (card: CatalogCard) => void
  view: PickerView
  onView: (view: PickerView) => void
}) {
  const catalog = use(loadCatalog())
  const prices = usePrices()
  const { order, set, pricedOnly } = view
  const change = (next: Partial<PickerView>) => onView({ ...view, ...next })

  if (!catalog) {
    return (
      <p className="muted">
        Le catalogue n’est pas disponible pour le moment : réessayez dans quelques minutes, ou
        saisissez la carte à la main.
      </p>
    )
  }
  const cards = catalog.bySpecies.get(species.id) ?? []
  if (cards.length === 0) {
    return (
      <p className="muted">
        Aucune carte japonaise de {species.names.fr} dans le catalogue : saisissez-la à la main.
      </p>
    )
  }

  // Les extensions de ses cartes, dans l'ordre du catalogue (des plus récentes).
  const sets = [...new Map(cards.map((card) => [card.set.id, card.set])).values()]
  const setOptions = [{ value: '', label: 'Toutes les extensions' }, ...sets.map(setOption)]
  const priced = cards
    .map((card) => ({ card, price: priceOf(prices, card) }))
    .filter(({ card, price }) => (!set || card.set.id === set) && (!pricedOnly || price !== null))
  // Les plus chères d'abord, celles sans prix à la fin.
  const shown =
    order === 'price'
      ? priced.sort((a, b) => (b.price?.price ?? -1) - (a.price?.price ?? -1))
      : priced

  return (
    <Stack gap={4}>
      <Stack direction="horizontal" align="center" gap={3} wrap>
        <Select
          aria-label="Extension"
          size="sm"
          options={setOptions}
          value={set}
          onChange={(value) => change({ set: value })}
        />
        <SegmentedControl
          aria-label="Ordre des cartes"
          size="sm"
          options={[...ORDERS]}
          value={order}
          onChange={(value) => change({ order: value })}
        />
        <Switch
          label="Avec un prix"
          checked={pricedOnly}
          onChange={(event) => change({ pricedOnly: event.target.checked })}
        />
      </Stack>
      <p className="muted">
        {plural(shown.length, 'carte japonaise', 'cartes japonaises')} · <CatalogCredit />
        {set && (
          <>
            {' '}
            · <Link to={`/catalogue?set=${encodeURIComponent(set)}`}>toute l’extension {set}</Link>
          </>
        )}
      </p>
      <CatalogGrid>
        {shown.map(({ card, price }) => (
          <li key={card.key}>
            <CatalogTile
              card={card}
              price={price}
              speciesId={species.id}
              pressed={selected === card.key}
              onPick={() => onPick(card)}
            />
          </li>
        ))}
      </CatalogGrid>
    </Stack>
  )
}
