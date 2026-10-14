import { Button, Modal, Stack } from '@camply/ui'
import { ExportCollectionButton } from '@/components/ExportCollectionButton'
import { details, formatDateTime, plural } from '@/lib/format'
import type { SyncDocument } from '@/lib/sync'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { keepServer, keepThisDevice, useSyncStore } from '@/store/sync'

/** « 42 cartes · 3 commandes · modifiée le 14 octobre 2026 à 10:12 » */
const describe = ({ collection, shopping }: SyncDocument) =>
  details(
    plural(Object.keys(collection.customCards).length, 'carte', 'cartes'),
    plural(shopping.orders.length, 'commande', 'commandes'),
    collection.updatedAt && `modifiée le ${formatDateTime(collection.updatedAt)}`,
  )

/**
 * Cet appareil et le serveur ont chacun changé la collection : l'utilisateur garde l'une, l'autre
 * est remplacée (pas de fusion, comme à l'import). Exporter la version de cet appareil d'abord
 * permet de ne rien perdre. Fermée, la question attend (la synchronisation aussi) : le menu du
 * compte la rouvre.
 */
export function SyncConflictDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const conflict = useSyncStore((state) => state.conflict)
  const collection = useCollectionStore((state) => state.collection)
  const shopping = useShoppingStore((state) => state.shopping)
  if (!conflict) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Deux versions de votre collection"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Plus tard
          </Button>
          <Button variant="secondary" onClick={keepServer}>
            Garder celle du serveur
          </Button>
          <Button onClick={() => void keepThisDevice()}>Garder celle de cet appareil</Button>
        </>
      }
    >
      <Stack gap={3}>
        <p>
          Cet appareil et vos autres appareils ont chacun modifié la collection depuis la dernière
          synchronisation. Choisissez la version à garder : l’autre sera remplacée.
        </p>
        <ul>
          <li>Cet appareil : {describe({ collection, shopping })}</li>
          <li>Le serveur : {describe(conflict.document)}</li>
        </ul>
        <p>Pour ne rien perdre, exportez d’abord la version de cet appareil.</p>
        <ExportCollectionButton>Exporter la version de cet appareil</ExportCollectionButton>
      </Stack>
    </Modal>
  )
}
