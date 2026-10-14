import { Button } from '@camply/ui'
import { Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { useCollectionAction } from '@/hooks/useNotify'
import { emptyCollection } from '@/lib/collection'
import { isEmptySummary, summarize } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { useSyncStore } from '@/store/sync'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'

/** Tout effacer, après confirmation (et une dernière chance d'exporter). */
export function EraseSection() {
  const act = useCollectionAction()
  const collection = useCollectionStore((state) => state.collection)
  const [confirming, setConfirming] = useState(false)
  const synced = useSyncStore((state) => state.status !== 'local')
  const summary = summarize(collection)

  return (
    <DataSection id="effacer" title="Effacer ma collection" apart>
      <p>
        Supprime {synced ? 'de votre compte, sur tous vos appareils,' : 'de ce navigateur'} vos
        cartes ajoutées, leurs statuts, leurs prix payés et la liste d’achats. Les commandes et le
        budget sont conservés : ils gardent ce que vous avez dépensé.
      </p>
      <Button
        tone="danger"
        leftIcon={<Trash2 size={16} />}
        disabled={isEmptySummary(summary)}
        onClick={() => setConfirming(true)}
      >
        Effacer ma collection
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Effacer votre collection ?"
        confirmLabel="Effacer"
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          act(
            () => {
              useCollectionStore.getState().replaceCollection(emptyCollection())
              // La liste d'achats renvoie à des cartes qui ne reviendront pas : elle part avec elles.
              const { shopping, replaceShopping } = useShoppingStore.getState()
              replaceShopping({ ...shopping, preferences: {}, updatedAt: new Date().toISOString() })
            },
            'Collection effacée.',
            'info',
          )
        }
      >
        <p>
          Ceci sera effacé {synced ? 'de votre compte, sur tous vos appareils' : 'de ce navigateur'}{' '}
          :
        </p>
        <SummaryLedger summary={summary} />
        <p>Exportez d’abord votre collection si vous voulez pouvoir la retrouver.</p>
        <ExportCollectionButton>Exporter ma collection</ExportCollectionButton>
      </ConfirmDialog>
    </DataSection>
  )
}
