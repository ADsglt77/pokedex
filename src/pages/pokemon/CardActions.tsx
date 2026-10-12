import { ButtonGroup, Stack, Toggle } from '@camply/ui'
import { Star } from '@camply/ui/icons'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useCollectionAction } from '@/hooks/useNotify'
import { cx } from '@/lib/cx'
import type { CardView } from '@/lib/candidates'
import { statusLabel } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { CardStatus, PokemonSpecies } from '@/types'
import { PaidPriceField } from './PaidPriceField'
import styles from './CardActions.module.css'

const STATUS_BUTTONS: { status: CardStatus; label: string }[] = [
  { status: 'owned', label: 'Je possède cette carte' },
  { status: 'ordered', label: 'Marquer comme commandée' },
  { status: 'wanted', label: 'Marquer comme souhaitée' },
]

/**
 * Ce que l'utilisateur fait d'une carte : la choisir comme illustration du Pokémon, lui donner un
 * statut (un seul à la fois ; le relâcher le retire), noter son prix payé. Chaque action est
 * annoncée avec « Annuler ».
 */
export function CardActions({
  candidate,
  species,
}: {
  candidate: CardView
  species: PokemonSpecies
}) {
  const act = useCollectionAction()
  const { card, status, isFavorite } = candidate
  const name = species.names.fr

  const setStatus = (next: CardStatus | null) =>
    act(
      () => useCollectionStore.getState().setCardStatus(card, next),
      next
        ? `Carte ${card.reference} marquée comme ${statusLabel(next).toLowerCase()}.`
        : `Statut retiré de la carte ${card.reference}.`,
      next ? 'success' : 'info',
    )

  const toggleFavorite = () =>
    act(
      () => useCollectionStore.getState().setFavorite(species.id, isFavorite ? null : card),
      isFavorite
        ? `${name} n’a plus d’illustration choisie.`
        : `Illustration choisie pour ${name} : carte ${card.reference}.`,
      isFavorite ? 'info' : 'success',
    )

  return (
    <Stack gap={5}>
      <Stack gap={2} className={styles.group}>
        <Toggle pressed={isFavorite} onChange={toggleFavorite}>
          <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          {isFavorite ? 'Illustration choisie' : 'Choisir cette illustration'}
        </Toggle>
        <p className={styles.hint}>
          L’illustration choisie représente {name} dans le Pokédex, que vous possédiez la carte ou
          non.
        </p>
      </Stack>

      <ButtonGroup
        orientation="vertical"
        attached={false}
        className={styles.group}
        aria-label="Statut de la carte"
      >
        {STATUS_BUTTONS.map(({ status: value, label }) => {
          const Icon = STATUS_ICONS[value]
          return (
            // Tant que rien n'est suivi, « Je possède » est mis en avant : l'action attendue.
            <Toggle
              key={value}
              pressed={status === value}
              onChange={(pressed) => setStatus(pressed ? value : null)}
              className={cx(
                styles.status,
                styles[value],
                value === 'owned' && status === null && styles.expected,
              )}
            >
              <Icon size={16} />
              {label}
            </Toggle>
          )
        })}
      </ButtonGroup>

      {(status === 'owned' || status === 'ordered') && (
        <PaidPriceField card={card} className={styles.group} />
      )}
    </Stack>
  )
}
