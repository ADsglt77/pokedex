import { useNotify } from '@/hooks/useNotify'
import { buildExportFile, downloadExport } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'

/** Télécharge la collection et les réglages dans un fichier JSON daté. */
export function useExportCollection() {
  const notify = useNotify()
  return () => {
    const { collection, settings } = useCollectionStore.getState()
    const name = downloadExport(buildExportFile(collection, settings))
    notify(`Collection exportée : ${name}.`)
  }
}
