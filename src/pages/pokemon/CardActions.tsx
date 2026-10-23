import { Button, ButtonGroup, Radio, RadioGroup, Spinner, Stack, Toggle } from '@camply/ui'
import { Pencil, Plus, Star, Trash2 } from '@camply/ui/icons'
import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EuroInput } from '@/components/EuroInput'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { STATUS_ICONS } from '@/components/statusIcons'
import { usePokedex } from '@/hooks/usePokedex'
import { useCollectionAction } from '@/hooks/useNotify'
import { loadSpeciesCards } from '@/lib/card-catalog'
import { cardLanguage, isToBuy } from '@/lib/collection'
import { isInAnOrder } from '@/lib/orders'
import { cx } from '@/lib/cx'
import { focusAfter } from '@/lib/focus'
import { otherSpeciesNames, speciesNames } from '@/lib/species'
import { formatEuro, statusLabel } from '@/lib/format'
import { unlockedWithout, type CardView, type PokedexEntry } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CardStatus, PokemonSpecies } from '@/types'
import styles from './CardActions.module.css'

/**
 * La fenêtre d'ajout ou de correction, chargée à sa première ouverture (avec le choix dans le
 * catalogue et la saisie) : elle n'alourdit pas le premier chargement.
 */
const loadCardForm = () => import('./CardForm')
const CardForm = lazy(() => loadCardForm().then(({ CardForm }) => ({ default: CardForm })))

/** Cette fenêtre, et son attente le temps de son chargement. */
function CardFormWindow(props: ComponentProps<typeof CardForm>) {
  return (
    <Suspense fallback={<Spinner size={16} label="Ouverture de la fenêtre…" />}>
      <CardForm {...props} />
    </Suspense>
  )
}

/**
 * La fenêtre d'ajout et les cartes japonaises du Pokémon (son premier onglet), chargées d'avance :
 * elle s'ouvre sans attendre.
 */
const prepareAddition = (speciesId: number) => {
  void loadCardForm()
  void loadSpeciesCards(speciesId, 'ja')
}

/**
 * « Ajouter une carte » : le bouton et la fenêtre qu'il ouvre, préparée dès que le pointeur ou le
 * focus arrive dessus. `compact` : un bouton discret, pour la liste des cartes d'un Pokémon ; sinon
 * l'action attendue d'un Pokémon sans carte, dont la fenêtre est préparée dès que le navigateur a
 * le temps (au plus tard 2 s après). Safari n'a pas `requestIdleCallback`.
 */
export function AddCardButton({
  species,
  compact,
}: {
  species: PokemonSpecies
  compact?: boolean
}) {
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    if (compact) return
    const load = () => prepareAddition(species.id)
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2000 })
    else setTimeout(load, 1000)
  }, [species.id, compact])
  const prepare = () => prepareAddition(species.id)
  return (
    <>
      <div>
        <Button
          variant={compact ? 'secondary' : undefined}
          size={compact ? 'sm' : undefined}
          leftIcon={<Plus size={compact ? 15 : 16} />}
          onPointerEnter={prepare}
          onFocus={prepare}
          onClick={() => setAdding(true)}
        >
          Ajouter une carte
        </Button>
      </div>
      {adding && <CardFormWindow species={species} card={null} onClose={() => setAdding(false)} />}
    </>
  )
}

const STATUS_BUTTONS: { status: CardStatus; label: string }[] = [
  { status: 'owned', label: 'Je possède cette carte' },
  { status: 'ordered', label: 'Marquer comme commandée' },
]

/** Ce que coûte de quitter « possédée » : la date d'obtention, et le prix payé sauf « commandée ». */
const LEAVING_OWNED: Record<Exclude<CardStatus, 'owned'> | 'none', string> = {
  none: 'Son statut, sa date d’obtention et son prix payé seront effacés.',
  ordered: 'Sa date d’obtention sera effacée.',
}

/** « Pikachu ne sera plus débloqué. », « Pikachu et Zekrom ne seront plus débloqués. » */
const noLongerUnlocked = (ids: readonly number[]) =>
  `${speciesNames(ids)} ${ids.length > 1 ? 'ne seront plus débloqués' : 'ne sera plus débloqué'}.`

/**
 * Ce que l'utilisateur fait d'une carte du Pokémon (`entry`) : lui donner un statut (un seul à la
 * fois ; le relâcher le retire ; quitter « possédée » demande confirmation), noter son prix payé,
 * en faire sa favorite, la corriger, la retirer (possédée, ou favorite d'un Pokémon qui garde
 * d'autres cartes : après confirmation, qui demande alors la nouvelle favorite). Chaque action est
 * annoncée avec « Annuler ».
 */
export function CardActions({ view, entry }: { view: CardView; entry: PokedexEntry }) {
  const act = useCollectionAction()
  const { entryById } = usePokedex()
  const [editing, setEditing] = useState(false)
  // Le statut qui remplacerait « possédée » (`none` : aucun), en attente de confirmation.
  const [leaving, setLeaving] = useState<keyof typeof LEAVING_OWNED | null>(null)
  const [removing, setRemoving] = useState(false)
  // La nouvelle favorite cochée dans la confirmation du retrait : aucune au départ.
  const [successor, setSuccessor] = useState<string>()
  const editButton = useRef<HTMLButtonElement>(null)
  const { species } = entry
  const { card, status } = view
  // Les autres Pokémon de la carte (TAG TEAM) : la retirer d'ici la leur laisse.
  const shared = card.dexIds.length > 1
  const otherNames = otherSpeciesNames(card.dexIds, species.id)
  // Une carte d'une commande y reste (sauf d'un seul de ses Pokémon : `isInAnOrder`).
  const inAnOrder = useShoppingStore((state) => isInAnOrder(state.shopping.orders, card.id))
  // La favorite de ce Pokémon (une TAG TEAM l'est, ou non, de chacun des siens).
  const favorite = entry.card?.card.id === card.id
  const others = entry.cards.filter((other) => other.card.id !== card.id)
  // Retirer sa favorite quand il garde d'autres cartes : l'utilisateur choisit la suivante, l'app ne
  // la choisit jamais.
  const replacing = favorite && others.length > 0
  // Les Pokémon de la carte qu'elle seule débloque : sans elle possédée, ils seraient à débloquer.
  const losing = card.dexIds.filter((id) => !unlockedWithout(entryById.get(id)!, card.id))

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

  // Le bouton disparaît (elle est devenue la favorite) : le focus passe à « Modifier la carte ».
  const makeFavorite = () =>
    focusAfter(
      () =>
        act(
          () => useCollectionStore.getState().setFavorite(species.id, card.id),
          `Carte ${card.reference} mise en favorite de ${species.names.fr}.`,
        ),
      editButton,
    )

  const remove = (newFavorite?: string) =>
    act(
      () => useCollectionStore.getState().removeCard(card.id, species.id, newFavorite),
      shared
        ? `Carte ${card.reference} retirée de ${species.names.fr} : elle reste celle de ${otherNames}.`
        : `Carte ${card.reference} retirée de ${species.names.fr}.`,
      'info',
    )

  const closeRemoving = () => {
    setRemoving(false)
    setSuccessor(undefined)
  }

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
        // Le prix payé, enregistré en quittant le champ (ou Entrée).
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

      <Stack gap={2} align="start" className={styles.group}>
        <Stack direction="horizontal" gap={2} wrap>
          {!favorite && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Star size={15} />}
              onClick={makeFavorite}
            >
              Mettre en favorite
            </Button>
          )}
          <Button
            ref={editButton}
            variant="secondary"
            size="sm"
            leftIcon={<Pencil size={15} />}
            // La fenêtre préparée dès que le pointeur ou le focus arrive sur le bouton : elle
            // s'ouvre sans attendre son chargement.
            onPointerEnter={() => void loadCardForm()}
            onFocus={() => void loadCardForm()}
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
            onClick={() => (replacing || status === 'owned' ? setRemoving(true) : remove())}
          >
            Retirer la carte
          </Button>
        </Stack>
        <p className="hint">
          {shared
            ? `Elle est aussi celle de ${otherNames} : la retirer d’ici la leur laisse, avec son statut et son prix payé.`
            : inAnOrder
              ? 'Elle figure dans une commande : elle reste, pour que le registre tienne.'
              : 'La retirer efface son statut et son prix payé.'}
        </p>
      </Stack>

      {editing && (
        <CardFormWindow species={species} card={card} onClose={() => setEditing(false)} />
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
          {LEAVING_OWNED[leaving ?? 'none']} {losing.length > 0 && noLongerUnlocked(losing)}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={removing}
        title={replacing ? 'Retirer la carte favorite ?' : 'Retirer cette carte possédée ?'}
        confirmLabel="Retirer la carte"
        confirmDisabled={replacing && !successor}
        onClose={closeRemoving}
        onConfirm={() => remove(successor)}
      >
        {status === 'owned' && (
          <p>
            {shared ? `Elle reste celle de ${otherNames}, possédée.` : LEAVING_OWNED.none}{' '}
            {losing.includes(species.id) && noLongerUnlocked([species.id])}
          </p>
        )}
        {replacing && (
          <RadioGroup
            label={`Nouvelle favorite de ${species.names.fr}`}
            hint="La carte que le Pokédex montrera pour lui."
            value={successor}
            onChange={setSuccessor}
          >
            {others.map(({ card: other, status: otherStatus }) => (
              <Radio
                key={other.id}
                value={other.id}
                // `label` est typé `string` dans camply, qui l'écrit tel quel : le drapeau y tient
                // (comme le segment de `LanguageSwitch`). Un code d'extension existe dans les deux
                // langues : la référence seule ne suffit pas.
                label={
                  (
                    <>
                      {other.reference}
                      <LanguageFlag language={cardLanguage(other)} />
                    </>
                  ) as unknown as string
                }
                hint={statusLabel(otherStatus)}
              />
            ))}
          </RadioGroup>
        )}
      </ConfirmDialog>
    </Stack>
  )
}
