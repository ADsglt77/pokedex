import { Stack } from '@camply/ui'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { PossessionMark } from '@/components/PossessionMark'
import { usePokedex } from '@/hooks/usePokedex'
import { getSpecies } from '@/lib/species'
import { formatDexNumber, pageTitle } from '@/lib/format'
import type { PokedexEntry } from '@/lib/pokedex'
import { NotFoundPage } from '@/pages/NotFoundPage'
import type { CardStatus } from '@/types'
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
  const { species, card } = entry
  const { entries } = usePokedex()
  const nextWithoutCard =
    entries.find((other) => other.species.id > species.id && !other.card)?.species ?? null

  // La carte ajoutée, retirée ou rétablie (« Annuler ») : le bouton ou la fenêtre qui avait le
  // focus a disparu avec l'ancien panneau, le focus va au titre du nouveau. Seulement s'il était
  // perdu : un changement venu d'un autre onglet ne le déplace pas.
  const sheetTitle = useRef<HTMLHeadingElement>(null)
  const cardId = card?.card.id ?? null
  const shownCard = useRef(cardId)
  useEffect(() => {
    if (shownCard.current === cardId) return
    shownCard.current = cardId
    if (document.activeElement === null || document.activeElement === document.body) {
      sheetTitle.current?.focus()
    }
  }, [cardId])

  return (
    <div className="container">
      <title>{pageTitle(species.names.fr)}</title>
      <SpeciesNav
        species={species}
        previous={getSpecies(species.id - 1)}
        next={getSpecies(species.id + 1)}
        nextWithoutCard={nextWithoutCard}
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
        </Stack>

        <div className={styles.stage}>
          <CardStage view={card} species={species} />
        </div>

        <div className={styles.body}>
          <div className={styles.columns}>
            {/* Une clé par carte : une saisie en cours ne passe pas d'une carte à l'autre. */}
            {card ? (
              <CardSheet key={card.card.id} view={card} species={species} titleRef={sheetTitle} />
            ) : (
              <EmptySheet species={species} titleRef={sheetTitle} />
            )}
            <SpeciesAbout species={species} showArtwork={card === null} />
          </div>
        </div>
      </div>
    </div>
  )
}

const STATEMENTS: Record<CardStatus | 'none' | 'no-card', string> = {
  owned: 'carte possédée',
  ordered: 'carte commandée',
  wanted: 'carte souhaitée',
  none: 'carte choisie, pas encore obtenue',
  'no-card': 'pas encore de carte',
}

/** « Débloqué : carte possédée. » */
function PossessionStatement({ entry }: { entry: PokedexEntry }) {
  const status = entry.card?.status ?? null
  return (
    <p className={styles.statement}>
      <span className={styles.statementMark}>
        <PossessionMark status={status} />
      </span>
      <span>
        <strong>{entry.unlocked ? 'Débloqué' : 'À débloquer'}</strong> :{' '}
        {STATEMENTS[entry.card ? (status ?? 'none') : 'no-card']}.
      </span>
    </p>
  )
}
