import { ButtonGroup, Stack, Toggle } from '@camply/ui'
import { Star } from '@camply/ui/icons'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useCollectionAction } from '@/hooks/useNotify'
import { cx } from '@/lib/cx'
import type { CardView } from '@/lib/candidates'
import type { PokedexEntry } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import type { CardStatus } from '@/types'
import { PaidPriceField } from './PaidPriceField'
import styles from './CardActions.module.css'

const STATUS_BUTTONS: { status: CardStatus; label: string; done: string }[] = [
  { status: 'owned', label: 'Je possède cette carte', done: 'possédée' },
  { status: 'ordered', label: 'Marquer comme commandée', done: 'commandée' },
  { status: 'wanted', label: 'Marquer comme souhaitée', done: 'souhaitée' },
]

/**
 * Le choix de l'illustration, indépendant du statut, et le statut de la carte : un seul à la
 * fois, parmi possédée, commandée et souhaitée. Chaque action est annoncée avec « Annuler ».
 */
export function CardActions({ candidate, entry }: { candidate: CardView; entry: PokedexEntry }) {
  const act = useCollectionAction()
  const { card, status, isFavorite } = candidate
  const name = entry.species.names.fr

  const setStatus = (next: CardStatus | null) => {
    const isUnlocked = entry.candidates.some(
      (other) => (other.card.id === card.id ? next : other.status) === 'owned',
    )
    const relocked = entry.unlocked && !isUnlocked ? ` ${name} est de nouveau à débloquer.` : ''
    const done = STATUS_BUTTONS.find((button) => button.status === next)?.done
    const message =
      !entry.unlocked && isUnlocked
        ? `${name} est débloqué : vous possédez la carte ${card.reference}.`
        : done
          ? `Carte ${card.reference} marquée comme ${done}.${relocked}`
          : `Statut retiré de la carte ${card.reference}.${relocked}`
    act(
      () => useCollectionStore.getState().setCardStatus(card, next),
      message,
      next && !relocked ? 'success' : 'info',
    )
  }

  const toggleFavorite = () =>
    act(
      () => useCollectionStore.getState().setFavorite(entry.species.id, isFavorite ? null : card),
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
            // Relâcher le statut actif le retire. Tant que rien n'est suivi, « Je possède » est
            // mis en avant : c'est l'action attendue.
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
        <div className={styles.group}>
          <PaidPriceField card={card} />
        </div>
      )}
    </Stack>
  )
}
