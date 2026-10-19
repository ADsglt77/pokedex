import { Button } from '@camply/ui'
import { Download } from '@camply/ui/icons'
import { useExportCollection } from '@/hooks/useExportCollection'

/**
 * Exporter avant de remplacer ou d'effacer la collection : un petit bouton secondaire, dans son
 * propre bloc (il ne s'étire pas dans une pile).
 */
export function ExportCollectionButton() {
  const exportCollection = useExportCollection()
  return (
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
  )
}
