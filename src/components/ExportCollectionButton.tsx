import { Button } from '@camply/ui'
import { Download } from '@camply/ui/icons'
import { useExportCollection } from '@/hooks/useExportCollection'

/**
 * Le bouton « Exporter ma collection », dans son propre bloc (il ne s'étire pas dans une pile) :
 * l'action de la section Exporter des Réglages (`primary`), sinon un petit bouton secondaire, pour
 * exporter avant de remplacer ou d'effacer la collection.
 */
export function ExportCollectionButton({ primary }: { primary?: boolean }) {
  const exportCollection = useExportCollection()
  return (
    <div>
      <Button
        size={primary ? undefined : 'sm'}
        variant={primary ? 'primary' : 'secondary'}
        leftIcon={<Download size={primary ? 16 : 14} />}
        onClick={exportCollection}
      >
        Exporter ma collection
      </Button>
    </div>
  )
}
