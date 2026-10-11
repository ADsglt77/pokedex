import { Alert, Button, FileUpload, Stack, type UploadFile } from '@camply/ui'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCollectionAction } from '@/hooks/useNotify'
import { isEmptySummary, summarize } from '@/lib/collection'
import { formatDateTime } from '@/lib/format'
import { type ImportedFile, parseImport } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'
import styles from './DataPage.module.css'

/**
 * Reprendre un export : le fichier est lu et résumé, puis il remplace la collection et les
 * raretés suivies (après confirmation si la collection actuelle n'est pas vide).
 */
export function ImportSection() {
  const act = useCollectionAction()
  const currentIsEmpty = useCollectionStore((state) => isEmptySummary(summarize(state.collection)))
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
    if (!imported) return
    act(() => {
      const store = useCollectionStore.getState()
      store.replaceCollection(imported.collection)
      store.replaceSettings(imported.settings)
    }, 'Collection remplacée par celle du fichier.')
    reset()
  }

  const updatedAt = imported && formatDateTime(imported.collection.updatedAt)

  return (
    <DataSection id="importer" title="Importer">
      <p>
        Reprenez une collection exportée depuis ce Pokédex, ici ou dans un autre navigateur. Elle
        remplace votre collection actuelle, raretés suivies comprises.
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
          Ce n’est pas un export de collection de ce Pokédex.
        </Alert>
      )}

      {imported && (
        <Stack gap={4} className={styles.group}>
          <h3 className={styles.groupTitle}>Contenu du fichier</h3>
          {updatedAt && (
            <p className="muted">Collection modifiée pour la dernière fois le {updatedAt}.</p>
          )}
          <SummaryLedger summary={summarize(imported.collection)} />
          <Stack direction="horizontal" gap={3} wrap>
            <Button onClick={() => (currentIsEmpty ? runImport() : setConfirming(true))}>
              Importer
            </Button>
            <Button variant="ghost" onClick={reset}>
              Retirer ce fichier
            </Button>
          </Stack>
        </Stack>
      )}

      <ConfirmDialog
        open={confirming}
        title="Remplacer votre collection ?"
        confirmLabel="Remplacer"
        onClose={() => setConfirming(false)}
        onConfirm={runImport}
      >
        <p>
          Votre collection actuelle sera remplacée par celle du fichier. Vous pourrez annuler juste
          après l’import ; au-delà, seul un export vous permettra de la retrouver.
        </p>
      </ConfirmDialog>
    </DataSection>
  )
}
