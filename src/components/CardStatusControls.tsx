import { ButtonGroup, Toggle } from '@camply/ui'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EuroInput } from '@/components/EuroInput'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import { isToBuy } from '@/lib/collection'
import { cx } from '@/lib/cx'
import { formatEuro, LEAVING_OWNED, statusText } from '@/lib/format'
import { unlockedWithout, type CardView } from '@/lib/pokedex'
import { noLongerUnlocked } from '@/lib/species'
import { useCollectionStore } from '@/store/collection'
import type { CardStatus } from '@/types'
import styles from './CardStatusControls.module.css'

const STATUS_BUTTONS: { status: CardStatus; label: string }[] = [
  { status: 'owned', label: 'Je possède cette carte' },
  { status: 'ordered', label: 'Marquer comme commandée' },
]

/**
 * Le statut d'une carte et son prix payé (la fiche d'un Pokémon, la fenêtre d'une carte d'une
 * collection d'extension) : un statut à la fois (le relâcher le retire ; quitter « possédée »
 * demande confirmation, qui dit ce qui s'efface et les Pokémon qui ne seraient plus débloqués :
 * ceux qu'elle seule débloque) ; le prix payé d'une carte commandée ou possédée, enregistré en
 * quittant le champ (ou Entrée). Chaque action est annoncée avec « Annuler ». Dans une `Stack` :
 * ses blocs en sont des enfants.
 */
export function CardStatusControls({ view }: { view: CardView }) {
  const act = useCollectionAction()
  const { entryById } = usePokedex()
  // Le statut qui remplacerait « possédée » (`none` : aucun), en attente de confirmation.
  const [leaving, setLeaving] = useState<keyof typeof LEAVING_OWNED | null>(null)
  const { card, status } = view
  // Les Pokémon de la carte qu'elle seule débloque : sans elle possédée, ils seraient à débloquer.
  const losing = card.dexIds.filter((id) => !unlockedWithout(entryById.get(id)!, card.id))

  const applyStatus = (next: CardStatus | null) =>
    act(
      () => useCollectionStore.getState().setCardStatus(card, next),
      next
        ? `Carte ${card.reference} marquée comme ${statusText(next)}.`
        : `Statut retiré de la carte ${card.reference}.`,
      next ? 'success' : 'info',
    )

  const setStatus = (next: CardStatus | null) =>
    status === 'owned' && next !== 'owned' ? setLeaving(next ?? 'none') : applyStatus(next)

  return (
    <>
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
        <EuroInput
          className={styles.group}
          label="Prix payé"
          hint="Pour suivre ce que la carte vous a coûté, et ce qu’elle vaut depuis."
          value={view.paidPrice ?? undefined}
          onCommit={(amount) =>
            act(
              () => useCollectionStore.getState().setPaidPrice(card, amount),
              amount === undefined
                ? `Prix payé retiré de la carte ${card.reference}.`
                : `Carte ${card.reference} payée ${formatEuro(amount)}.`,
              amount === undefined ? 'info' : 'success',
            )
          }
        />
      )}

      <ConfirmDialog
        open={leaving !== null}
        title="Ne plus marquer cette carte comme possédée ?"
        confirmLabel={
          leaving && leaving !== 'none'
            ? `Marquer comme ${statusText(leaving)}`
            : 'Retirer le statut'
        }
        onClose={() => setLeaving(null)}
        onConfirm={() => applyStatus(leaving === 'none' ? null : leaving)}
      >
        <p>
          {LEAVING_OWNED[leaving ?? 'none']} {losing.length > 0 && noLongerUnlocked(losing)}
        </p>
      </ConfirmDialog>
    </>
  )
}
