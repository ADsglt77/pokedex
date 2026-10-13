import { Button } from '@camply/ui'
import { Download, Trash2 } from '@camply/ui/icons'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCollectionAction } from '@/hooks/useNotify'
import { emptyCollection } from '@/lib/collection'
import { isEmptySummary, summarize } from '@/lib/pokedex'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'
import { useExportCollection } from './useExportCollection'

/** Tout effacer, après confirmation (et une dernière chance d'exporter). */
export function EraseSection() {
  const act = useCollectionAction()
  const exportCollection = useExportCollection()
  const collection = useCollectionStore((state) => state.collection)
  const [confirming, setConfirming] = useState(false)
  const summary = summarize(collection)

  return (
    <DataSection id="effacer" title="Effacer ma collection" apart>
      <p>
        Supprime de ce navigateur vos cartes ajoutées, leurs statuts et leurs prix payés. La liste
        d’achats, les commandes et le budget sont conservés.
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
            () => useCollectionStore.getState().replaceCollection(emptyCollection()),
            'Collection effacée.',
            'info',
          )
        }
      >
        <p>Ceci sera effacé de ce navigateur :</p>
        <SummaryLedger summary={summary} />
        <p>Exportez d’abord votre collection si vous voulez pouvoir la retrouver.</p>
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
