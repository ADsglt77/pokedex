import { Button } from '@camply/ui'
import { Download } from '@camply/ui/icons'
import { DataSection } from './DataSection'
import { useExportCollection } from './useExportCollection'

/** Télécharger la collection : la seule sauvegarde, la collection ne vivant que dans ce navigateur. */
export function ExportSection() {
  const exportCollection = useExportCollection()
  return (
    <DataSection id="exporter" title="Exporter">
      <p>
        Un fichier JSON avec toute votre collection, prix payés compris, les raretés suivies, votre
        liste d’achats, vos commandes et votre budget. Gardez-le pour sauvegarder votre collection,
        ou importez-le dans un autre navigateur.
      </p>
      <Button variant="primary" leftIcon={<Download size={16} />} onClick={exportCollection}>
        Exporter ma collection
      </Button>
    </DataSection>
  )
}
