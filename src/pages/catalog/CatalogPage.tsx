import { Button, Card, EmptyState, Input, Skeleton, Stack } from '@camply/ui'
import { ArrowLeftRight, Funnel, Library, Plus, Search } from '@camply/ui/icons'
import { Suspense, use, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CardFilters } from '@/components/CardFilters'
import { CatalogGrid, CatalogGridSkeleton, CatalogTile } from '@/components/CatalogTile'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { PageHeader } from '@/components/PageHeader'
import { SetLogo } from '@/components/SetLogo'
import { SetPicker } from '@/components/SetPicker'
import { Unavailable } from '@/components/Unavailable'
import { ENERGY_TYPE, TRAINER_TYPES } from '@/config/catalog'
import { useRetry } from '@/hooks/useRetry'
import { useStartCollection } from '@/hooks/useStartCollection'
import {
  catalogSetsUrl,
  loadSetCards,
  loadSets,
  setCardsUrl,
  NO_FILTER,
  passesFilter,
  type CardFilter,
  type CatalogSets,
  type SetCard,
  type SetSummary,
} from '@/lib/card-catalog'
import { catalogLanguage, catalogParams, searchForm, seriesPath } from '@/lib/filters'
import { focusAfter, focusTileAfter } from '@/lib/focus'
import { details, formatDate, formatInteger, formatList, pageTitle, plural } from '@/lib/format'
import { cardmarketIds, priceText } from '@/lib/prices'
import { findSeries } from '@/lib/series'
import { useCollectionStore } from '@/store/collection'
import { usePrices, usePricesMissing } from '@/store/prices'
import type { CardLanguage } from '@/types'
import { CardDetails } from './CardDetails'
import styles from './CatalogPage.module.css'

/**
 * Le catalogue (`/catalogue?langue=fr&set=MEG`) : toutes les cartes japonaises ou françaises
 * (l'interrupteur `LanguageSwitch`, dans l'adresse : `langue`, le japonais sans elle),
 * extension par extension, Pokémon, dresseurs et énergies. Les extensions se choisissent sur leur
 * logo (`SetPicker`), et la collection de celle montrée s'y commence (`SeriesAction`) ; leurs
 * cartes se cherchent (nom, numéro, illustrateur) et se filtrent par rareté et par type. Une carte
 * ouvre sa fiche (`CardDetails`) : tout ce qu'on en sait, son prix, et pour une carte Pokémon,
 * « Ajouter à la collection ».
 */
export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const lang = catalogLanguage(params)
  return (
    <div className="container">
      <title>{pageTitle('Catalogue')}</title>
      <PageHeader
        title="Catalogue"
        // Une autre langue : sa plus récente extension (l'adresse perd `set`).
        actions={
          <LanguageSwitch
            value={lang}
            onChange={(next) => setParams(catalogParams(next), { replace: true })}
          />
        }
      >
        Toutes les cartes {lang === 'fr' ? 'françaises' : 'japonaises'}, extension par extension :
        Pokémon, dresseurs et énergies.
      </PageHeader>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent lang={lang} />
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

function CatalogContent({ lang }: { lang: CardLanguage }) {
  const retry = useRetry(catalogSetsUrl(lang))
  const catalog = use(loadSets(lang))
  return catalog ? <SetBrowser catalog={catalog} /> : <CatalogUnavailable retry={retry} />
}

/** Les extensions, ou les cartes de l'une d'elles, sans réponse de l'API. */
function CatalogUnavailable({ retry }: { retry: ReturnType<typeof useRetry> }) {
  return (
    <Unavailable
      headingLevel={2}
      title="Le catalogue n’est pas disponible pour le moment"
      retry={retry}
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
        <div className={styles.actions}>
          <SetPicker
            label="Changer d’extension"
            icon={<ArrowLeftRight size={16} />}
            language={set.language}
            current={set.id}
            onPick={(picked) =>
              setParams(catalogParams(set.language, picked.id), { replace: true })
            }
          />
          {/* Une autre extension : un autre bouton, qui n'attend pas les cartes de la première. */}
          <SeriesAction key={`${set.language} ${set.id}`} set={set} />
        </div>
      </Card>
      {/* Une autre extension : sa recherche et ses filtres repartent de zéro (un même code existe
          dans les deux langues). */}
      <Suspense key={`${set.language} ${set.id}`} fallback={<SetCardsSkeleton count={set.count} />}>
        <SetCards set={set} />
      </Suspense>
    </Stack>
  )
}

/**
 * La collection de l'extension montrée : « Commencer la collection » (toutes ses cartes, à
 * débloquer ; puis sa page), ou « Voir ma collection » si elle l'est déjà dans cette langue.
 */
function SeriesAction({ set }: { set: SetSummary }) {
  const started = useCollectionStore(
    (state) => findSeries(state.collection, set.id, set.language) !== null,
  )
  const { startCollection, starting } = useStartCollection()
  if (started) {
    return (
      <Button asChild variant="secondary" leftIcon={<Library size={16} />}>
        <Link to={seriesPath(set.id, set.language)}>Voir ma collection</Link>
      </Button>
    )
  }
  return (
    <Button
      leftIcon={<Plus size={16} />}
      loading={starting}
      onClick={() => void startCollection(set)}
    >
      Commencer la collection
    </Button>
  )
}

function SetCards({ set }: { set: SetSummary }) {
  const retry = useRetry(setCardsUrl(set))
  const cards = use(loadSetCards(set))
  return cards ? <CardBrowser cards={cards} /> : <CatalogUnavailable retry={retry} />
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
  const searchField = useRef<HTMLInputElement>(null)
  const grid = useRef<HTMLUListElement>(null)
  // La fiche fermée : le focus va à la tuile de la carte montrée en dernier (parcourue avec ← et
  // →), pas à celle ouverte au départ.
  const closeCard = () => focusTileAfter(() => setOpen(null), grid, index)
  // Le message et son bouton disparaissent : le focus va à la recherche.
  const clear = () =>
    focusAfter(() => {
      setQuery('')
      setFilter(NO_FILTER)
    }, searchField)

  return (
    <Stack gap={4}>
      <div className={styles.tools}>
        <Input
          ref={searchField}
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

      <p className="muted" aria-live="polite">
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
        <CatalogGrid ref={grid}>
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
          onClose={closeCard}
        />
      )}
    </Stack>
  )
}
