import { Stack } from '@camply/ui'
import { useRef, useState } from 'react'
import { useParams } from 'react-router'
import { PossessionMark } from '@/components/PossessionMark'
import { usePokedex } from '@/hooks/usePokedex'
import { getSpecies, indexCardsFor } from '@/lib/catalog'
import { formatDexNumber, pageTitle, plural } from '@/lib/format'
import { speciesStatus, type PokedexEntry } from '@/lib/pokedex'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CandidateGallery } from './CandidateGallery'
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
  const { species, candidates } = entry
  const stage = useRef<HTMLDivElement>(null)

  // La carte affichée en grand : la représentante à l'arrivée, puis celle choisie dans la
  // galerie. Fixée à l'arrivée : retirer le favori ne doit pas faire sauter à une autre carte.
  const [viewedId, setViewedId] = useState(() => entry.representative?.card.id ?? null)
  const viewed =
    candidates.find((candidate) => candidate.card.id === viewedId) ?? entry.representative

  const viewCard = (cardId: string) => {
    setViewedId(cardId)
    // Sur téléphone, la carte en grand est au-dessus de la galerie : on y remonte.
    if (matchMedia('(max-width: 40rem)').matches)
      stage.current?.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
  }

  return (
    <div className="container">
      <title>{pageTitle(species.names.fr)}</title>
      <SpeciesNav previous={getSpecies(species.id - 1)} next={getSpecies(species.id + 1)} />

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

        <div ref={stage} className={styles.stage}>
          <CardStage candidate={viewed} species={species} />
        </div>

        <div className={styles.body}>
          <div className={styles.columns}>
            {/* Une clé par carte : une saisie en cours ne passe pas d'une carte à l'autre. */}
            {viewed ? (
              <CardSheet key={viewed.card.id} candidate={viewed} species={species} />
            ) : (
              <EmptySheet known={indexCardsFor(species.id).length > 0} />
            )}
            <SpeciesAbout species={species} showArtwork={viewed === null} />
          </div>

          {candidates.length > 1 && (
            <CandidateGallery
              candidates={candidates}
              speciesId={species.id}
              viewedId={viewed?.card.id ?? null}
              onView={viewCard}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** « Débloqué : 1 carte possédée, 2 souhaitées. » */
function PossessionStatement({ entry }: { entry: PokedexEntry }) {
  const { owned, ordered, wanted } = entry.statusCounts
  const counts = [
    owned ? plural(owned, 'carte possédée', 'cartes possédées') : 'aucune carte possédée',
    ordered > 0 && plural(ordered, 'commandée', 'commandées'),
    wanted > 0 && plural(wanted, 'souhaitée', 'souhaitées'),
  ].filter(Boolean)

  return (
    <p className={styles.statement}>
      <span className={styles.statementMark}>
        <PossessionMark status={speciesStatus(entry)} />
      </span>
      <span>
        <strong>{entry.unlocked ? 'Débloqué' : 'À débloquer'}</strong> : {counts.join(', ')}.
      </span>
    </p>
  )
}
