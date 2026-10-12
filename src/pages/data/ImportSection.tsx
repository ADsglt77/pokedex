import { Alert, Button, FileUpload, Stack, type UploadFile } from '@camply/ui'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCollectionAction } from '@/hooks/useNotify'
import { summarize } from '@/lib/pokedex'
import { formatDateTime, plural } from '@/lib/format'
import { type ImportedFile, parseImport } from '@/lib/transfer'
import { acceptedCount } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'
import styles from './DataPage.module.css'

/**
 * Reprendre un export : le fichier est lu et résumé, puis, après confirmation, il remplace la
 * collection, les raretés suivies et les achats (s'il en contient).
 */
export function ImportSection() {
  const act = useCollectionAction()
  const [files, setFiles] = useState<UploadFile[]>([])
  // `null` : le fichier choisi n'est pas un export.
  const [imported, setImported] = useState<ImportedFile | null>()
  const [confirming, setConfirming] = useState(false)

  const onFiles = async (next: UploadFile[]) => {
    setFiles(next)
    const file = next[0]?.file
    setImported(file ? parseImport(await file.text()) : undefined)
  }

  const reset = () => {
    setFiles([])
    setImported(undefined)
  }

  const runImport = () => {
    act(() => {
      const store = useCollectionStore.getState()
      store.replaceCollection(imported!.collection)
      store.replaceSettings(imported!.settings)
      if (imported!.shopping) useShoppingStore.getState().replaceShopping(imported!.shopping)
    }, 'Collection remplacée par celle du fichier.')
    reset()
  }

  const updatedAt = imported && formatDateTime(imported.collection.updatedAt)

  return (
    <DataSection id="importer" title="Importer">
      <p>
        Reprenez une collection exportée depuis ce Pokédex, ici ou dans un autre navigateur. Elle
        remplace votre collection actuelle et les raretés suivies, ainsi que vos achats si le
        fichier en contient.
      </p>

      <FileUpload
        className={styles.group}
        label="Fichier d’export"
        hint="Fichier .json de 20 Mo au plus."
        accept=".json,application/json"
        maxSize={20 * 1024 * 1024}
        files={files}
        onFilesChange={onFiles}
      />

      {imported === null && (
        <Alert tone="danger" title="Ce fichier ne peut pas être importé.">
          Ce n’est pas un export de collection de ce Pokédex, ou il a été abîmé.
        </Alert>
      )}

      {imported && (
        <Stack gap={4} className={styles.group}>
          <h3 className={styles.groupTitle}>Contenu du fichier</h3>
          {updatedAt && (
            <p className="muted">Collection modifiée pour la dernière fois le {updatedAt}.</p>
          )}
          <SummaryLedger summary={summarize(imported.collection)} />
          <p className="muted">
            {imported.shopping
              ? `Achats : ${plural(acceptedCount(imported.shopping), 'carte', 'cartes')} dans la liste d’achats, ${plural(imported.shopping.orders.length, 'commande', 'commandes')}.`
              : 'Ce fichier date d’avant le module d’achats : votre liste d’achats, vos commandes et votre budget actuels sont conservés.'}
          </p>
          <Stack direction="horizontal" gap={3} wrap>
            <Button onClick={() => setConfirming(true)}>Importer</Button>
            <Button variant="ghost" onClick={reset}>
              Retirer ce fichier
            </Button>
          </Stack>
        </Stack>
      )}

      <ConfirmDialog
        open={confirming}
        title="Remplacer vos données ?"
        confirmLabel="Remplacer"
        onClose={() => setConfirming(false)}
        onConfirm={runImport}
      >
        <p>
          Votre collection et les raretés suivies seront remplacées par celles du fichier, ainsi que
          vos achats s’il en contient. Vous pourrez annuler juste après l’import ; au-delà, seul un
          export vous permettra de les retrouver.
        </p>
      </ConfirmDialog>
    </DataSection>
  )
}
