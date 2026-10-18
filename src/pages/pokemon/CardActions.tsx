import { Button, ButtonGroup, Stack, Toggle } from '@camply/ui'
import { Pencil, Trash2 } from '@camply/ui/icons'
import { lazy, Suspense, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useCollectionAction } from '@/hooks/useNotify'
import { isToBuy } from '@/lib/collection'
import { cx } from '@/lib/cx'
import { otherSpeciesNames, speciesNames } from '@/lib/species'
import { statusLabel } from '@/lib/format'
import type { CardView } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CardStatus, PokemonSpecies } from '@/types'
import { PaidPriceField } from './PaidPriceField'
import styles from './CardActions.module.css'

/**
 * La fenêtre d'ajout ou de correction, chargée à sa première ouverture (avec le choix dans le
 * catalogue et la saisie) : elle n'alourdit pas le premier chargement.
 */
const CardForm = lazy(() => import('./CardForm').then(({ CardForm }) => ({ default: CardForm })))

const STATUS_BUTTONS: { status: CardStatus; label: string }[] = [
  { status: 'owned', label: 'Je possède cette carte' },
  { status: 'ordered', label: 'Marquer comme commandée' },
]

/** Ce que coûte de quitter « possédée » : la date d'obtention, et le prix payé sauf « commandée ». */
const LEAVING_OWNED: Record<Exclude<CardStatus, 'owned'> | 'none', string> = {
  none: 'Son statut, sa date d’obtention et son prix payé seront effacés.',
  ordered: 'Sa date d’obtention sera effacée.',
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
  // Le statut qui remplacerait « possédée » (`none` : aucun), en attente de confirmation.
  const [leaving, setLeaving] = useState<keyof typeof LEAVING_OWNED | null>(null)
  const [removing, setRemoving] = useState(false)
  const { card, status } = view
  // Les autres Pokémon de la carte (TAG TEAM) : la retirer d'ici la leur laisse.
  const shared = card.dexIds.length > 1
  const otherNames = otherSpeciesNames(card.dexIds, species.id)
  // Une carte d'une commande y reste : la retirer fausserait le registre (sauf d'un seul de ses
  // Pokémon : elle reste alors celle des autres).
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
    status === 'owned' && next !== 'owned' ? setLeaving(next ?? 'none') : applyStatus(next)

  const remove = () =>
    act(
      () => useCollectionStore.getState().removeCard(card.id, species.id),
      shared
        ? `Carte ${card.reference} retirée de ${species.names.fr} : elle reste celle de ${otherNames}.`
        : `Carte ${card.reference} retirée de ${species.names.fr}.`,
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

      {!isToBuy(view) && (
        <PaidPriceField card={card} paid={view.paidPrice} className={styles.group} />
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
            disabled={inAnOrder && !shared}
            onClick={() => (status === 'owned' ? setRemoving(true) : remove())}
          >
            Retirer la carte
          </Button>
        </Stack>
        <p className="hint">
          {shared
            ? `Elle est aussi celle de ${otherNames} : la retirer d’ici la leur laisse, avec son statut et son prix payé.`
            : inAnOrder
              ? 'Elle figure dans une commande : elle reste, pour que le registre tienne.'
              : 'Pour en choisir une autre, retirez celle-ci : son statut et son prix payé partent avec elle.'}
        </p>
      </Stack>

      {editing && (
        <Suspense>
          <CardForm species={species} card={card} onClose={() => setEditing(false)} />
        </Suspense>
      )}

      <ConfirmDialog
        open={leaving !== null}
        title="Ne plus marquer cette carte comme possédée ?"
        confirmLabel={
          leaving && leaving !== 'none'
            ? `Marquer comme ${statusLabel(leaving).toLowerCase()}`
            : 'Retirer le statut'
        }
        onClose={() => setLeaving(null)}
        onConfirm={() => applyStatus(leaving === 'none' ? null : leaving)}
      >
        <p>
          {LEAVING_OWNED[leaving ?? 'none']}{' '}
          {shared
            ? `${speciesNames(card.dexIds)} ne seront plus débloqués.`
            : `${species.names.fr} ne sera plus débloqué.`}
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
          {shared ? `Elle reste celle de ${otherNames}, possédée.` : LEAVING_OWNED.none}{' '}
          {species.names.fr} ne sera plus débloqué, et vous pourrez lui choisir une autre carte.
        </p>
      </ConfirmDialog>
    </Stack>
  )
}
