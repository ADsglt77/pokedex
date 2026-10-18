import { SegmentedControl, Select, Stack, Switch } from '@camply/ui'
import { use, useMemo } from 'react'
import { Link } from 'react-router'
import { CardFilters } from '@/components/CardFilters'
import { CatalogGrid, CatalogTile } from '@/components/CatalogTile'
import {
  loadSpeciesCards,
  NO_FILTER,
  passesFilter,
  setOption,
  type CardFilter,
  type CatalogCard,
} from '@/lib/card-catalog'
import { plural } from '@/lib/format'
import { priceOf, priceText } from '@/lib/prices'
import { otherSpeciesNames } from '@/lib/species'
import { usePrices, usePricesMissing } from '@/store/prices'
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
  /** Les raretés et les types choisis : retirés quand l'extension change. */
  filter: CardFilter
}

/**
 * Les cartes japonaises du Pokémon, à choisir : leur image, leur série et leur numéro, leur rareté,
 * leur prix Cardmarket du jour ; à filtrer par série, par rareté et par type, ou aux cartes qui ont
 * un prix.
 * `selected` : la clé de la carte choisie (« SV2A 166 »). Une carte de plusieurs Pokémon (TAG
 * TEAM) dit avec qui.
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
  const listed = use(loadSpeciesCards(species.id))
  const ids = useMemo(() => (listed ?? []).flatMap((card) => card.cardmarket ?? []), [listed])
  const prices = usePrices(ids)
  const missing = usePricesMissing(ids)
  const { order, set, pricedOnly, filter } = view
  const change = (next: Partial<PickerView>) => onView({ ...view, ...next })

  if (!listed) {
    return (
      <p className="muted">
        Le catalogue n’est pas disponible pour le moment : réessayez dans quelques minutes, ou
        saisissez la carte à la main.
      </p>
    )
  }
  const cards = listed
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
  const candidates = cards
    .map((card) => ({ card, price: priceOf(prices, card) }))
    .filter(({ card, price }) => (!set || card.set.id === set) && (!pricedOnly || price !== null))
  const filtered = candidates.filter(({ card }) => passesFilter(card, filter))
  // Les plus chères d'abord, celles sans prix à la fin.
  const shown =
    order === 'price'
      ? filtered.sort((a, b) => (b.price?.price ?? -1) - (a.price?.price ?? -1))
      : filtered

  return (
    <Stack gap={4}>
      <Stack direction="horizontal" align="center" gap={3} wrap>
        <Select
          aria-label="Extension"
          size="sm"
          options={setOptions}
          value={set}
          onChange={(value) => change({ set: value, filter: NO_FILTER })}
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
      <CardFilters
        cards={candidates.map(({ card }) => card)}
        value={filter}
        onChange={(value) => change({ filter: value })}
      />
      <p className="muted">
        {plural(shown.length, 'carte japonaise', 'cartes japonaises')}
        {set && (
          <>
            {' '}
            · <Link to={`/catalogue?set=${encodeURIComponent(set)}`}>toute l’extension {set}</Link>
          </>
        )}
      </p>
      <CatalogGrid key={set} wide>
        {shown.map(({ card }) => (
          <li key={card.key}>
            <CatalogTile
              card={card}
              heading={card.key}
              price={priceText(prices, missing, card)}
              speciesId={species.id}
              pressed={selected === card.key}
              onPick={() => onPick(card)}
            >
              {card.dexIds.length > 1 && `avec ${otherSpeciesNames(card.dexIds, species.id)}`}
            </CatalogTile>
          </li>
        ))}
      </CatalogGrid>
    </Stack>
  )
}
