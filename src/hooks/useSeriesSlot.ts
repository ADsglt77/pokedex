import { useCollectionAction } from '@/hooks/useNotify'
import { unobtainedSlot, type CatalogCard } from '@/lib/card-catalog'
import { seriesOf } from '@/lib/series'
import { speciesNames } from '@/lib/species'
import { useCollectionStore } from '@/store/collection'

/**
 * La carte du catalogue `listed` est-elle une case pas encore obtenue d'une collection d'extension
 * (`unobtainedSlot`) : la case, sa collection et son statut ; `null` sinon (ou sans carte). Une
 * carte n'existe qu'une fois : l'ajouter à ses Pokémon (« Ajouter à la collection » du Catalogue, la
 * fenêtre d'ajout d'une fiche) la reprend, avec son statut, sans copie (`adopt`), annoncé avec
 * « Annuler ».
 */
export function useSeriesSlot(listed: CatalogCard | null) {
  const act = useCollectionAction()
  const collection = useCollectionStore((state) => state.collection)
  const card = listed && unobtainedSlot(collection, listed)
  if (!card) return null
  const series = seriesOf(collection, card.id)!
  return {
    card,
    series,
    status: collection.cards[card.id]?.status ?? null,
    adopt: () =>
      act(
        () => useCollectionStore.getState().adopt(card.id),
        `Carte ${card.reference} ajoutée à ${speciesNames(card.dexIds)} (déjà dans votre collection ${series.name}).`,
      ),
  }
}
