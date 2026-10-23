import { Badge } from '@camply/ui'
import { Star } from '@camply/ui/icons'
import { CardArt } from '@/components/CardArt'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { cardLanguage } from '@/lib/collection'
import type { PokedexEntry } from '@/lib/pokedex'
import { AddCardButton } from './CardActions'
import styles from './CardList.module.css'

/** « ★ Favorite » : la carte que le Pokédex montre pour le Pokémon (la liste, le titre de la fiche). */
export function FavoriteBadge() {
  return (
    <Badge size="sm" tone="accent" icon={<Star size={12} fill="currentColor" />}>
      Favorite
    </Badge>
  )
}

/**
 * Les cartes du Pokémon, dans l'ordre d'ajout : chacune un bouton qui la montre en grand (sa petite
 * image, ou le dessin de l'espèce, sa référence, son drapeau), `shownId` celle montrée ; la favorite
 * marquée. Puis « Ajouter une carte », qui en ajoute une sans rien remplacer.
 */
export function CardList({
  entry,
  shownId,
  onShow,
}: {
  entry: PokedexEntry
  shownId: string
  onShow: (cardId: string) => void
}) {
  const { species } = entry

  return (
    <div className={styles.cards}>
      <ul className={styles.list} aria-label={`Cartes de ${species.names.fr}`}>
        {entry.cards.map(({ card }) => (
          <li key={card.id}>
            {/* Pas d'`aria-label` : le texte du bouton le nomme, « Favorite » compris. */}
            <button
              type="button"
              className={styles.card}
              aria-pressed={card.id === shownId}
              onClick={() => onShow(card.id)}
            >
              <CardArt card={card} speciesId={species.id} alt="" />
              <span className={styles.text}>
                <span className={styles.reference}>
                  {card.reference}
                  <LanguageFlag language={cardLanguage(card)} />
                </span>
                {entry.card?.card.id === card.id && <FavoriteBadge />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AddCardButton species={species} compact />
    </div>
  )
}
