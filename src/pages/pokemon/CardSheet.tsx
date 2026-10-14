import { Button, Stack } from '@camply/ui'
import { Plus } from '@camply/ui/icons'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { loadCatalog } from '@/lib/card-catalog'
import { statusCaption } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import { CardActions } from './CardActions'
import { CardForm } from './CardForm'
import { CardPrice } from './CardPrice'
import { PurchaseSection } from './PurchaseSection'
import styles from './CardSheet.module.css'

/**
 * La fiche de la carte du Pokémon, en trois temps séparés d'un filet : ce que l'utilisateur en
 * fait (statut, prix payé), ce qu'elle vaut chez Cardmarket, son achat.
 */
export function CardSheet({ view, species }: { view: CardView; species: PokemonSpecies }) {
  const { card } = view
  return (
    <Stack as="section" gap={6} className={styles.sheet} aria-labelledby="sheet-title">
      <Stack as="header" gap={2} align="start">
        <h2 id="sheet-title">Carte {card.reference}</h2>
        <p className="muted">{statusCaption(view.status, view.acquiredAt)}</p>
      </Stack>

      {/* Les actions d'abord : sur téléphone, « Je possède cette carte » reste près de l'écran. */}
      <CardActions view={view} species={species} />
      <CardPrice card={card} />
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
      <h2 id="sheet-title">Carte à choisir</h2>
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
