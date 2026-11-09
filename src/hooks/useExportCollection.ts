import { useCallback } from 'react'
import { useNotify } from '@/hooks/useNotify'
import { report } from '@/lib/api'
import { localDayOf, today } from '@/lib/format'
import { buildExportFile } from '@/lib/transfer'
import { setAsideExported, type SetAside } from '@/store/account'
import { currentDocument } from '@/store/document'
import type { CollectionDocument } from '@/types'

/** Télécharge `document` dans un fichier d'export nommé `name` (« Exporter », puis le journal). */
function downloadExport({ collection, shopping }: CollectionDocument, name: string) {
  const file = buildExportFile(collection, shopping)
  const json = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(json)
  // Firefox ne télécharge que par un lien présent dans la page, et lit le fichier après le clic.
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  report('export')
}

/** Télécharge la collection et les achats dans un fichier JSON daté (la même fonction d'un rendu à l'autre). */
export function useExportCollection() {
  const notify = useNotify()
  return useCallback(() => {
    const name = `pokedex-collection-${today()}.json`
    downloadExport(currentDocument(), name)
    notify(`Collection exportée : ${name}.`)
  }, [notify])
}

/**
 * Télécharge une version mise de côté, dans le même format que la collection (l'import des
 * Réglages la reprend), datée de son remplacement (« …-2026-11-09-14h32.json »), et la note
 * exportée : quitter la page ne le demande plus pour elle.
 */
export function useExportSetAside() {
  const notify = useNotify()
  return useCallback(
    ({ id, document, at }: SetAside) => {
      const time = new Date(at).toTimeString().slice(0, 5).replace(':', 'h')
      const name = `pokedex-version-mise-de-cote-${localDayOf(at)}-${time}.json`
      downloadExport(document, name)
      setAsideExported(id)
      notify(`Version exportée : ${name}.`)
    },
    [notify],
  )
}
