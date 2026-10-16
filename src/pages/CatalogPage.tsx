import { Combobox, Progress, SegmentedControl, Stack, Switch } from '@camply/ui'
import { Suspense, use, useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'react-router'
import { CatalogCredit, CatalogGrid, CatalogTile } from '@/components/CatalogTile'
import { PageHeader } from '@/components/PageHeader'
import { ADD_AS_LABELS, ADDED_AS } from '@/config/shopping'
import { Panel } from '@/components/Panel'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import {
  loadCatalog,
  setCards,
  setOption,
  type Catalog,
  type CatalogCard,
} from '@/lib/card-catalog'
import { cardSpecies, newCardId } from '@/lib/collection'
import { searchForm } from '@/lib/filters'
import { details, formatInteger, pageTitle, plural, toOptions } from '@/lib/format'
import { priceOf } from '@/lib/prices'
import { speciesNames } from '@/lib/species'
import { addCard } from '@/store/collection'
import { usePrices } from '@/store/prices'
import type { AddAs } from '@/types'
import styles from './CatalogPage.module.css'

/**
 * Le catalogue par extension (`/catalogue?set=SV2a`) : toutes les cartes japonaises d'une
 * extension, pour donner d'un clic sa carte à chacun de vos Pokémon qui n'en a pas encore (remplir
 * la 1ʳᵉ génération depuis « 151 »…), à acheter ou possédée. Les extensions se
 * cherchent par code ou par nom, et se classent par nombre de vos Pokémon sans carte qu'elles
 * complètent. C'est vous qui choisissez : rien n'est ajouté seul.
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
        <CatalogContent />
      </Suspense>
    </div>
  )
}

const SET_ORDERS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'useful', label: 'Plus utiles' },
  { value: 'advanced', label: 'Plus avancées' },
] as const

type SetOrder = (typeof SET_ORDERS)[number]['value']

function CatalogContent() {
  const catalog = use(loadCatalog())
  return catalog ? (
    <SetBrowser catalog={catalog} />
  ) : (
    <p className="muted">
      Le catalogue n’est pas disponible pour le moment : réessayez dans quelques minutes.
    </p>
  )
}

function SetBrowser({ catalog }: { catalog: Catalog }) {
  const [params, setParams] = useSearchParams()
  const { entryById } = usePokedex()
  const prices = usePrices()
  const act = useCollectionAction()
  const [missingOnly, setMissingOnly] = useState(true)
  const [setOrder, setSetOrder] = useState<SetOrder>('recent')
  const [addAs, setAddAs] = useState<AddAs>('none')
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
  /** La part des Pokémon de l'extension qui ont déjà leur carte. */
  const progressOf = (setId: string) =>
    speciesCount(setId) ? 1 - openCount(setId) / speciesCount(setId) : 0
  // La recherche porte sur le code et le nom (« sv2a », « 151 », ぽけもん), pas sur le décompte.
  const searchable = useMemo(
    () => new Map(catalog.sets.map(({ id, name }) => [id, searchForm(`${id} ${name}`)])),
    [catalog],
  )

  // L'extension de l'adresse, sinon la plus récente.
  const set = catalog.sets.find((known) => known.id === params.get('set')) ?? catalog.sets[0]!
  const sets =
    setOrder === 'useful'
      ? [...catalog.sets].sort((a, b) => openCount(b.id) - openCount(a.id))
      : setOrder === 'advanced'
        ? [...catalog.sets].sort((a, b) => progressOf(b.id) - progressOf(a.id))
        : catalog.sets
  const setOptions = sets.map((known) => {
    const option = setOption(known)
    const total = speciesCount(known.id)
    return {
      ...option,
      label: `${option.label} · ${formatInteger(total - openCount(known.id))} sur ${formatInteger(total)}`,
    }
  })
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
  const shown = missingOnly ? rows.filter((row) => row.open !== null) : rows
  // Le rang du focus après l'ajout de la carte `index` à `receivers` : les cartes d'avant qui
  // resteront à choisir (celles de ces Pokémon disparaissent ou se désactivent, même avant elle).
  const rankAfter = (index: number, receivers: readonly number[]) =>
    shown
      .slice(0, index)
      .filter((row) => row.card.dexIds.some((id) => !receivers.includes(id) && !hasCard(id))).length
  // Les Pokémon de l'extension, et ceux d'entre eux qui ont déjà leur carte (d'ici ou d'ailleurs).
  const total = speciesCount(set.id)
  const covered = total - openCount(set.id)

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
    <Stack gap={5}>
      <div className={styles.controls}>
        <div className={styles.search}>
          <Combobox
            label="Extension"
            placeholder="Code ou nom : SV2a, 151…"
            options={setOptions}
            value={set.id}
            onChange={(id) => setParams({ set: id }, { replace: true })}
            emptyMessage="Aucune extension ne correspond."
            filter={(option, query) => searchable.get(option.value)!.includes(searchForm(query))}
          />
        </div>
        <SegmentedControl
          aria-label="Ordre des extensions"
          options={[...SET_ORDERS]}
          value={setOrder}
          onChange={setSetOrder}
        />
      </div>
      {setOrder !== 'recent' && (
        <p className="hint">
          {setOrder === 'useful'
            ? 'Plus utiles : celles qui donnent leur carte au plus de vos Pokémon qui n’en ont pas.'
            : 'Plus avancées : celles dont la plus grande part des Pokémon a déjà sa carte (à côté de chaque extension : combien l’ont, sur tous les siens).'}
        </p>
      )}

      <Panel
        title={set.name}
        titleRef={setTitle}
        description={details(
          set.id,
          set.year && `sortie en ${set.year}`,
          plural(cards.length, 'carte Pokémon', 'cartes Pokémon'),
        )}
      >
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
              className={styles.addAs}
              size="sm"
              options={toOptions(ADD_AS_LABELS)}
              value={addAs}
              onChange={setAddAs}
            />
          </Stack>
        </div>
      </Panel>

      <p className="muted">
        {plural(shown.length, 'carte', 'cartes')} · <CatalogCredit />
      </p>
      {shown.length === 0 ? (
        <p className="muted">Tous les Pokémon de cette extension ont déjà leur carte.</p>
      ) : (
        <CatalogGrid ref={grid}>
          {shown.map(({ card, open, receivers, price }, index) => {
            const speciesId = open ?? card.dexIds[0]!
            return (
              <li key={card.key}>
                <CatalogTile
                  card={card}
                  price={price}
                  speciesId={speciesId}
                  disabled={open === null}
                  onPick={() =>
                    open !== null && choose(card, receivers, rankAfter(index, receivers))
                  }
                >
                  {open === null
                    ? `${speciesNames(card.dexIds)} ${card.dexIds.length > 1 ? 'ont déjà leur carte' : 'a déjà sa carte'}`
                    : `Choisir pour ${speciesNames(receivers)}`}
                </CatalogTile>
              </li>
            )
          })}
        </CatalogGrid>
      )}
    </Stack>
  )
}
