import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { DataSection } from './DataSection'

/** Télécharger la collection : une sauvegarde, ou de quoi la reprendre dans un autre compte. */
export function ExportSection() {
  return (
    <DataSection
      id="exporter"
      title="Exporter"
      description="Un fichier JSON avec toute votre collection (vos cartes, leurs statuts et prix payés), vos commandes et votre budget. Gardez-le pour sauvegarder votre collection, ou importez-le dans un autre compte."
    >
      <ExportCollectionButton primary />
    </DataSection>
  )
}
