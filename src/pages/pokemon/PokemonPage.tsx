import { Stack } from '@camply/ui'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { PossessionMark } from '@/components/PossessionMark'
import { usePokedex } from '@/hooks/usePokedex'
import { getSpecies } from '@/lib/species'
import { formatDexNumber, pageTitle } from '@/lib/format'
import type { PokedexEntry } from '@/lib/pokedex'
import { NotFoundPage } from '@/pages/NotFoundPage'
import type { CardStatus } from '@/types'
import { CardList } from './CardList'
import { CardSheet, EmptySheet } from './CardSheet'
import { CardStage } from './CardStage'
import { SpeciesAbout } from './SpeciesAbout'
import { SpeciesNav } from './SpeciesNav'
import { TypeChip } from './TypeChip'
import styles from './PokemonPage.module.css'

/** La fiche d'un Pokémon (`/pokemon/:id`) ; un numéro inconnu mène à la page introuvable. */
export function PokemonPage() {
  const { id = '' } = useParams()
  const entry = usePokedex().entryById.get(Number(id))
  return /^\d+$/.test(id) && entry ? <SpeciesPage entry={entry} /> : <NotFoundPage />
}

function SpeciesPage({ entry }: { entry: PokedexEntry }) {
  const { species } = entry
  const { entries } = usePokedex()
  const nextWithoutCard =
    entries.find((other) => other.species.id > species.id && !other.card)?.species ?? null

  // La carte montrée : celle choisie dans la liste, sinon la favorite. Une carte qui apparaît
  // (ajoutée, ou rétablie par « Annuler ») devient la carte montrée ; une carte montrée qui
  // disparaît laisse la place à la favorite.
  const [chosen, setChosen] = useState<string | null>(null)
  const [cards, setCards] = useState(entry.cards)
  if (cards !== entry.cards) {
    setCards(entry.cards)
    const added = entry.cards.find(({ card }) => !cards.some((known) => known.card.id === card.id))
    if (added) setChosen(added.card.id)
  }
  const shown = entry.cards.find(({ card }) => card.id === chosen) ?? entry.card

  // La carte montrée a changé sous le focus (ajoutée, retirée, rétablie) : le bouton ou la fenêtre
  // qui l'avait a disparu avec l'ancien panneau, le focus va au titre du nouveau. Seulement s'il
  // était perdu : une carte choisie dans la liste le garde, un changement venu d'un autre onglet ne
  // le déplace pas.
  const sheetTitle = useRef<HTMLHeadingElement>(null)
  const shownId = shown?.card.id ?? null
  const shownBefore = useRef(shownId)
  useEffect(() => {
    if (shownBefore.current === shownId) return
    shownBefore.current = shownId
    if (document.activeElement === null || document.activeElement === document.body) {
      sheetTitle.current?.focus()
    }
  }, [shownId])

  return (
    <div className="container">
      <title>{pageTitle(species.names.fr)}</title>
      <SpeciesNav
        species={species}
        previous={getSpecies(species.id - 1)}
        next={getSpecies(species.id + 1)}
      />

      <div className={styles.layout}>
        <Stack as="header" gap={3} align="start" className={styles.head}>
          <h1 className={styles.name}>{species.names.fr}</h1>
          <p className={styles.identity}>
            <span className="numeric">{formatDexNumber(species.id)}</span>
            {species.names.ja && <span lang="ja">{species.names.ja}</span>}
            {species.names.en !== species.names.fr && <span lang="en">{species.names.en}</span>}
          </p>
          <Stack direction="horizontal" gap={2} wrap>
            {species.types.map((type) => (
              <TypeChip key={type} type={type} />
            ))}
          </Stack>
          <PossessionStatement entry={entry} />
          {shown && <CardList entry={entry} shownId={shown.card.id} onShow={setChosen} />}
        </Stack>

        <div className={styles.stage}>
          <CardStage view={shown} species={species} />
        </div>

        <div className={styles.body}>
          <div className={styles.columns}>
            {/* Une clé par carte : une saisie en cours ne passe pas d'une carte à l'autre. */}
            {shown ? (
              <CardSheet
                key={shown.card.id}
                view={shown}
                entry={entry}
                nextWithoutCard={nextWithoutCard}
                titleRef={sheetTitle}
              />
            ) : (
              <EmptySheet species={species} titleRef={sheetTitle} />
            )}
            <SpeciesAbout species={species} showArtwork={shown === null} />
          </div>
        </div>
      </div>
    </div>
  )
}

const STATEMENTS: Record<CardStatus | 'none' | 'several' | 'no-card', string> = {
  owned: 'carte possédée',
  ordered: 'carte commandée',
  none: 'carte choisie, pas encore obtenue',
  several: 'cartes choisies, aucune encore obtenue',
  'no-card': 'pas encore de carte',
}

/** « Débloqué : carte possédée. » D'après toutes les cartes du Pokémon, pas seulement sa favorite. */
function PossessionStatement({ entry }: { entry: PokedexEntry }) {
  const { status, cards } = entry
  const statement = status ?? (cards.length > 1 ? 'several' : cards.length ? 'none' : 'no-card')
  return (
    <p className={styles.statement}>
      <span className={styles.statementMark}>
        <PossessionMark status={status} />
      </span>
      <span>
        <strong>{entry.unlocked ? 'Débloqué' : 'À débloquer'}</strong> : {STATEMENTS[statement]}.
      </span>
    </p>
  )
}
