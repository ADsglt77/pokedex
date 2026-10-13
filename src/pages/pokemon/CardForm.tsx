import { Button, Modal } from '@camply/ui'
import { CardFields } from '@/components/CardFields'
import { useCardDraft } from '@/hooks/useCardDraft'
import { useCollectionAction } from '@/hooks/useNotify'
import { useCollectionStore } from '@/store/collection'
import type { PokemonCard, PokemonSpecies } from '@/types'

/**
 * Ajouter la carte d'un Pokémon, ou la corriger (`card`), dans une fenêtre. Montée seulement
 * quand elle est ouverte.
 */
export function CardForm({
  species,
  card,
  onClose,
}: {
  species: PokemonSpecies
  card: PokemonCard | null
  onClose: () => void
}) {
  const act = useCollectionAction()
  const draft = useCardDraft(card)

  const save = async () => {
    const saved = await draft.read(card?.dexIds ?? [species.id], species.names.fr)
    if (!saved) return
    act(
      () => useCollectionStore.getState().saveCard(saved),
      card ? `Carte de ${species.names.fr} modifiée.` : `Carte ajoutée à ${species.names.fr}.`,
    )
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        card
          ? `Modifier la carte de ${species.names.fr}`
          : `Ajouter une carte à ${species.names.fr}`
      }
      description="La carte que vous voulez pour ce Pokémon : sa référence, qui sert à trouver son image, et son id Cardmarket pour suivre son prix."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <CardFields draft={draft} speciesId={species.id} />
    </Modal>
  )
}
