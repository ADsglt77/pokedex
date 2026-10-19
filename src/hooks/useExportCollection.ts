import { useCallback } from 'react'
import { useNotify } from '@/hooks/useNotify'
import { report } from '@/lib/api'
import { today } from '@/lib/format'
import { buildExportFile } from '@/lib/transfer'
import { currentDocument } from '@/store/document'
import type { CollectionExportFile } from '@/types'

/** Télécharge le fichier d'export, daté du jour de l'utilisateur ; rend son nom. */
function downloadExport(file: CollectionExportFile): string {
  const name = `pokedex-collection-${today()}.json`
  const json = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(json)
  // Firefox ne télécharge que par un lien présent dans la page, et lit le fichier après le clic.
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return name
}

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
