import { DescriptionList, Modal, Stack, type DescriptionItem } from '@camply/ui'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { CardStatusControls } from '@/components/CardStatusControls'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { PricePanel } from '@/components/PricePanel'
import { cardLanguage } from '@/lib/collection'
import { speciesPath } from '@/lib/filters'
import { statusCaption } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import { getSpecies } from '@/lib/species'
import type { SeriesCollection } from '@/types'
import styles from './SeriesCard.module.css'

/**
 * La fenêtre d'une carte d'une collection d'extension, ouverte depuis sa page (`SeriesGrid`) : son
 * image, sa référence et sa langue, son statut et ses Pokémon (chacun vers sa fiche ; aucun pour un
 * dresseur, une énergie), ce qu'on en fait (`CardStatusControls`, comme sur la fiche d'un Pokémon :
 * possédée, la case devient une carte de ses Pokémon) et son prix Cardmarket (`PricePanel`).
 */
export function SeriesCard({
  view,
  series,
  onClose,
}: {
  view: CardView
  series: SeriesCollection
  onClose: () => void
}) {
  const { card } = view
  const facts: DescriptionItem[] = [
    { term: 'Statut', description: statusCaption(view.status, view.acquiredAt) },
  ]
  if (card.dexIds.length > 0) {
    facts.push({ term: 'Pokémon', description: <SpeciesLinks ids={card.dexIds} /> })
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title={
        <>
          {card.reference}
          <LanguageFlag language={cardLanguage(card)} />
        </>
      }
      description={`Collection ${series.name}`}
    >
      <div className={styles.sheet}>
        <CardArt
          card={card}
          speciesId={card.dexIds[0]}
          alt={`Carte ${card.reference}`}
          large
          eager
          className={styles.art}
        />
        <Stack gap={5} className={styles.info}>
          <DescriptionList items={facts} />
          <CardStatusControls view={view} />
          <PricePanel card={card} paid={view.paidPrice} headingLevel={3} />
        </Stack>
      </div>
    </Modal>
  )
}

/** Les Pokémon d'une carte, chacun vers sa fiche : « Pikachu et Zekrom ». */
function SpeciesLinks({ ids }: { ids: number[] }) {
  return ids.map((id, index) => (
    <Fragment key={id}>
      {index > 0 && (index === ids.length - 1 ? ' et ' : ', ')}
      <Link to={speciesPath(id)}>{getSpecies(id)!.names.fr}</Link>
    </Fragment>
  ))
}
