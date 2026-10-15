import { Button } from '@camply/ui'
import { Plus } from '@camply/ui/icons'
import { useEffect, useState, type Ref } from 'react'
import { Panel } from '@/components/Panel'
import { loadCatalog } from '@/lib/card-catalog'
import { statusCaption } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import type { PokemonSpecies } from '@/types'
import { CardActions } from './CardActions'
import { CardForm } from './CardForm'
import { PricePanel } from './PricePanel'
import { PurchaseSection } from './PurchaseSection'
import styles from './CardSheet.module.css'

/**
 * La fiche de la carte du Pokémon, en trois panneaux : ce que l'utilisateur en fait (statut, prix
 * payé), ce qu'elle vaut chez Cardmarket, son achat. `titleRef` : le titre du premier, qui reçoit
 * le focus quand la carte vient d'être ajoutée.
 */
export function CardSheet({
  view,
  species,
  titleRef,
}: {
  view: CardView
  species: PokemonSpecies
  titleRef: Ref<HTMLHeadingElement>
}) {
  const { card } = view
  return (
    <div className={styles.sheet}>
      {/* Les actions d'abord : sur téléphone, « Je possède cette carte » reste près de l'écran. */}
      <Panel
        title={`Carte ${card.reference}`}
        description={statusCaption(view.status, view.acquiredAt)}
        titleRef={titleRef}
      >
        <CardActions view={view} species={species} />
      </Panel>
      <PricePanel card={card} />
      <PurchaseSection view={view} />
    </div>
  )
}

/**
 * Pas encore de carte : l'utilisateur ajoute celle qu'il veut pour ce Pokémon. `titleRef` : le
 * titre, qui reçoit le focus quand la carte vient d'être retirée.
 */
export function EmptySheet({
  species,
  titleRef,
}: {
  species: PokemonSpecies
  titleRef: Ref<HTMLHeadingElement>
}) {
  const [adding, setAdding] = useState(false)
  // Le catalogue, préparé quand le navigateur a le temps (au plus tard 2 s après) : la fenêtre
  // d'ajout s'ouvre sans attendre. Safari n'a pas `requestIdleCallback`.
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => void loadCatalog(), { timeout: 2000 })
    } else setTimeout(() => void loadCatalog(), 1000)
  }, [])
  return (
    <Panel title="Carte à choisir" titleRef={titleRef}>
      <p className="muted">
        Choisissez la carte que vous voulez pour {species.names.fr} parmi ses cartes japonaises,
        avec leur image et leur prix, ou saisissez-la à la main.
      </p>
      <div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
          Ajouter une carte
        </Button>
      </div>
      {adding && <CardForm species={species} card={null} onClose={() => setAdding(false)} />}
    </Panel>
  )
}
