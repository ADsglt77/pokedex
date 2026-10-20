import {
  Badge,
  Button,
  DescriptionList,
  IconButton,
  Modal,
  Tag,
  type DescriptionItem,
} from '@camply/ui'
import { Check, ChevronLeft, ChevronRight, Plus } from '@camply/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { CardArt } from '@/components/CardArt'
import { RarityIcon, TypeIcon } from '@/components/CatalogIcons'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PricePanel } from '@/components/PricePanel'
import { CARD_TYPES } from '@/config/catalog'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import { isCatalogCard, type SetCard } from '@/lib/card-catalog'
import { newCardId } from '@/lib/collection'
import { isInAnOrder } from '@/lib/orders'
import { details, formatDate, formatDexNumber, formatList, statusLabel } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import { getSpecies, speciesNames } from '@/lib/species'
import { addCard, useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CardStatus } from '@/types'
import styles from './CardDetails.module.css'

/** « possédée », « commandée », « à acheter ». */
const statusText = (status: CardStatus | null) =>
  status ? statusLabel(status).toLowerCase() : 'à acheter'

/** Une carte qu'a déjà un ou plusieurs Pokémon de la carte montrée. */
interface HeldCard {
  view: CardView
  /** Ceux des Pokémon de la carte montrée qui l'ont. */
  speciesIds: number[]
}

/**
 * Où en est la carte dans la collection : la carte de ses Pokémon (`mine`), ou les cartes qu'ont
 * déjà ses Pokémon (`held`, que l'ajout remplacerait), et celle d'entre elles qu'une commande
 * retient (`locked` : la retirer de tous ses Pokémon fausserait le registre).
 */
function useCollectionPlace(card: SetCard) {
  const { entryById } = usePokedex()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const byCard = new Map<string, HeldCard>()
  for (const speciesId of card.dexIds) {
    const view = entryById.get(speciesId)?.card
    if (!view) continue
    const held = byCard.get(view.card.id)
    if (held) held.speciesIds.push(speciesId)
    else byCard.set(view.card.id, { view, speciesIds: [speciesId] })
  }
  const held = [...byCard.values()]
  const mine = held.find(({ view }) => isCatalogCard(view.card, card))?.view ?? null
  const locked =
    held.find(
      ({ view, speciesIds }) =>
        view.card.dexIds.every((id) => speciesIds.includes(id)) &&
        isInAnOrder(orders, view.card.id),
    ) ?? null
  return { mine, held, locked }
}

type CollectionPlace = ReturnType<typeof useCollectionPlace>

/**
 * La fiche d'une carte du catalogue, pleine page : son image en grand, tout ce qu'on en sait
 * (extension, numéro, rareté, type, Pokémon, illustrateur, versions, autres noms), son prix
 * Cardmarket et sa courbe. Les flèches du pied passent aux cartes voisines de la grille (`cards`,
 * dans l'ordre affiché) ; une carte Pokémon s'y ajoute à la collection (`AddToCollection`).
 */
export function CardDetails({
  cards,
  index,
  onIndex,
  onClose,
}: {
  cards: SetCard[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const card = cards[index]!
  const place = useCollectionPlace(card)
  const previous = useRef<HTMLButtonElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  // Une autre carte : sa fiche se lit depuis le haut. Entre accolades : `scrollIntoView` rend une
  // promesse dans les navigateurs récents, que React prendrait pour la fonction de nettoyage.
  useEffect(() => {
    sheet.current?.scrollIntoView({ block: 'start' })
  }, [card.key])
  // Au bout de la liste, la flèche se désactive : le focus passe à l'autre.
  const go = (to: number) => {
    onIndex(to)
    if (to === 0) next.current?.focus()
    if (to === cards.length - 1) previous.current?.focus()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title={card.name}
      description={details(`${card.set.name} (${card.set.id})`, card.printed ?? card.number)}
      footer={
        <div className={styles.footer}>
          <div className={styles.browse}>
            <IconButton
              ref={previous}
              label="Carte précédente"
              variant="ghost"
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <ChevronLeft size={18} />
            </IconButton>
            <span className={styles.position}>
              {index + 1} / {cards.length}
            </span>
            <IconButton
              ref={next}
              label="Carte suivante"
              variant="ghost"
              disabled={index === cards.length - 1}
              onClick={() => go(index + 1)}
            >
              <ChevronRight size={18} />
            </IconButton>
          </div>
          {card.dexIds.length > 0 && <AddToCollection key={card.key} card={card} place={place} />}
        </div>
      }
    >
      <div ref={sheet} className={styles.sheet}>
        <CardArt
          key={card.key}
          card={card}
          speciesId={card.dexIds[0]}
          alt={`Carte ${card.reference}`}
          large
          eager
          className={styles.art}
        />
        <div className={styles.info}>
          <section className={styles.facts}>
            <h3>La carte</h3>
            <DescriptionList items={facts(card, place)} />
          </section>
          <PricePanel
            card={card}
            headingLevel={3}
            withoutId="Pas de prix : son id Cardmarket n’est pas connu."
          />
        </div>
      </div>
    </Modal>
  )
}

/** Ce qu'on sait de la carte, ligne à ligne ; ce qu'on ne sait pas n'a pas de ligne. */
function facts(card: SetCard, place: CollectionPlace) {
  const pokemon = card.dexIds.length > 0
  const rows: (DescriptionItem | false | '' | null)[] = [
    {
      term: 'Extension',
      description: details(
        `${card.set.name} (${card.set.id})`,
        card.set.block && `bloc ${card.set.block}`,
        card.set.deck && 'deck',
      ),
    },
    {
      term: 'Numéro',
      description: (
        <span className={styles.inline}>
          <span className="numeric">{card.printed ?? card.number}</span>
          {card.secret && <Badge tone="info">Secrète</Badge>}
        </span>
      ),
    },
    card.rarity && {
      term: 'Rareté',
      description: (
        <span className={styles.inline}>
          <RarityIcon rarity={card.rarity} />
          <span>{card.rarity.name}</span>
        </span>
      ),
    },
    card.type !== null && {
      term: pokemon ? 'Type' : 'Catégorie',
      description: (
        <span className={styles.inline}>
          <TypeIcon type={card.type} />
          <span>{CARD_TYPES.get(card.type)}</span>
        </span>
      ),
    },
    pokemon && {
      term: 'Pokémon',
      description: formatList(
        card.dexIds.map((id) => `${getSpecies(id)!.names.fr} (${formatDexNumber(id)})`),
      ),
    },
    card.illustrator && { term: 'Illustration', description: card.illustrator },
    card.versions.length > 0 && {
      term: 'Versions',
      description: (
        <span className={styles.tags}>
          {card.versions.map((version) => (
            <Tag key={version}>{version}</Tag>
          ))}
        </span>
      ),
    },
    card.english && { term: 'Nom anglais', description: card.english },
    card.german && { term: 'Nom allemand', description: card.german },
    card.set.released && { term: 'Sortie au Japon', description: formatDate(card.set.released) },
    pokemon && { term: 'Collection', description: placeText(place) },
  ]
  return rows.filter((row): row is DescriptionItem => !!row)
}

/** La carte dans la collection, en une phrase. */
function placeText({ mine, held, locked }: CollectionPlace) {
  if (mine) return `Dans votre collection, ${statusText(mine.status)}.`
  if (!held.length) return 'Pas encore dans votre collection.'
  const owners = held
    .map(
      ({ view, speciesIds }) =>
        `${speciesNames(speciesIds)} ${speciesIds.length > 1 ? 'ont' : 'a'} déjà sa carte : ${view.card.reference}, ${statusText(view.status)}`,
    )
    .join(' ; ')
  return locked
    ? `${owners}. Elle figure dans une commande : elle reste, pour que le registre tienne.`
    : `${owners}. L’ajouter ${held.length > 1 ? 'les' : 'la'} remplace, après confirmation.`
}

/**
 * « Ajouter à la collection » : la carte devient celle de tous ses Pokémon, à acheter (une carte
 * TAG TEAM, une seule fois pour tous). Si l'un d'eux a déjà la sienne, elle la remplace après
 * confirmation : l'ancienne part avec son statut et son prix payé (une carte TAG TEAM reste celle de
 * ses autres Pokémon) ; pas si une commande la retient. Déjà la leur : « Dans votre collection ».
 */
function AddToCollection({ card, place }: { card: SetCard; place: CollectionPlace }) {
  const act = useCollectionAction()
  const [confirming, setConfirming] = useState(false)
  const [added, setAdded] = useState(false)
  const done = useRef<HTMLSpanElement>(null)
  const { mine, held, locked } = place
  // Le bouton disparaît avec l'ajout : le focus va à ce qui le remplace (après la confirmation,
  // qui rend le focus en se fermant).
  useEffect(() => {
    if (added) done.current?.focus()
  }, [added])

  const add = () => {
    act(
      () => {
        const store = useCollectionStore.getState()
        for (const { view, speciesIds } of held) {
          for (const speciesId of speciesIds) store.removeCard(view.card.id, speciesId)
        }
        addCard(
          {
            id: newCardId(),
            dexIds: card.dexIds,
            reference: card.reference,
            image: card.image,
            ...(card.cardmarket !== undefined && { cardmarket: card.cardmarket }),
          },
          'none',
        )
      },
      held.length
        ? `Carte ${card.reference} ajoutée à ${speciesNames(card.dexIds)}, à acheter, à la place de ${formatList(held.map(({ view }) => view.card.reference))}.`
        : `Carte ${card.reference} ajoutée à ${speciesNames(card.dexIds)}, à acheter.`,
    )
    setAdded(true)
  }

  if (mine) {
    return (
      <span ref={done} tabIndex={-1} className={styles.done}>
        <Check size={16} aria-hidden="true" />
        Dans votre collection
      </span>
    )
  }
  return (
    <>
      <Button
        leftIcon={<Plus size={16} />}
        disabled={locked !== null}
        onClick={() => (held.length ? setConfirming(true) : add())}
      >
        Ajouter à la collection
      </Button>
      <ConfirmDialog
        open={confirming}
        title={
          held.length > 1
            ? 'Remplacer leurs cartes ?'
            : `Remplacer la carte de ${speciesNames(held[0]?.speciesIds ?? [])} ?`
        }
        confirmLabel="Remplacer"
        onConfirm={add}
        onClose={() => setConfirming(false)}
      >
        {held.map(({ view, speciesIds }) => {
          const others = view.card.dexIds.filter((id) => !speciesIds.includes(id))
          return (
            <p key={view.card.id}>
              {speciesNames(speciesIds)} {speciesIds.length > 1 ? 'ont' : 'a'} déjà sa carte :{' '}
              <strong>{view.card.reference}</strong>, {statusText(view.status)}.
              {others.length > 0 && ` Elle reste celle de ${speciesNames(others)}.`}
            </p>
          )
        })}
        <p>
          {held.length > 1
            ? 'Celle-ci les remplace, à acheter : le statut et le prix payé des anciennes partent avec elles.'
            : 'Celle-ci la remplace, à acheter : le statut et le prix payé de l’ancienne partent avec elle.'}
        </p>
      </ConfirmDialog>
    </>
  )
}
