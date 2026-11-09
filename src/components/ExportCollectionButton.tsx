import { Button } from '@camply/ui'
import { Download } from '@camply/ui/icons'
import { useExportCollection, useExportSetAside } from '@/hooks/useExportCollection'
import { formatDateTime } from '@/lib/format'
import { useAccountStore } from '@/store/account'

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

/**
 * Un bouton « Exporter ma version du … » par version mise de côté (`store/account.ts`), à côté
 * d'« Exporter ma collection » avant de quitter le compte ; rien sans elles.
 */
export function SetAsideExportButtons() {
  const setAside = useAccountStore((state) => state.setAside)
  const exportSetAside = useExportSetAside()
  return setAside.map((version) => (
    <div key={version.id}>
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Download size={14} />}
        onClick={() => exportSetAside(version)}
      >
        Exporter ma version du {formatDateTime(version.at)}
      </Button>
    </div>
  ))
}
