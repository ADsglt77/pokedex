import { Button } from '@camply/ui'
import { ArrowRight } from '@camply/ui/icons'
import type { Ref } from 'react'
import { Link } from 'react-router'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { Panel } from '@/components/Panel'
import { PricePanel } from '@/components/PricePanel'
import { cardLanguage } from '@/lib/collection'
import { speciesPath } from '@/lib/filters'
import { details, statusCaption } from '@/lib/format'
import type { CardView, PokedexEntry } from '@/lib/pokedex'
import { otherSpeciesNames } from '@/lib/species'
import type { PokemonSpecies } from '@/types'
import { AddCardButton, CardActions } from './CardActions'
import { FavoriteBadge } from './CardList'
import styles from './CardSheet.module.css'

/**
 * La fiche de la carte montrée du Pokémon (`view`, l'une des cartes de `entry`), en deux panneaux :
 * ce que l'utilisateur en fait (statut, prix payé, favorite), ce qu'elle vaut chez Cardmarket.
 * `titleRef` : le titre du premier, qui reçoit le focus quand la carte montrée vient de changer
 * sous lui (ajoutée, retirée, rétablie).
 */
export function CardSheet({
  view,
  entry,
  nextWithoutCard,
  titleRef,
}: {
  view: CardView
  entry: PokedexEntry
  nextWithoutCard: PokemonSpecies | null
  titleRef: Ref<HTMLHeadingElement>
}) {
  const { species } = entry
  const { card } = view
  return (
    <div className={styles.sheet}>
      {/* Les actions d'abord : sur téléphone, « Je possède cette carte » reste près de l'écran. */}
      <Panel
        title={
          <>
            Carte {card.reference}
            <LanguageFlag language={cardLanguage(card)} />
            {entry.card?.card.id === card.id && (
              <span className={styles.favorite}>
                <FavoriteBadge />
              </span>
            )}
          </>
        }
        description={details(
          statusCaption(view.status, view.acquiredAt),
          // Une carte TAG TEAM : la même, achetée une fois, pour ses autres Pokémon.
          card.dexIds.length > 1 && `aussi celle de ${otherSpeciesNames(card.dexIds, species.id)}`,
        )}
        titleRef={titleRef}
      >
        <CardActions view={view} entry={entry} />
        {nextWithoutCard && (
          <div className={styles.next}>
            <Button asChild variant="soft" size="sm" rightIcon={<ArrowRight size={16} />}>
              <Link to={speciesPath(nextWithoutCard.id)}>
                Suivant sans carte : {nextWithoutCard.names.fr}
              </Link>
            </Button>
          </div>
        )}
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
  return (
    <Panel title="Carte à choisir" titleRef={titleRef}>
      <p className="muted">
        Choisissez la carte que vous voulez pour {species.names.fr} parmi ses cartes japonaises ou
        françaises, avec leur image et leur prix, ou saisissez-la à la main.
      </p>
      <AddCardButton species={species} />
    </Panel>
  )
}
