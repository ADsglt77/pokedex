import { SegmentedControl, Select, Stack, Switch } from '@camply/ui'
import { use, useState } from 'react'
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

/**
 * Les cartes japonaises du Pokémon, à choisir : leur image (Pokécardex, sinon TCGplayer), leur
 * extension, leur numéro et leur année, leur prix du jour (Cardmarket, sinon TCGplayer) ; à
 * filtrer par extension ou aux cartes qui ont un prix.
 * `selected` : la clé de la carte choisie (« SV2a 166 »).
 */
export function CatalogPicker({
  species,
  selected,
  onPick,
}: {
  species: PokemonSpecies
  selected: string | null
  onPick: (card: CatalogCard) => void
}) {
  const cards = use(loadCatalog()).bySpecies.get(species.id) ?? []
  const prices = usePrices()
  const [order, setOrder] = useState<'recent' | 'price'>('recent')
  const [set, setSet] = useState('')
  const [pricedOnly, setPricedOnly] = useState(false)

  if (cards.length === 0) {
    return (
      <p className="muted">
        Aucune carte japonaise de {species.names.fr} dans le catalogue : saisissez-la à la main, ou
        prenez-la sur Cardmarket avec le favori.
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
      ? [...priced].sort((a, b) => (b.price?.price ?? -1) - (a.price?.price ?? -1))
      : priced

  return (
    <Stack gap={4}>
      <Stack direction="horizontal" align="center" gap={3} wrap>
        <Select
          aria-label="Extension"
          size="sm"
          options={setOptions}
          value={set}
          onChange={setSet}
        />
        <SegmentedControl
          aria-label="Ordre des cartes"
          size="sm"
          options={[...ORDERS]}
          value={order}
          onChange={setOrder}
        />
        <Switch
          label="Avec un prix"
          checked={pricedOnly}
          onChange={(event) => setPricedOnly(event.target.checked)}
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
