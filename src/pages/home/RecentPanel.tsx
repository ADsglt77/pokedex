import { Button } from '@camply/ui'
import { useState } from 'react'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { Panel } from '@/components/Panel'
import { usePokedex } from '@/hooks/usePokedex'
import { cardPath, pokedexUrl, speciesPath } from '@/lib/filters'
import { formatDate } from '@/lib/format'
import type { RecentCard } from '@/lib/pokedex'
import { seriesOf } from '@/lib/series'
import { cardTitle } from '@/lib/species'
import { useCollectionStore } from '@/store/collection'
import type { PokemonCard } from '@/types'
import page from './HomePage.module.css'
import styles from './RecentPanel.module.css'

/** Les cartes de la rangée de l'accueil : le panneau en montre autant que sa largeur en tient. */
const SHOWN_CARDS = 10

/**
 * Les dernières cartes obtenues (`cards` : toutes, les plus récentes d'abord ; le panneau en montre
 * `SHOWN_CARDS`) ; celles qui arrivent pendant qu'on regarde (obtenues, ou venues d'un autre
 * appareil) sont « distribuées » une à une, pas celles du premier affichage : l'accueil se remonte
 * à chaque visite, la donne se rejouerait chaque fois.
 */
export function RecentPanel({ cards }: { cards: RecentCard[] }) {
  const shown = cards.slice(0, SHOWN_CARDS)
  const collection = useCollectionStore((state) => state.collection)
  const [first] = useState(() => new Set(shown.map((recent) => recent.card.id)))
  let dealt = 0
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
        {shown.map((recent) => {
          const [speciesId] = recent.card.dexIds
          const date = formatDate(recent.acquiredAt)
          const deal = !first.has(recent.card.id)
          return (
            <li
              key={recent.card.id}
              className={deal ? styles.dealt : undefined}
              style={deal ? { animationDelay: `${dealt++ * 70}ms` } : undefined}
            >
              <CardLink
                card={recent.card}
                to={cardPath(recent.card, seriesOf(collection, recent.card.id))}
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

/**
 * Une carte de l'accueil, qui mène à sa page (`to` : la fiche de son Pokémon, ou la page de sa
 * collection d'extension, `cardPath`) ; sans page (`null` : un dresseur ou une énergie d'aucune
 * collection), elle ne mène nulle part. `speciesId` : le Pokémon de son dessin de substitution.
 * `locked` : pas encore obtenue.
 */
function CardLink({
  card,
  to,
  speciesId,
  name,
  hint,
  locked,
}: {
  card: PokemonCard
  to: string | null
  speciesId: number | undefined
  name: string
  hint: string
  locked?: boolean
}) {
  const content = (
    <>
      <CardArt card={card} speciesId={speciesId} alt="" locked={locked} eager />
      <span className={styles.cardName}>{name}</span>
      <span className="hint">{hint}</span>
    </>
  )
  return to === null ? (
    <span className={styles.card}>{content}</span>
  ) : (
    <Link to={to} className={styles.card}>
      {content}
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
              to={speciesPath(species.id)}
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
