import { memo, useState } from 'react'
import { CardArt } from '@/components/CardArt'
import { PossessionMark } from '@/components/PossessionMark'
import { SeriesCard } from '@/components/SeriesCard'
import { useGrowingList } from '@/hooks/useGrowingList'
import { referenceCode, referenceName } from '@/lib/card-code'
import { describeCard } from '@/lib/pokedex'
import type { CardStatus, CollectionData, PokemonCard, SeriesCollection } from '@/types'
import styles from './SeriesGrid.module.css'

/** Ce que dit une carte de son statut, pour le lecteur d'écran. */
const STATUS_LABELS: Record<CardStatus | 'none', string> = {
  owned: 'possédée',
  ordered: 'commandée',
  none: 'à débloquer',
}

/** Les cartes dessinées d'un coup : plus qu'un grand écran n'en montre. */
const TILES_STEP = 60

/**
 * Les cartes d'une collection d'extension (`series`, lue dans `collection`), dans l'ordre de
 * l'extension : chacune en couleur une fois possédée, en grisé sinon (`CardArt` `locked`), avec sa
 * marque de statut, son numéro et son nom. `linked` : la page de la collection, où choisir une
 * carte ouvre sa fenêtre (`SeriesCard`), celle d'`opened` (son id) ouverte d'emblée ; faux sur le
 * Pokédex public, où chacune est une image décrite. Une extension compte des centaines de cartes :
 * dessinées au fur et à mesure (`useGrowingList`), seules celles à l'écran le sont
 * (`content-visibility`), et une carte ne se redessine que si elle ou son statut change.
 */
export function SeriesGrid({
  collection,
  series,
  linked,
  opened = null,
}: {
  collection: CollectionData
  series: SeriesCollection
  linked: boolean
  opened?: string | null
}) {
  // La carte dont la fenêtre est ouverte (son id) ; `null` : aucune.
  const [open, setOpen] = useState(opened)
  const { limit, sentinel, more } = useGrowingList(series.cards.length, TILES_STEP)
  return (
    <div className="growing">
      <ul className={styles.grid}>
        {series.cards.slice(0, limit).map((id) => (
          <li key={id}>
            <SeriesTile
              card={collection.customCards[id]!}
              status={collection.cards[id]?.status ?? null}
              onOpen={linked ? setOpen : undefined}
            />
          </li>
        ))}
      </ul>
      {more && <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />}
      {open && (
        <SeriesCard
          view={describeCard(collection.customCards[open]!, collection)}
          series={series}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

/**
 * Une carte de la grille : un bouton qui ouvre sa fenêtre (`onOpen`, une fonction stable), sinon une
 * image décrite. Mémoïsée : une carte qui change de statut ne redessine pas les autres.
 */
const SeriesTile = memo(function SeriesTile({
  card,
  status,
  onOpen,
}: {
  card: PokemonCard
  status: CardStatus | null
  onOpen?: (id: string) => void
}) {
  const number = referenceCode(card.reference)?.number ?? ''
  const name = referenceName(card.reference)
  const label = `${number} ${name}, ${STATUS_LABELS[status ?? 'none']}`.trim()
  const content = (
    <>
      <CardArt
        card={card}
        speciesId={card.dexIds[0]}
        alt=""
        locked={status !== 'owned'}
        className={styles.art}
      >
        <PossessionMark status={status} />
      </CardArt>
      <span className={styles.number}>{number}</span>
      <span className={styles.name}>{name}</span>
    </>
  )
  return onOpen ? (
    <button
      type="button"
      className={styles.tile}
      aria-label={label}
      onClick={() => onOpen(card.id)}
    >
      {content}
    </button>
  ) : (
    <div className={styles.tile} role="img" aria-label={label}>
      {content}
    </div>
  )
})
