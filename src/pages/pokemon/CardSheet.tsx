import { Badge, Button, DescriptionList, Stack, type DescriptionItem } from '@camply/ui'
import { Star } from '@camply/ui/icons'
import { Link } from 'react-router'
import { RarityTag } from '@/components/RarityTag'
import type { CardView } from '@/lib/candidates'
import { setLabel, statusCaption } from '@/lib/format'
import type { PokemonCard, PokemonSpecies } from '@/types'
import { CardActions } from './CardActions'
import { CardPrice } from './CardPrice'
import { PurchaseSection } from './PurchaseSection'
import styles from './CardSheet.module.css'

/** Ce qu'on sait d'une carte, sans ligne vide. */
function CardFacts({ card }: { card: PokemonCard }) {
  const set = setLabel(card)
  const items: DescriptionItem[] = []
  if (set) items.push({ term: 'Extension', description: <span lang="ja">{set}</span> })
  if (card.rarity) items.push({ term: 'Rareté', description: <RarityTag card={card} withLabel /> })
  if (card.illustrator) items.push({ term: 'Illustrateur', description: card.illustrator })
  if (card.name)
    items.push({ term: 'Nom imprimé', description: <span lang="ja">{card.name}</span> })
  return <DescriptionList items={items} />
}

/** La fiche de la carte affichée : ce qu'elle est, et ce que l'utilisateur en fait. */
export function CardSheet({
  candidate,
  species,
}: {
  candidate: CardView
  species: PokemonSpecies
}) {
  return (
    <Stack as="section" gap={6} className={styles.sheet} aria-labelledby="sheet-title">
      <Stack as="header" gap={2} align="start">
        <h2 id="sheet-title" className={styles.title}>
          Carte {candidate.card.reference}
        </h2>
        <p className={styles.status}>
          {statusCaption(candidate.status, candidate.acquiredAt)}
          {candidate.isFavorite && (
            <Badge tone="accent" size="sm" icon={<Star size={10} fill="currentColor" />}>
              Illustration choisie
            </Badge>
          )}
        </p>
      </Stack>

      <CardFacts card={candidate.card} />
      <CardPrice card={candidate.card} />
      <CardActions candidate={candidate} species={species} />
      <PurchaseSection candidate={candidate} />
    </Stack>
  )
}

/**
 * Aucune candidate : l'index n'a aucune pleine carte de l'espèce, ou `known` : ses cartes sont
 * d'une rareté que l'utilisateur ne suit pas.
 */
export function EmptySheet({ known }: { known: boolean }) {
  return (
    <Stack as="section" gap={6} className={styles.sheet} aria-labelledby="sheet-title">
      <h2 id="sheet-title" className={styles.title}>
        Illustration à rechercher
      </h2>
      {known ? (
        <>
          <p className="muted">Aucune carte de ce Pokémon n’a une rareté que vous suivez.</p>
          <div>
            <Button asChild variant="secondary">
              <Link to="/donnees#classification">Choisir les raretés suivies</Link>
            </Button>
          </div>
        </>
      ) : (
        <p className="muted">Aucune pleine carte japonaise de ce Pokémon n’est encore connue.</p>
      )}
    </Stack>
  )
}
