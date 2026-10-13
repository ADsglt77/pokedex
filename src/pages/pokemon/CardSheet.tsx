import { Button, DescriptionList, Stack } from '@camply/ui'
import { ExternalLink as ExternalIcon, Plus } from '@camply/ui/icons'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink } from '@/components/ExternalLink'
import { loadCatalog } from '@/lib/card-catalog'
import { cardmarketPage } from '@/lib/cardmarket'
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
  const page = cardmarketPage(card)
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
      {page && (
        <p>
          <ExternalLink href={page}>
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
  // Le catalogue, préparé quand le navigateur a le temps (au plus tard 2 s après) : la fenêtre
  // d'ajout s'ouvre sans attendre. Safari n'a pas `requestIdleCallback`.
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => void loadCatalog(), { timeout: 2000 })
    } else setTimeout(() => void loadCatalog(), 1000)
  }, [])
  return (
    <Stack as="section" gap={6} className={styles.sheet} aria-labelledby="sheet-title">
      <h2 id="sheet-title" className={styles.title}>
        Carte à choisir
      </h2>
      <p className="muted">
        Choisissez la carte que vous voulez pour {species.names.fr} parmi ses cartes japonaises,
        avec leur image et leur prix, ou saisissez-la à la main. Depuis Cardmarket, le favori
        «&nbsp;Ajouter au Pokédex&nbsp;» l’ajoute aussi : installez-le depuis la{' '}
        <Link to="/donnees">page Données</Link>.
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
