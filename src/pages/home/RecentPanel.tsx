import { Button } from '@camply/ui'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { Panel } from '@/components/Panel'
import { usePokedex } from '@/hooks/usePokedex'
import { pokedexUrl, speciesPath } from '@/lib/filters'
import { formatDate } from '@/lib/format'
import type { RecentCard } from '@/lib/pokedex'
import { cardTitle } from '@/lib/species'
import type { PokemonCard } from '@/types'
import page from './HomePage.module.css'
import styles from './RecentPanel.module.css'

/** Les cartes de la rangée de l'accueil : le panneau en montre autant que sa largeur en tient. */
export const SHOWN_CARDS = 10

/** Les dernières cartes obtenues, « distribuées » une à une à l'arrivée. */
export function RecentPanel({ cards }: { cards: RecentCard[] }) {
  return (
    <Panel
      title="Dernières cartes obtenues"
      className={page.wide}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to={pokedexUrl({ possession: 'owned' })}>Voir les Pokémon débloqués</Link>
        </Button>
      }
    >
      <ul className={styles.cards}>
        {cards.map((recent, index) => {
          const speciesId = recent.card.dexIds[0]!
          const date = formatDate(recent.acquiredAt)
          return (
            <li
              key={recent.card.id}
              className={styles.dealt}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <CardLink
                card={recent.card}
                speciesId={speciesId}
                name={cardTitle(recent.card)}
                hint={date ? `Obtenue le ${date}` : recent.card.reference}
              />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/** Une carte de l'accueil, qui mène à la fiche de son Pokémon ; `locked` : pas encore obtenue. */
function CardLink({
  card,
  speciesId,
  name,
  hint,
  locked,
}: {
  card: PokemonCard
  speciesId: number
  name: string
  hint: string
  locked?: boolean
}) {
  return (
    <Link to={speciesPath(speciesId)} className={styles.card}>
      <CardArt card={card} speciesId={speciesId} alt="" locked={locked} eager />
      <span className={styles.cardName}>{name}</span>
      <span className="hint">{hint}</span>
    </Link>
  )
}

/** Aucune carte obtenue, mais des cartes choisies : les premières, à obtenir. */
export function Chosen() {
  const { entries } = usePokedex()
  const chosen = entries.filter((entry) => entry.card?.card.image).slice(0, SHOWN_CARDS)
  if (chosen.length === 0) return null
  return (
    <Panel
      title="Vos cartes choisies"
      description="Marquez-les « possédées » quand vous les avez : leur Pokémon est débloqué."
      className={page.wide}
    >
      <ul className={styles.cards}>
        {chosen.map(({ species, card }) => (
          <li key={species.id}>
            <CardLink
              card={card!.card}
              speciesId={species.id}
              name={species.names.fr}
              hint={card!.card.reference}
              locked
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}
