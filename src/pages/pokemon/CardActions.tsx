import { Button, Radio, RadioGroup, Spinner, Stack } from '@camply/ui'
import { Pencil, Plus, Star, Trash2 } from '@camply/ui/icons'
import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from 'react'
import { CardStatusControls } from '@/components/CardStatusControls'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LanguageFlag } from '@/components/LanguageSwitch'
import { useCollectionAction } from '@/hooks/useNotify'
import { loadSpeciesCards } from '@/lib/card-catalog'
import { cardLanguage } from '@/lib/collection'
import { isInAnOrder } from '@/lib/orders'
import { focusAfter } from '@/lib/focus'
import { noLongerUnlocked, otherSpeciesNames } from '@/lib/species'
import { LEAVING_OWNED, statusLabel } from '@/lib/format'
import { unlockedWithout, type CardView, type PokedexEntry } from '@/lib/pokedex'
import { seriesOf } from '@/lib/series'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { PokemonSpecies } from '@/types'
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

/**
 * Ce que l'utilisateur fait d'une carte du Pokémon (`entry`) : lui donner un statut et noter son
 * prix payé (`CardStatusControls`), en faire sa favorite, la corriger, la retirer (possédée, ou
 * favorite d'un Pokémon qui garde d'autres cartes : après confirmation, qui demande alors la
 * nouvelle favorite ; pas une case d'une collection d'extension, qui se retire avec elle). Chaque
 * action est annoncée avec « Annuler ».
 */
export function CardActions({ view, entry }: { view: CardView; entry: PokedexEntry }) {
  const act = useCollectionAction()
  const [editing, setEditing] = useState(false)
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
  // Une case d'une collection d'extension se retire avec elle, jamais d'ici.
  const series = useCollectionStore((state) => seriesOf(state.collection, card.id))
  // La favorite de ce Pokémon (une TAG TEAM l'est, ou non, de chacun des siens).
  const favorite = entry.card?.card.id === card.id
  const others = entry.cards.filter((other) => other.card.id !== card.id)
  // Retirer sa favorite quand il garde d'autres cartes : l'utilisateur choisit la suivante, l'app ne
  // la choisit jamais.
  const replacing = favorite && others.length > 0

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
      <CardStatusControls view={view} />

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
            disabled={series !== null || (inAnOrder && !shared)}
            onClick={() => (replacing || status === 'owned' ? setRemoving(true) : remove())}
          >
            Retirer la carte
          </Button>
        </Stack>
        <p className="hint">
          {series
            ? `Elle fait partie de votre collection ${series.name} : elle se retire avec elle.`
            : shared
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
            {!unlockedWithout(entry, card.id) && noLongerUnlocked([species.id])}
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
