import {
  Button,
  Card,
  EmptyState,
  Progress,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
} from '@camply/ui'
import { ArrowLeftRight, CloudOff, Flag, Funnel } from '@camply/ui/icons'
import { Suspense, use, useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'react-router'
import { CardFilters } from '@/components/CardFilters'
import { CatalogGrid, CatalogGridSkeleton, CatalogTile } from '@/components/CatalogTile'
import { PageHeader } from '@/components/PageHeader'
import { ADD_AS_LABELS, ADDED_AS } from '@/config/shopping'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import {
  loadCatalog,
  NO_FILTER,
  passesFilter,
  setCards,
  type CardFilter,
  type Catalog,
  type CatalogCard,
} from '@/lib/card-catalog'
import { cardSpecies, newCardId } from '@/lib/collection'
import { details, formatInteger, pageTitle, plural, toOptions } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { speciesNames } from '@/lib/species'
import { addCard } from '@/store/collection'
import { usePrices } from '@/store/prices'
import type { AddAs } from '@/types'
import { SetLogo } from './SetLogo'
import { SetPicker, type SetOrder } from './SetPicker'
import styles from './CatalogPage.module.css'

/**
 * Le catalogue par extension (`/catalogue?set=SV2a`) : toutes les cartes japonaises d'une
 * extension, pour donner d'un clic sa carte à chacun de vos Pokémon qui n'en a pas encore (remplir
 * la 1ʳᵉ génération depuis « 151 »…), à acheter ou possédée. Les extensions se choisissent sur leur
 * logo japonais (`SetPicker`) ; leurs cartes se filtrent par rareté et par type. C'est vous qui
 * choisissez : rien n'est ajouté seul.
 */
export function CatalogPage() {
  return (
    <div className="container">
      <title>{pageTitle('Catalogue')}</title>
      <PageHeader title="Catalogue">
        Les cartes japonaises, extension par extension : choisissez d’un clic la carte d’un Pokémon
        qui n’en a pas encore.
      </PageHeader>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent />
      </Suspense>
    </div>
  )
}

/**
 * L'ébauche de la page tant que le catalogue arrive, à la taille de ce qui vient (l'extension, ses
 * réglages, ses cartes) : la page ne saute pas.
 */
function CatalogSkeleton() {
  return (
    <Stack gap={4}>
      <p className="visually-hidden">Chargement du catalogue…</p>
      <Skeleton variant="rect" height="15rem" />
      <Skeleton width="8rem" />
      <CatalogGridSkeleton count={16} />
    </Stack>
  )
}

function CatalogContent() {
  const catalog = use(loadCatalog())
  return catalog ? (
    <SetBrowser catalog={catalog} />
  ) : (
    <EmptyState
      headingLevel={2}
      icon={<CloudOff size={22} />}
      title="Le catalogue n’est pas disponible pour le moment"
      description="Réessayez dans quelques minutes."
    />
  )
}

function SetBrowser({ catalog }: { catalog: Catalog }) {
  const [params, setParams] = useSearchParams()
  const { entryById } = usePokedex()
  const prices = usePrices()
  const act = useCollectionAction()
  const [missingOnly, setMissingOnly] = useState(true)
  const [setOrder, setSetOrder] = useState<SetOrder>('recent')
  const [picking, setPicking] = useState(false)
  const [addAs, setAddAs] = useState<AddAs>('none')
  // Les filtres valent pour une extension : en changer les retire (ses raretés ne sont pas les
  // mêmes).
  const [filtered, setFiltered] = useState({ set: '', filter: NO_FILTER })
  const grid = useRef<HTMLUListElement>(null)
  const setTitle = useRef<HTMLHeadingElement>(null)
  const addAsLabel = useId()

  // Les Pokémon de chaque extension, et ceux d'entre eux qui n'ont pas encore de carte (d'ici ou
  // d'ailleurs) : ce qu'elle peut compléter, et où en est la progression de chacune.
  const { speciesBySet, openBySet } = useMemo(() => {
    const species = new Map<string, Set<number>>()
    const open = new Map<string, Set<number>>()
    const add = (map: Map<string, Set<number>>, setId: string, id: number) =>
      map.set(setId, (map.get(setId) ?? new Set<number>()).add(id))
    for (const list of catalog.bySpecies.values()) {
      for (const card of list) {
        for (const id of card.dexIds) {
          add(species, card.set.id, id)
          if (!entryById.get(id)?.card) add(open, card.set.id, id)
        }
      }
    }
    return { speciesBySet: species, openBySet: open }
  }, [catalog, entryById])
  const openCount = (setId: string) => openBySet.get(setId)?.size ?? 0
  const speciesCount = (setId: string) => speciesBySet.get(setId)?.size ?? 0
  const coverage = (setId: string) => ({
    covered: speciesCount(setId) - openCount(setId),
    total: speciesCount(setId),
  })
  /** La part des Pokémon de l'extension qui ont déjà leur carte. */
  const progressOf = (setId: string) =>
    speciesCount(setId) ? 1 - openCount(setId) / speciesCount(setId) : 0

  // L'extension de l'adresse, sinon la plus récente.
  const set = catalog.sets.find((known) => known.id === params.get('set')) ?? catalog.sets[0]!
  const sets =
    setOrder === 'useful'
      ? [...catalog.sets].sort((a, b) => openCount(b.id) - openCount(a.id))
      : setOrder === 'advanced'
        ? [...catalog.sets].sort((a, b) => progressOf(b.id) - progressOf(a.id))
        : catalog.sets
  const filter = filtered.set === set.id ? filtered.filter : NO_FILTER
  const setFilter = (next: CardFilter) => setFiltered({ set: set.id, filter: next })
  // Les cartes de l'extension, cherchées une fois dans tout le catalogue (pas à chaque clic).
  const cards = useMemo(() => setCards(catalog, set.id), [catalog, set.id])
  const hasCard = (id: number) => entryById.get(id)?.card != null
  // Pour chaque carte, les Pokémon qui la recevraient : ceux des siens qui n'ont pas de carte (une
  // carte TAG TEAM les débloque tous), le premier en tête ; aucun, elle n'est plus à choisir.
  const rows = cards.map((card) => {
    const open = card.dexIds.find((id) => !hasCard(id)) ?? null
    return {
      card,
      open,
      receivers: open === null ? [] : cardSpecies(card.dexIds, open, hasCard),
      price: priceOf(prices, card),
    }
  })
  const candidates = missingOnly ? rows.filter((row) => row.open !== null) : rows
  const shown = candidates.filter((row) => passesFilter(row.card, filter))
  const isFiltered = shown.length < candidates.length
  // Le rang du focus après l'ajout de la carte `index` à `receivers` : les cartes d'avant qui
  // resteront à choisir (celles de ces Pokémon disparaissent ou se désactivent, même avant elle).
  const rankAfter = (index: number, receivers: readonly number[]) =>
    shown
      .slice(0, index)
      .filter((row) => row.card.dexIds.some((id) => !receivers.includes(id) && !hasCard(id))).length
  // Les Pokémon de l'extension, et ceux d'entre eux qui ont déjà leur carte (d'ici ou d'ailleurs).
  const { covered, total } = coverage(set.id)
  // L'extension qui donnerait leur carte au plus de vos Pokémon qui n'en ont pas ; aucune s'ils
  // l'ont tous.
  const mostUseful = catalog.sets.reduce((best, known) =>
    openCount(known.id) > openCount(best.id) ? known : best,
  )
  // Le bouton disparaît avec l'extension terminée : le focus va au titre, celui de la suivante.
  const showMostUseful = () => {
    setSetOrder('useful')
    setParams({ set: mostUseful.id }, { replace: true })
    setTitle.current?.focus()
  }
  const pick = (setId: string) => {
    setPicking(false)
    setParams({ set: setId }, { replace: true })
  }

  const choose = (card: CatalogCard, receivers: number[], rank: number) => {
    // Ajoutée et affichée tout de suite : le focus va alors à la carte suivante, celle ajoutée
    // disparaissant ou se désactivant.
    flushSync(() => {
      act(
        () =>
          addCard(
            {
              id: newCardId(),
              dexIds: receivers,
              reference: card.reference,
              image: card.image,
              ...(card.cardmarket !== undefined && { cardmarket: card.cardmarket }),
            },
            addAs,
          ),
        `Carte ${card.key} ajoutée à ${speciesNames(receivers)}${ADDED_AS[addAs]}.`,
      )
    })
    const tiles = grid.current?.querySelectorAll<HTMLButtonElement>('button:enabled') ?? []
    // Plus aucune carte à choisir : le focus va au titre de l'extension, sa progression dessous.
    const next = tiles[Math.min(rank, tiles.length - 1)] ?? setTitle.current
    next?.focus()
  }

  return (
    <Stack gap={4}>
      <Card padding="none" className={styles.set}>
        <div className={styles.head}>
          <SetLogo set={set} size="hd" className={styles.logo} />
          <div className={styles.titles}>
            <h2 ref={setTitle} tabIndex={-1} className={styles.name}>
              {set.name}
            </h2>
            <p className={styles.meta}>
              {details(
                set.id,
                set.year && `sortie en ${set.year}`,
                plural(cards.length, 'carte Pokémon', 'cartes Pokémon'),
              )}
            </p>
            <div className={styles.coverage}>
              <p>
                <strong className="numeric">
                  {formatInteger(covered)} sur {formatInteger(total)}
                </strong>{' '}
                de ses Pokémon ont leur carte
                {covered < total && ` : ${plural(total - covered, 'reste', 'restent')} à choisir`}.
              </p>
              <Progress
                size="sm"
                value={covered}
                max={total}
                aria-label="Pokémon de l’extension qui ont leur carte"
              />
            </div>
          </div>
          <Button
            variant="secondary"
            leftIcon={<ArrowLeftRight size={16} />}
            onClick={() => setPicking(true)}
            className={styles.change}
          >
            Changer d’extension
          </Button>
        </div>
        <div className={styles.options}>
          <Switch
            label="Seulement les Pokémon sans carte"
            checked={missingOnly}
            onChange={(event) => setMissingOnly(event.target.checked)}
          />
          <Stack direction="horizontal" align="center" gap={2} wrap>
            <span id={addAsLabel} className={styles.label}>
              Ajouter comme
            </span>
            <SegmentedControl
              aria-labelledby={addAsLabel}
              size="sm"
              options={toOptions(ADD_AS_LABELS)}
              value={addAs}
              onChange={setAddAs}
            />
          </Stack>
        </div>
        <div className={styles.filters}>
          <CardFilters
            cards={candidates.map((row) => row.card)}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </Card>
      <SetPicker
        open={picking}
        onClose={() => setPicking(false)}
        sets={sets}
        order={setOrder}
        onOrder={setSetOrder}
        current={set.id}
        coverage={coverage}
        onPick={pick}
      />

      <p className="muted">
        {plural(shown.length, 'carte', 'cartes')}
        {isFiltered && ` sur ${formatInteger(candidates.length)}`}
      </p>
      {shown.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon={<Funnel size={22} />}
            title="Aucune carte pour ces filtres"
            description="Choisissez d’autres raretés ou d’autres types."
            actions={<Button onClick={() => setFilter(NO_FILTER)}>Retirer les filtres</Button>}
          />
        ) : (
          <EmptyState
            icon={<Flag size={22} />}
            title="Extension terminée"
            description="Tous ses Pokémon ont déjà leur carte, d’ici ou d’une autre extension."
            actions={
              openCount(mostUseful.id) > 0 && (
                <Button onClick={showMostUseful}>Voir les plus utiles</Button>
              )
            }
          />
        )
      ) : (
        <CatalogGrid ref={grid}>
          {shown.map(({ card, open, receivers, price }, index) => {
            const speciesId = open ?? card.dexIds[0]!
            return (
              <li key={card.key}>
                <CatalogTile
                  card={card}
                  heading={card.number}
                  price={price}
                  speciesId={speciesId}
                  disabled={open === null}
                  onPick={() => choose(card, receivers, rankAfter(index, receivers))}
                >
                  {open === null ? (
                    `${speciesNames(card.dexIds)} ${card.dexIds.length > 1 ? 'ont déjà leur carte' : 'a déjà sa carte'}`
                  ) : (
                    <>
                      <span className="visually-hidden">Choisir pour </span>
                      {speciesNames(receivers)}
                    </>
                  )}
                </CatalogTile>
              </li>
            )
          })}
        </CatalogGrid>
      )}
    </Stack>
  )
}
