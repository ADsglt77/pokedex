import { useCallback } from 'react'
import { useNotify } from '@/hooks/useNotify'
import { report } from '@/lib/api'
import { buildExportFile, downloadExport } from '@/lib/transfer'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'

/** Télécharge la collection et les achats dans un fichier JSON daté (la même fonction d'un rendu à l'autre). */
export function useExportCollection() {
  const notify = useNotify()
  return useCallback(() => {
    const { collection } = useCollectionStore.getState()
    const { shopping } = useShoppingStore.getState()
    const name = downloadExport(buildExportFile(collection, shopping))
    report('export')
    notify(`Collection exportée : ${name}.`)
  }, [notify])
}
