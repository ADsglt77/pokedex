import { Button, Card, EmptyState, Input, Skeleton, Stack } from '@camply/ui'
import { CloudOff, Funnel, Search } from '@camply/ui/icons'
import { Suspense, use, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CardFilters } from '@/components/CardFilters'
import { CatalogGrid, CatalogGridSkeleton, CatalogTile } from '@/components/CatalogTile'
import { PageHeader } from '@/components/PageHeader'
import { ENERGY_TYPE, TRAINER_TYPES } from '@/config/catalog'
import {
  loadSetCards,
  loadSets,
  NO_FILTER,
  passesFilter,
  type CardFilter,
  type CatalogCard,
  type CatalogSets,
  type SetCard,
  type SetSummary,
} from '@/lib/card-catalog'
import { searchForm } from '@/lib/filters'
import { details, formatDate, formatInteger, formatList, pageTitle, plural } from '@/lib/format'
import { priceText } from '@/lib/prices'
import { usePrices, usePricesMissing } from '@/store/prices'
import { CardDetails } from './CardDetails'
import { SetLogo } from './SetLogo'
import { SetPicker } from './SetPicker'
import styles from './CatalogPage.module.css'

/**
 * Le catalogue (`/catalogue?set=SV2a`) : toutes les cartes japonaises, extension par extension,
 * Pokémon, dresseurs et énergies. Les extensions se choisissent sur leur logo japonais
 * (`SetPicker`) ; leurs cartes se cherchent (nom, numéro, illustrateur) et se filtrent par rareté
 * et par type. Une carte ouvre sa fiche (`CardDetails`) : tout ce qu'on en sait, son prix, et
 * pour une carte Pokémon, « Ajouter à la collection ».
 */
export function CatalogPage() {
  return (
    <div className="container">
      <title>{pageTitle('Catalogue')}</title>
      <PageHeader title="Catalogue">
        Toutes les cartes japonaises, extension par extension : Pokémon, dresseurs et énergies.
      </PageHeader>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent />
      </Suspense>
    </div>
  )
}

/**
 * L'ébauche de la page tant que les extensions arrivent, à la taille de ce qui vient (l'extension,
 * sa recherche, ses cartes) : la page ne saute pas.
 */
function CatalogSkeleton() {
  return (
    <Stack gap={4}>
      <p className="visually-hidden">Chargement du catalogue…</p>
      <Skeleton variant="rect" height="8.5rem" />
      <SetCardsSkeleton count={16} />
    </Stack>
  )
}

/** L'ébauche des cartes d'une extension tant qu'elles arrivent : la recherche, puis la grille. */
function SetCardsSkeleton({ count }: { count: number }) {
  return (
    <Stack gap={4} aria-hidden="true">
      <Skeleton variant="rect" height="2.5rem" className={styles.searchSkeleton} />
      <Skeleton width="10rem" />
      <CatalogGridSkeleton count={Math.min(count, 24)} />
    </Stack>
  )
}

function CatalogContent() {
  const catalog = use(loadSets())
  return catalog ? <SetBrowser catalog={catalog} /> : <Unavailable />
}

function Unavailable() {
  return (
    <EmptyState
      headingLevel={2}
      icon={<CloudOff size={22} />}
      title="Le catalogue n’est pas disponible pour le moment"
      description="Réessayez dans quelques minutes."
    />
  )
}

function SetBrowser({ catalog }: { catalog: CatalogSets }) {
  const [params, setParams] = useSearchParams()
  // L'extension de l'adresse, sinon la plus récente.
  const set = catalog.sets.find((known) => known.id === params.get('set')) ?? catalog.sets[0]!

  return (
    <Stack gap={4}>
      <Card padding="none" className={styles.head}>
        <SetLogo set={set} size="hd" className={styles.logo} />
        <div className={styles.titles}>
          <h2 className={styles.name}>{set.name}</h2>
          <p className={styles.meta}>
            {details(
              set.id,
              set.released && `sortie le ${formatDate(set.released)}`,
              plural(set.count, 'carte', 'cartes'),
            )}
          </p>
          {set.block && (
            <p className={styles.meta}>
              {set.deck ? `Deck du bloc ${set.block}` : `Bloc ${set.block}`}
            </p>
          )}
        </div>
        <SetPicker
          className={styles.change}
          sets={catalog.sets}
          blocks={catalog.blocks}
          current={set.id}
          onPick={(setId) => setParams({ set: setId }, { replace: true })}
        />
      </Card>
      {/* Une autre extension : sa recherche et ses filtres repartent de zéro. */}
      <Suspense key={set.id} fallback={<SetCardsSkeleton count={set.count} />}>
        <SetCards set={set} />
      </Suspense>
    </Stack>
  )
}

function SetCards({ set }: { set: SetSummary }) {
  const cards = use(loadSetCards(set))
  return cards ? <CardBrowser cards={cards} /> : <Unavailable />
}

/** « 168 Pokémon, 37 dresseurs et 5 énergies · 45 secrètes » : ce que compte l'extension. */
function composition(cards: SetCard[]) {
  const trainers = cards.filter((card) => card.type !== null && TRAINER_TYPES.has(card.type))
  const energies = cards.filter((card) => card.type === ENERGY_TYPE)
  const pokemon = cards.length - trainers.length - energies.length
  const secrets = cards.filter((card) => card.secret).length
  const kinds = [
    pokemon > 0 && `${formatInteger(pokemon)} Pokémon`,
    trainers.length > 0 && plural(trainers.length, 'dresseur', 'dresseurs'),
    energies.length > 0 && plural(energies.length, 'énergie', 'énergies'),
  ].filter((kind) => kind !== false)
  return details(
    kinds.length > 1 && formatList(kinds),
    secrets > 0 && plural(secrets, 'secrète', 'secrètes'),
  )
}

/** Les ids Cardmarket de ces cartes : les prix à demander. */
const cardmarketIds = (cards: readonly CatalogCard[]) =>
  cards.flatMap((card) => card.cardmarket ?? [])

function CardBrowser({ cards }: { cards: SetCard[] }) {
  const ids = useMemo(() => cardmarketIds(cards), [cards])
  const prices = usePrices(ids)
  const missing = usePricesMissing(ids)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CardFilter>(NO_FILTER)
  // La carte dont la fiche est ouverte (sa clé) ; `null` : aucune.
  const [open, setOpen] = useState<string | null>(null)
  // Une fonction stable : les tuiles, mémoïsées, ne se redessinent pas à l'ouverture d'une fiche.
  const openCard = useCallback((card: SetCard) => setOpen(card.key), [])
  // La grille suit la frappe sans la ralentir : jusqu'à des centaines de cartes à refaire.
  const search = searchForm(useDeferredValue(query))

  const searchable = useMemo(
    () =>
      new Map(
        cards.map((card) => [
          card.key,
          searchForm(
            [card.name, card.english, card.german, card.number, card.printed, card.illustrator]
              .filter(Boolean)
              .join(' '),
          ),
        ]),
      ),
    [cards],
  )
  const found = useMemo(
    () => (search ? cards.filter((card) => searchable.get(card.key)!.includes(search)) : cards),
    [cards, searchable, search],
  )
  const shown = useMemo(() => found.filter((card) => passesFilter(card, filter)), [found, filter])
  const isFiltered = shown.length < cards.length
  const index = open === null ? -1 : shown.findIndex((card) => card.key === open)
  const clear = () => {
    setQuery('')
    setFilter(NO_FILTER)
  }

  return (
    <Stack gap={4}>
      <div className={styles.tools}>
        <Input
          type="search"
          label="Rechercher une carte"
          placeholder="Nom, numéro ou illustrateur"
          leftIcon={<Search size={16} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          className={styles.search}
        />
        <CardFilters cards={found} value={filter} onChange={setFilter} />
      </div>

      <p className="muted">
        {isFiltered
          ? `${plural(shown.length, 'carte', 'cartes')} sur ${formatInteger(cards.length)}`
          : details(plural(cards.length, 'carte', 'cartes'), composition(cards))}
      </p>
      {shown.length === 0 ? (
        <EmptyState
          icon={<Funnel size={22} />}
          title="Aucune carte ne correspond"
          description="Cherchez autrement, ou choisissez d’autres raretés ou d’autres types."
          actions={<Button onClick={clear}>Tout afficher</Button>}
        />
      ) : (
        <CatalogGrid>
          {shown.map((card) => (
            <li key={card.key}>
              <CatalogTile
                card={card}
                heading={card.number}
                price={priceText(prices, missing, card)}
                speciesId={card.dexIds[0]}
                onPick={openCard}
              >
                {card.name}
              </CatalogTile>
            </li>
          ))}
        </CatalogGrid>
      )}
      {index >= 0 && (
        <CardDetails
          cards={shown}
          index={index}
          onIndex={(to) => setOpen(shown[to]!.key)}
          onClose={() => setOpen(null)}
        />
      )}
    </Stack>
  )
}
