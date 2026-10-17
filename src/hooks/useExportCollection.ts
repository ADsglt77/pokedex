import { useCallback } from 'react'
import { useNotify } from '@/hooks/useNotify'
import { report } from '@/lib/api'
import { buildExportFile, downloadExport } from '@/lib/transfer'
import { currentDocument } from '@/store/document'

/** Télécharge la collection et les achats dans un fichier JSON daté (la même fonction d'un rendu à l'autre). */
export function useExportCollection() {
  const notify = useNotify()
  return useCallback(() => {
    const { collection, shopping } = currentDocument()
    const name = downloadExport(buildExportFile(collection, shopping))
    report('export')
    notify(`Collection exportée : ${name}.`)
  }, [notify])
}
