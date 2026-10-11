import { Button } from '@camply/ui'
import { Download } from '@camply/ui/icons'
import { DataSection } from './DataSection'
import { useExportCollection } from './useExportCollection'

export function ExportSection() {
  const exportCollection = useExportCollection()
  return (
    <DataSection id="exporter" title="Exporter">
      <p>
        Un fichier JSON avec toute votre collection et les raretés suivies. Gardez-le pour
        sauvegarder votre collection, ou importez-le dans un autre navigateur.
      </p>
      <Button variant="primary" leftIcon={<Download size={16} />} onClick={exportCollection}>
        Exporter ma collection
      </Button>
    </DataSection>
  )
}
