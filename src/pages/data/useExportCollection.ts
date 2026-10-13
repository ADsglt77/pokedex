import { useNotify } from '@/hooks/useNotify'
import { buildExportFile, downloadExport } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { markExported } from '@/store/persist'
import { useShoppingStore } from '@/store/shopping'

/** Télécharge la collection et les achats dans un fichier JSON daté. */
export function useExportCollection() {
  const notify = useNotify()
  return () => {
    const { collection } = useCollectionStore.getState()
    const { shopping } = useShoppingStore.getState()
    const name = downloadExport(buildExportFile(collection, shopping))
    markExported(new Date().toISOString())
    notify(`Collection exportée : ${name}.`)
  }
}
