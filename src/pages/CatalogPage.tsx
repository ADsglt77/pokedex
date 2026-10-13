import { Select, Stack, Switch } from '@camply/ui'
import { Suspense, use, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CatalogCredit, CatalogGrid, CatalogTile } from '@/components/CatalogTile'
import { PageHeader } from '@/components/PageHeader'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import { loadCatalog, setCards, setOption, type CatalogCard } from '@/lib/card-catalog'
import { findCardImage } from '@/lib/card-images'
import { pageTitle, plural } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { getSpecies } from '@/lib/species'
import { usePrices } from '@/store/prices'
import { addCard } from '@/store/shopping'

/**
 * Le catalogue par extension (`/catalogue?set=SV2a`) : toutes les cartes japonaises d'une
 * extension, pour donner d'un clic sa carte à chacun de vos Pokémon qui n'en a pas encore (remplir
 * la 1ʳᵉ génération depuis « 151 »…). C'est vous qui choisissez : rien n'est ajouté seul.
 */
export function CatalogPage() {
  return (
    <div className="container">
      <title>{pageTitle('Catalogue')}</title>
      <PageHeader title="Catalogue">
        Les cartes japonaises, extension par extension : choisissez d’un clic la carte d’un Pokémon
        qui n’en a pas encore.
      </PageHeader>
      <Suspense fallback={<p className="muted">Chargement du catalogue…</p>}>
        <SetBrowser />
      </Suspense>
    </div>
  )
}

function SetBrowser() {
  const catalog = use(loadCatalog())
  const [params, setParams] = useSearchParams()
  const { entryById } = usePokedex()
  const prices = usePrices()
  const act = useCollectionAction()
  const [missingOnly, setMissingOnly] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)

  // L'extension de l'adresse, sinon la plus récente.
  const set = catalog.sets.find((known) => known.id === params.get('set')) ?? catalog.sets[0]!
  const setOptions = catalog.sets.map(setOption)
  // Pour chaque carte, le Pokémon qui la recevrait : le premier des siens qui n'a pas de carte.
  const rows = setCards(catalog, set.id).map((card) => ({
    card,
    open: card.dexIds.find((id) => !entryById.get(id)?.card) ?? null,
    price: priceOf(prices, card),
  }))
  const shown = missingOnly ? rows.filter((row) => row.open !== null) : rows

  const choose = async (card: CatalogCard, speciesId: number) => {
    setAdding(card.key)
    const image = (await findCardImage(card.reference, { retry: true })) ?? card.fallback
    setAdding(null)
    const name = getSpecies(speciesId)!.names.fr
    act(
      () =>
        addCard(
          {
            id: `manual:${crypto.randomUUID()}`,
            dexIds: [speciesId],
            reference: card.reference,
            image,
            ...(card.cardmarket !== undefined && { cardmarket: card.cardmarket }),
          },
          { owned: false, toBuy: false },
        ),
      `Carte ${card.key} ajoutée à ${name}.`,
    )
  }

  return (
    <Stack gap={5}>
      <Stack direction="horizontal" align="center" gap={3} wrap>
        <Select
          aria-label="Extension"
          options={setOptions}
          value={set.id}
          onChange={(id) => setParams({ set: id }, { replace: true })}
        />
        <Switch
          label="Seulement les Pokémon sans carte"
          checked={missingOnly}
          onChange={(event) => setMissingOnly(event.target.checked)}
        />
      </Stack>
      <p className="muted">
        {plural(shown.length, 'carte', 'cartes')} · <CatalogCredit />
      </p>
      {shown.length === 0 ? (
        <p className="muted">Tous les Pokémon de cette extension ont déjà leur carte.</p>
      ) : (
        <CatalogGrid>
          {shown.map(({ card, open, price }) => {
            const speciesId = open ?? card.dexIds[0]!
            return (
              <li key={card.key}>
                <CatalogTile
                  card={card}
                  price={price}
                  speciesId={speciesId}
                  disabled={open === null || adding !== null}
                  onPick={() => open !== null && choose(card, open)}
                >
                  <span>
                    {open === null
                      ? `${getSpecies(speciesId)!.names.fr} a déjà sa carte`
                      : adding === card.key
                        ? 'Ajout…'
                        : `Choisir pour ${getSpecies(open)!.names.fr}`}
                  </span>
                </CatalogTile>
              </li>
            )
          })}
        </CatalogGrid>
      )}
    </Stack>
  )
}
