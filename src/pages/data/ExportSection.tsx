import { Button } from '@camply/ui'
import { Download } from '@camply/ui/icons'
import { DataSection } from './DataSection'
import { useExportCollection } from '@/hooks/useExportCollection'

/** Télécharger la collection : une sauvegarde, ou de quoi la reprendre dans un autre navigateur. */
export function ExportSection() {
  const exportCollection = useExportCollection()
  return (
    <DataSection
      id="exporter"
      title="Exporter"
      description="Un fichier JSON avec toute votre collection (vos cartes, leurs statuts et prix payés), vos commandes et votre budget. Gardez-le pour sauvegarder votre collection, ou importez-le dans un autre navigateur."
    >
      <div>
        <Button variant="primary" leftIcon={<Download size={16} />} onClick={exportCollection}>
          Exporter ma collection
        </Button>
      </div>
    </DataSection>
  )
}
