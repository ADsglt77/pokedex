import { Button } from '@camply/ui'
import { Plus } from '@camply/ui/icons'
import { useEffect, useState, type Ref } from 'react'
import { Panel } from '@/components/Panel'
import { PricePanel } from '@/components/PricePanel'
import { loadSpeciesCards } from '@/lib/card-catalog'
import { details, statusCaption } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import { otherSpeciesNames } from '@/lib/species'
import type { PokemonSpecies } from '@/types'
import { CardActions } from './CardActions'
import { CardForm } from './CardForm'
import styles from './CardSheet.module.css'

/**
 * La fiche de la carte du Pokémon, en deux panneaux : ce que l'utilisateur en fait (statut, prix
 * payé), ce qu'elle vaut chez Cardmarket. `titleRef` : le titre du premier, qui reçoit
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
        description={details(
          statusCaption(view.status, view.acquiredAt),
          // Une carte TAG TEAM : la même, achetée une fois, pour ses autres Pokémon.
          card.dexIds.length > 1 && `aussi celle de ${otherSpeciesNames(card.dexIds, species.id)}`,
        )}
        titleRef={titleRef}
      >
        <CardActions view={view} species={species} />
      </Panel>
      <PricePanel
        card={card}
        paid={view.paidPrice}
        withoutId="Pas de prix : ajoutez l’id Cardmarket de la carte (« Modifier la carte »)."
      />
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
  // Ses cartes du catalogue, préparées quand le navigateur a le temps (au plus tard 2 s après) :
  // la fenêtre d'ajout s'ouvre sans attendre. Safari n'a pas `requestIdleCallback`.
  useEffect(() => {
    const load = () => void loadSpeciesCards(species.id)
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2000 })
    else setTimeout(load, 1000)
  }, [species.id])
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
