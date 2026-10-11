import { Badge, Stack } from '@camply/ui'
import { Star } from '@camply/ui/icons'
import { CardArt } from '@/components/CardArt'
import { PossessionMark } from '@/components/PossessionMark'
import { RarityTag } from '@/components/RarityTag'
import { cx } from '@/lib/cx'
import type { CardView } from '@/lib/candidates'
import { statusLabel } from '@/lib/format'
import styles from './CandidateGallery.module.css'

interface CandidateGalleryProps {
  candidates: CardView[]
  /** Pour le sprite des cartes sans image. */
  speciesId: number
  viewedId: string | null
  onView: (cardId: string) => void
}

/** Les illustrations candidates ; celle qu'on sélectionne s'affiche en grand. */
export function CandidateGallery({
  candidates,
  speciesId,
  viewedId,
  onView,
}: CandidateGalleryProps) {
  return (
    <Stack as="section" gap={5} aria-labelledby="candidates-title">
      <header className={styles.header}>
        <h2 id="candidates-title" className={styles.title}>
          Illustrations candidates <Badge tone="neutral">{candidates.length}</Badge>
        </h2>
        <p className={styles.hint}>Sélectionnez une carte pour l’afficher en grand.</p>
      </header>

      <ul className={styles.grid}>
        {candidates.map((candidate) => {
          const { card, status } = candidate
          const viewed = card.id === viewedId
          return (
            <li key={card.id}>
              <button
                type="button"
                aria-pressed={viewed}
                className={cx(styles.tile, viewed && styles.viewed)}
                onClick={() => onView(card.id)}
              >
                <CardArt
                  image={candidate.image}
                  hasCard
                  speciesId={speciesId}
                  reference={card.reference}
                  alt=""
                >
                  <PossessionMark status={status} />
                  {candidate.isFavorite && (
                    <span className={styles.favorite} aria-hidden="true">
                      <Star size={12} fill="currentColor" />
                    </span>
                  )}
                </CardArt>
                <span className={styles.caption}>
                  <span className={styles.reference}>
                    {card.reference}
                    <RarityTag
                      card={card}
                      rarityClass={candidate.rarityClass}
                      deduced={candidate.rarityDeduced}
                    />
                  </span>
                  <span className="muted">{statusLabel(status)}</span>
                  {candidate.isFavorite && (
                    <span className={styles.chosen}>Illustration choisie</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Stack>
  )
}
