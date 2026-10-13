import { Button, DescriptionList, Stack } from '@camply/ui'
import { ExternalLink as ExternalIcon, Plus } from '@camply/ui/icons'
import { useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink } from '@/components/ExternalLink'
import { statusCaption } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import { CardActions } from './CardActions'
import { CardForm } from './CardForm'
import { CardPrice } from './CardPrice'
import { PurchaseSection } from './PurchaseSection'
import styles from './CardSheet.module.css'

/** La fiche de la carte du Pokémon : ce qu'elle est, et ce que l'utilisateur en fait. */
export function CardSheet({ view, species }: { view: CardView; species: PokemonSpecies }) {
  const { card } = view
  return (
    <Stack as="section" gap={6} className={styles.sheet} aria-labelledby="sheet-title">
      <Stack as="header" gap={2} align="start">
        <h2 id="sheet-title" className={styles.title}>
          Carte {card.reference}
        </h2>
        <p className={styles.status}>{statusCaption(view.status, view.acquiredAt)}</p>
      </Stack>

      {card.cardmarket !== undefined && (
        <DescriptionList items={[{ term: 'Id Cardmarket', description: card.cardmarket }]} />
      )}
      {card.page && (
        <p>
          <ExternalLink href={card.page}>
            Voir sur Cardmarket <ExternalIcon size={13} aria-hidden="true" />
          </ExternalLink>
        </p>
      )}
      <CardPrice card={card} />
      <CardActions view={view} species={species} />
      <PurchaseSection view={view} />
    </Stack>
  )
}

/** Pas encore de carte : l'utilisateur ajoute celle qu'il veut pour ce Pokémon. */
export function EmptySheet({ species }: { species: PokemonSpecies }) {
  const [adding, setAdding] = useState(false)
  return (
    <Stack as="section" gap={6} className={styles.sheet} aria-labelledby="sheet-title">
      <h2 id="sheet-title" className={styles.title}>
        Carte à choisir
      </h2>
      <p className="muted">
        Ajoutez la carte que vous voulez pour {species.names.fr} : sa référence (« Bulbizarre (sv2a
        166) »), qui sert à trouver son image, et son id Cardmarket pour suivre son prix. Depuis
        Cardmarket, le favori « Ajouter au Pokédex » (<Link to="/donnees">page Données</Link>)
        remplit tout.
      </p>
      <div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
          Ajouter une carte
        </Button>
      </div>
      {adding && <CardForm species={species} card={null} onClose={() => setAdding(false)} />}
    </Stack>
  )
}
