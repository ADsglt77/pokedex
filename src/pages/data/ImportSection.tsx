import { Alert, Button, FileUpload, type UploadFile } from '@camply/ui'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCollectionAction } from '@/hooks/useNotify'
import { focusAfter } from '@/lib/focus'
import { summarize } from '@/lib/pokedex'
import { formatDateTime, plural } from '@/lib/format'
import { readImport } from '@/lib/transfer'
import { report } from '@/lib/api'
import { replaceDocument } from '@/store/document'
import { DataSection } from './DataSection'
import { SummaryLedger } from './SummaryLedger'
import styles from './DataPage.module.css'

/** « ce n'est pas… » → « Ce n'est pas…. » : la raison d'un refus, en phrase. */
const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`

/**
 * Reprendre un export : le fichier est lu et résumé, puis, après confirmation, il remplace la
 * collection et les achats.
 */
export function ImportSection() {
  const act = useCollectionAction()
  const [files, setFiles] = useState<UploadFile[]>([])
  // Le fichier choisi, lu : son contenu, ou la raison de son refus.
  const [read, setRead] = useState<ReturnType<typeof readImport>>()
  const imported = read?.document
  const [confirming, setConfirming] = useState(false)
  // Le fichier choisi en dernier : la lecture, plus lente, d'un fichier remplacé depuis ne compte
  // plus (on importerait un autre fichier que celui affiché).
  const chosen = useRef<File | undefined>(undefined)
  const title = useRef<HTMLHeadingElement>(null)

  const onFiles = async (next: UploadFile[]) => {
    setFiles(next)
    const file = next[0]?.file
    chosen.current = file
    // L'aperçu du fichier d'avant disparaît pendant la lecture : on n'importe que celui affiché.
    setRead(undefined)
    // Un fichier illisible (supprimé, inaccessible) compte pour un fichier qui n'est pas un export.
    const result = file ? readImport(await file.text().catch(() => '')) : undefined
    if (chosen.current === file) setRead(result)
  }

  // L'aperçu et ses boutons disparaissent : le focus va au titre de la section.
  const reset = () =>
    focusAfter(() => {
      chosen.current = undefined
      setFiles([])
      setRead(undefined)
    }, title)

  const runImport = () => {
    act(() => replaceDocument(imported!), 'Collection remplacée par celle du fichier.')
    report('import')
    reset()
  }

  const updatedAt = imported && formatDateTime(imported.collection.updatedAt)

  return (
    <DataSection
      id="importer"
      title="Importer"
      titleRef={title}
      description="Reprenez une collection exportée depuis ce Pokédex, ici ou dans un autre navigateur. Elle remplace votre collection et vos achats actuels."
    >
      <FileUpload
        label="Fichier d’export"
        hint="Fichier .json de 20 Mo au plus."
        accept=".json,application/json"
        maxSize={20 * 1024 * 1024}
        files={files}
        onFilesChange={onFiles}
      />

      {read?.problem && (
        <Alert tone="danger" title="Ce fichier ne peut pas être importé.">
          {sentence(read.problem)}
        </Alert>
      )}

      {imported && (
        <div className={styles.preview}>
          <h4>Contenu du fichier</h4>
          {updatedAt && (
            <p className="muted">Collection modifiée pour la dernière fois le {updatedAt}.</p>
          )}
          <SummaryLedger summary={summarize(imported.collection)} />
          <p className="muted">
            Achats : {plural(imported.shopping.orders.length, 'commande', 'commandes')}.
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
          Votre collection et vos achats seront remplacés par ceux du fichier. Vous pourrez annuler
          juste après l’import ; au-delà, seul un export vous permettra de les retrouver.
        </p>
      </ConfirmDialog>
    </DataSection>
  )
}
