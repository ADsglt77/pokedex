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
import { PricePanel } from '@/components/PricePanel'
import { CARD_TYPES } from '@/config/catalog'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import { isCatalogCard, languageField, type SetCard } from '@/lib/card-catalog'
import { newCardId } from '@/lib/collection'
import { details, formatDate, formatDexNumber, formatList, statusLabel } from '@/lib/format'
import { getSpecies, speciesNames } from '@/lib/species'
import { addCard } from '@/store/collection'
import type { CardStatus } from '@/types'
import styles from './CardDetails.module.css'

/** « possédée », « commandée », « à acheter ». */
const statusText = (status: CardStatus | null) =>
  status ? statusLabel(status).toLowerCase() : 'à acheter'

/**
 * Où en est la carte dans la collection : la carte de la collection qui est celle-ci (`mine`),
 * parmi toutes les cartes de ses Pokémon, ou ceux de ses Pokémon qui ont déjà des cartes
 * (`holders`) : l'ajout s'y ajoute, sans rien remplacer.
 */
function useCollectionPlace(card: SetCard) {
  const { entryById } = usePokedex()
  const entries = card.dexIds.map((id) => entryById.get(id)!)
  const mine =
    entries.flatMap(({ cards }) => cards).find((view) => isCatalogCard(view.card, card)) ?? null
  const holders = entries.filter(({ cards }) => cards.length > 0).map(({ species }) => species.id)
  return { mine, holders }
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
            card={{
              cardmarket: card.cardmarket,
              reference: card.reference,
              ...languageField(card),
            }}
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
    card.set.released && {
      term: card.set.language === 'fr' ? 'Sortie en France' : 'Sortie au Japon',
      description: formatDate(card.set.released),
    },
    pokemon && { term: 'Collection', description: placeText(place) },
  ]
  return rows.filter((row): row is DescriptionItem => !!row)
}

/** La carte dans la collection, en une phrase. */
function placeText({ mine, holders }: CollectionPlace) {
  if (mine) return `Dans votre collection, ${statusText(mine.status)}.`
  if (!holders.length) return 'Pas encore dans votre collection.'
  const several = holders.length > 1
  return `${speciesNames(holders)} ${several ? 'ont' : 'a'} déjà des cartes : celle-ci s’y ajoute, à acheter, sans changer ${several ? 'leur' : 'sa'} favorite.`
}

/**
 * « Ajouter à la collection » : la carte s'ajoute à tous ses Pokémon, à acheter (une carte TAG
 * TEAM, une seule fois pour tous), sans rien remplacer : celles qu'ils ont déjà restent, leur
 * favorite aussi ; un Pokémon sans carte la reçoit pour favorite (`addCard`). Rien ne la retient,
 * pas même une commande. Déjà dans la collection : « Dans votre collection ».
 */
function AddToCollection({ card, place }: { card: SetCard; place: CollectionPlace }) {
  const act = useCollectionAction()
  const [added, setAdded] = useState(false)
  const done = useRef<HTMLSpanElement>(null)
  const { mine } = place
  // Le bouton disparaît avec l'ajout : le focus va à ce qui le remplace.
  useEffect(() => {
    if (added) done.current?.focus()
  }, [added])

  const add = () => {
    act(
      () =>
        addCard(
          {
            id: newCardId(),
            dexIds: card.dexIds,
            reference: card.reference,
            image: card.image,
            ...(card.cardmarket !== undefined && { cardmarket: card.cardmarket }),
            ...languageField(card),
          },
          'none',
        ),
      `Carte ${card.reference} ajoutée à ${speciesNames(card.dexIds)}, à acheter.`,
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
    <Button leftIcon={<Plus size={16} />} onClick={add}>
      Ajouter à la collection
    </Button>
  )
}
