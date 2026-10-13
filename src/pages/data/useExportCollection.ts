import { useNotify } from '@/hooks/useNotify'
import { buildExportFile, downloadExport } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'

/** Télécharge la collection et les achats dans un fichier JSON daté. */
export function useExportCollection() {
  const notify = useNotify()
  return () => {
    const { collection } = useCollectionStore.getState()
    const { shopping } = useShoppingStore.getState()
    const name = downloadExport(buildExportFile(collection, shopping))
    notify(`Collection exportée : ${name}.`)
  }
}
