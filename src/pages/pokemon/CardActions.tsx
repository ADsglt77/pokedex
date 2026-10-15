import { Button, ButtonGroup, Stack, Toggle } from '@camply/ui'
import { Pencil, Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useCollectionAction } from '@/hooks/useNotify'
import { isToBuy } from '@/lib/collection'
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

/** Ce que coûte de quitter « possédée » : la date d'obtention, et le prix payé sauf « commandée ». */
const LEAVING_OWNED: Record<Exclude<CardStatus, 'owned'> | 'none', string> = {
  none: 'Son statut, sa date d’obtention et son prix payé seront effacés.',
  ordered: 'Sa date d’obtention sera effacée.',
  wanted: 'Sa date d’obtention et son prix payé seront effacés.',
}

/**
 * Ce que l'utilisateur fait de la carte d'un Pokémon : lui donner un statut (un seul à la fois ; le
 * relâcher le retire ; quitter « possédée » demande confirmation), noter son prix payé, la corriger,
 * la retirer pour en choisir une autre (possédée : après confirmation). Chaque action est annoncée
 * avec « Annuler ».
 */
export function CardActions({ view, species }: { view: CardView; species: PokemonSpecies }) {
  const act = useCollectionAction()
  const [editing, setEditing] = useState(false)
  // Le statut qui remplacerait « possédée », en attente de confirmation.
  const [leaving, setLeaving] = useState<{ next: Exclude<CardStatus, 'owned'> | null } | null>(null)
  const [removing, setRemoving] = useState(false)
  const { card, status } = view
  // Une carte d'une commande y reste : la retirer fausserait le registre.
  const inAnOrder = useShoppingStore((state) =>
    state.shopping.orders.some((order) => order.lines.some((line) => line.cardId === card.id)),
  )

  const applyStatus = (next: CardStatus | null) =>
    act(
      () => useCollectionStore.getState().setCardStatus(card, next),
      next
        ? `Carte ${card.reference} marquée comme ${statusLabel(next).toLowerCase()}.`
        : `Statut retiré de la carte ${card.reference}.`,
      next ? 'success' : 'info',
    )

  const setStatus = (next: CardStatus | null) =>
    status === 'owned' && next !== 'owned' ? setLeaving({ next }) : applyStatus(next)

  const remove = () =>
    act(
      () => {
        useCollectionStore.getState().removeCard(card.id)
        useShoppingStore.getState().setAccepted(card.id, false)
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

      {!isToBuy(view) && <PaidPriceField card={card} className={styles.group} />}

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
            disabled={inAnOrder}
            onClick={() => (status === 'owned' ? setRemoving(true) : remove())}
          >
            Retirer la carte
          </Button>
        </Stack>
        <p className="hint">
          {inAnOrder
            ? 'Elle figure dans une commande : elle reste, pour que le registre tienne.'
            : 'Pour en choisir une autre, retirez celle-ci : son statut, son prix payé et sa préférence d’achat partent avec elle.'}
        </p>
      </Stack>

      {editing && <CardForm species={species} card={card} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={leaving !== null}
        title="Ne plus marquer cette carte comme possédée ?"
        confirmLabel={
          leaving?.next
            ? `Marquer comme ${statusLabel(leaving.next).toLowerCase()}`
            : 'Retirer le statut'
        }
        onClose={() => setLeaving(null)}
        onConfirm={() => applyStatus(leaving!.next)}
      >
        <p>
          {LEAVING_OWNED[leaving?.next ?? 'none']} {species.names.fr} ne sera plus débloqué.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={removing}
        title="Retirer cette carte possédée ?"
        confirmLabel="Retirer la carte"
        onClose={() => setRemoving(false)}
        onConfirm={remove}
      >
        <p>
          {LEAVING_OWNED.none} {species.names.fr} ne sera plus débloqué, et vous pourrez lui choisir
          une autre carte.
        </p>
      </ConfirmDialog>
    </Stack>
  )
}
