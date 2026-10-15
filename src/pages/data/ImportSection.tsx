import { Alert, Button, FileUpload, type UploadFile } from '@camply/ui'
import { useRef, useState } from 'react'
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
 * collection et les achats (s'il en contient).
 */
export function ImportSection() {
  const act = useCollectionAction()
  const [files, setFiles] = useState<UploadFile[]>([])
  // `null` : le fichier choisi n'est pas un export.
  const [imported, setImported] = useState<ImportedFile | null>()
  const [confirming, setConfirming] = useState(false)
  // Le fichier choisi en dernier : la lecture, plus lente, d'un fichier remplacé depuis ne compte
  // plus (on importerait un autre fichier que celui affiché).
  const chosen = useRef<File | undefined>(undefined)

  const onFiles = async (next: UploadFile[]) => {
    setFiles(next)
    const file = next[0]?.file
    chosen.current = file
    // L'aperçu du fichier d'avant disparaît pendant la lecture : on n'importe que celui affiché.
    setImported(undefined)
    // Un fichier illisible (supprimé, inaccessible) compte pour un fichier qui n'est pas un export.
    const read = file ? parseImport(await file.text().catch(() => '')) : undefined
    if (chosen.current === file) setImported(read)
  }

  const reset = () => {
    chosen.current = undefined
    setFiles([])
    setImported(undefined)
  }

  const runImport = () => {
    act(() => {
      useCollectionStore.getState().replaceCollection(imported!.collection)
      if (imported!.shopping) useShoppingStore.getState().replaceShopping(imported!.shopping)
    }, 'Collection remplacée par celle du fichier.')
    reset()
  }

  const updatedAt = imported && formatDateTime(imported.collection.updatedAt)

  return (
    <DataSection
      id="importer"
      title="Importer"
      description="Reprenez une collection exportée depuis ce Pokédex, ici ou dans un autre navigateur. Elle remplace votre collection actuelle, ainsi que vos achats si le fichier en contient."
    >
      <FileUpload
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
        <div className={styles.preview}>
          <h3>Contenu du fichier</h3>
          {updatedAt && (
            <p className="muted">Collection modifiée pour la dernière fois le {updatedAt}.</p>
          )}
          <SummaryLedger summary={summarize(imported.collection)} />
          <p className="muted">
            {imported.shopping
              ? `Achats : ${plural(acceptedCount(imported.shopping, imported.collection), 'carte', 'cartes')} dans la liste d’achats, ${plural(imported.shopping.orders.length, 'commande', 'commandes')}.`
              : 'Ce fichier date d’avant le module d’achats : votre liste d’achats, vos commandes et votre budget actuels sont conservés.'}
          </p>
          <div className={styles.buttons}>
            <Button onClick={() => setConfirming(true)}>Importer</Button>
            <Button variant="ghost" onClick={reset}>
              Retirer ce fichier
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Remplacer vos données ?"
        confirmLabel="Remplacer"
        onClose={() => setConfirming(false)}
        onConfirm={runImport}
      >
        <p>
          Votre collection sera remplacée par celle du fichier, ainsi que vos achats s’il en
          contient. Vous pourrez annuler juste après l’import ; au-delà, seul un export vous
          permettra de les retrouver.
        </p>
      </ConfirmDialog>
    </DataSection>
  )
}
