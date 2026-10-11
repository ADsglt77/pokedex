import { Alert, Button, FileUpload, Stack, type UploadFile } from '@camply/ui'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCollectionAction } from '@/hooks/useNotify'
import { isEmptySummary, summarize } from '@/lib/collection'
import { formatDateTime, plural } from '@/lib/format'
import { parseImport, type ParsedImport } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'
import styles from './DataPage.module.css'

export function ImportSection() {
  const act = useCollectionAction()
  const currentIsEmpty = useCollectionStore((state) => isEmptySummary(summarize(state.collection)))
  const [files, setFiles] = useState<UploadFile[]>([])
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Le dernier fichier choisi : la lecture d'un fichier remplacé entre-temps est ignorée.
  const selected = useRef<File | null>(null)

  const onFiles = async (next: UploadFile[]) => {
    setFiles(next)
    const file = next[0]?.file ?? null
    selected.current = file
    setParsed(null)
    if (!file) return
    const result = parseImport(await file.text())
    if (selected.current === file) setParsed(result)
  }

  const reset = () => {
    selected.current = null
    setFiles([])
    setParsed(null)
  }

  const runImport = () => {
    if (!parsed?.ok) return
    act(() => {
      const store = useCollectionStore.getState()
      store.replaceCollection(parsed.collection)
      if (parsed.settings) store.replaceSettings(parsed.settings)
    }, 'Collection remplacée par celle du fichier.')
    reset()
  }

  const updatedAt = parsed?.ok ? formatDateTime(parsed.collection.updatedAt) : null

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

      {parsed && !parsed.ok && (
        <Alert tone="danger" title="Ce fichier ne peut pas être importé.">
          {parsed.error}
        </Alert>
      )}

      {parsed?.ok && (
        <Stack gap={4} className={styles.group}>
          <h3 className={styles.groupTitle}>Contenu du fichier</h3>
          {updatedAt && (
            <p className="muted">Collection modifiée pour la dernière fois le {updatedAt}.</p>
          )}
          <SummaryLedger summary={summarize(parsed.collection)} />
          {parsed.dropped > 0 && (
            <Alert tone="warn">
              {plural(
                parsed.dropped,
                'élément illisible sera ignoré',
                'éléments illisibles seront ignorés',
              )}
              .
            </Alert>
          )}

          <Stack direction="horizontal" gap={3} wrap>
            <Button
              variant="primary"
              onClick={() => (currentIsEmpty ? runImport() : setConfirming(true))}
            >
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
