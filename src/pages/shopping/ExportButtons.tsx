import { Button } from '@camply/ui'
import { Copy, Download } from '@camply/ui/icons'
import { useNotify } from '@/hooks/useNotify'
import { plural, today } from '@/lib/format'
import { downloadFile } from '@/lib/transfer'
import { searchText, wishlistCsv, type WishRow } from '@/lib/wishlist'

/** Le BOM UTF-8 : sans lui, Excel lit mal les accents d'un CSV. */
const BOM = String.fromCharCode(0xfeff)

/** Copier les cartes pour la recherche de Cardmarket, ou les télécharger en CSV. */
export function ExportButtons({ rows, name }: { rows: readonly WishRow[]; name: string }) {
  const notify = useNotify()

  const copy = () =>
    navigator.clipboard.writeText(rows.map((row) => searchText(row.card)).join('\n')).then(
      () =>
        notify(
          `${plural(rows.length, 'recherche copiée', 'recherches copiées')} : collez-les dans la recherche de Cardmarket.`,
        ),
      () =>
        notify('Copie impossible : le navigateur refuse l’accès au presse-papiers.', {
          tone: 'danger',
        }),
    )

  const download = () => {
    const file = `${name}-${today()}.csv`
    downloadFile(file, BOM + wishlistCsv(rows), 'text/csv;charset=utf-8')
    notify(`${plural(rows.length, 'carte exportée', 'cartes exportées')} : ${file}.`)
  }

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Copy size={14} />}
        disabled={rows.length === 0}
        onClick={copy}
      >
        Copier les recherches
      </Button>
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Download size={14} />}
        disabled={rows.length === 0}
        onClick={download}
      >
        Exporter en CSV
      </Button>
    </>
  )
}
