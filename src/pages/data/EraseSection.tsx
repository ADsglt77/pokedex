import { Button } from '@camply/ui'
import { Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { useCollectionAction } from '@/hooks/useNotify'
import { emptyCollection } from '@/lib/collection'
import { summarize } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'

/** Tout effacer, après confirmation (et une dernière chance d'exporter). */
export function EraseSection() {
  const act = useCollectionAction()
  const collection = useCollectionStore((state) => state.collection)
  const [confirming, setConfirming] = useState(false)
  const summary = summarize(collection)

  return (
    <DataSection
      id="effacer"
      title="Effacer ma collection"
      danger
      description="Supprime de votre compte, sur tous vos appareils, vos cartes ajoutées, leurs statuts et leurs prix payés. Les commandes et le budget sont conservés : ils gardent ce que vous avez dépensé."
    >
      <div>
        <Button
          variant="secondary"
          tone="danger"
          leftIcon={<Trash2 size={16} />}
          disabled={summary.cards === 0}
          onClick={() => setConfirming(true)}
        >
          Effacer ma collection
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Effacer votre collection ?"
        confirmLabel="Effacer"
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          act(
            () => useCollectionStore.getState().replaceCollection(emptyCollection()),
            'Collection effacée.',
            'info',
          )
        }
      >
        <p>Ceci sera effacé de votre compte, sur tous vos appareils :</p>
        <SummaryLedger summary={summary} />
        <p>Exportez d’abord votre collection si vous voulez pouvoir la retrouver.</p>
        <ExportCollectionButton>Exporter ma collection</ExportCollectionButton>
      </ConfirmDialog>
    </DataSection>
  )
}
