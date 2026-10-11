import { Button } from '@camply/ui'
import { Download, Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCollectionAction } from '@/hooks/useNotify'
import { emptyCollection, isEmptySummary, summarize } from '@/lib/collection'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'
import { useExportCollection } from './useExportCollection'

export function EraseSection() {
  const act = useCollectionAction()
  const exportCollection = useExportCollection()
  const collection = useCollectionStore((state) => state.collection)
  const replaceCollection = useCollectionStore((state) => state.replaceCollection)
  const [confirming, setConfirming] = useState(false)
  const summary = summarize(collection)

  return (
    <DataSection id="effacer" title="Effacer ma collection" apart>
      <p>
        Supprime de ce navigateur tous vos statuts de carte, prix payés et illustrations choisies.
        Les raretés suivies sont conservées.
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
          act(() => replaceCollection(emptyCollection()), 'Collection effacée.', 'info')
        }
      >
        <p>Ceci sera effacé de ce navigateur :</p>
        <SummaryLedger summary={summary} />
        <p>Exportez-la d’abord si vous voulez pouvoir la retrouver.</p>
        <div>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download size={14} />}
            onClick={exportCollection}
          >
            Exporter ma collection
          </Button>
        </div>
      </ConfirmDialog>
    </DataSection>
  )
}
