import { Button, ButtonGroup, Stack, Toggle } from '@camply/ui'
import { Pencil, Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useCollectionAction } from '@/hooks/useNotify'
import { cx } from '@/lib/cx'
import { statusLabel } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CardStatus, PokemonSpecies } from '@/types'
import { CardForm } from './CardForm'
import { PaidPriceField } from './PaidPriceField'
import styles from './CardActions.module.css'

const STATUS_BUTTONS: { status: CardStatus; label: string }[] = [
  { status: 'owned', label: 'Je possède cette carte' },
  { status: 'ordered', label: 'Marquer comme commandée' },
  { status: 'wanted', label: 'Marquer comme souhaitée' },
]

/**
 * Ce que l'utilisateur fait de la carte d'un Pokémon : lui donner un statut (un seul à la fois ; le
 * relâcher le retire), noter son prix payé, la corriger, la retirer pour en choisir une autre.
 * Chaque action est annoncée avec « Annuler ».
 */
export function CardActions({ view, species }: { view: CardView; species: PokemonSpecies }) {
  const act = useCollectionAction()
  const [editing, setEditing] = useState(false)
  const { card, status } = view
  // Une carte d'une commande y reste : la retirer fausserait le registre.
  const ordered = useShoppingStore((state) =>
    state.shopping.orders.some((order) => order.lines.some((line) => line.cardId === card.id)),
  )

  const setStatus = (next: CardStatus | null) =>
    act(
      () => useCollectionStore.getState().setCardStatus(card, next),
      next
        ? `Carte ${card.reference} marquée comme ${statusLabel(next).toLowerCase()}.`
        : `Statut retiré de la carte ${card.reference}.`,
      next ? 'success' : 'info',
    )

  const remove = () =>
    act(
      () => {
        useCollectionStore.getState().removeCard(card.id)
        useShoppingStore.getState().setDecision(card.id, null)
      },
      `Carte ${card.reference} retirée de ${species.names.fr}.`,
      'info',
    )

  return (
    <Stack gap={5}>
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

      <Stack gap={2} align="start" className={styles.group}>
        <Stack direction="horizontal" gap={2} wrap>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Pencil size={15} />}
            onClick={() => setEditing(true)}
          >
            Modifier la carte
          </Button>
          <Button
            variant="ghost"
            tone="danger"
            size="sm"
            leftIcon={<Trash2 size={15} />}
            disabled={ordered}
            onClick={remove}
          >
            Retirer la carte
          </Button>
        </Stack>
        <p className={styles.hint}>
          {ordered
            ? 'Elle figure dans une commande : elle reste, pour que le registre tienne.'
            : 'Pour en choisir une autre, retirez celle-ci : son statut et ses préférences d’achat partent avec elle.'}
        </p>
      </Stack>

      {editing && <CardForm species={species} card={card} onClose={() => setEditing(false)} />}
    </Stack>
  )
}
