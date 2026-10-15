import { Button } from '@camply/ui'
import { Copy, Download } from '@camply/ui/icons'
import { useNotify } from '@/hooks/useNotify'
import { plural } from '@/lib/format'
import { downloadCsv } from '@/lib/transfer'
import { searchText, wishlistCsv, type WishRow } from '@/lib/wishlist'

/** Copier les cartes pour la recherche de Cardmarket, ou les télécharger en CSV. */
export function ExportButtons({ rows, name }: { rows: readonly WishRow[]; name: string }) {
  const notify = useNotify()

  const copy = () => {
    // Hors https (le site ouvert par l'adresse de la machine sur le réseau local…), le navigateur
    // n'offre pas de presse-papiers.
    if (!navigator.clipboard) {
      notify('Copie impossible : le presse-papiers n’est accessible qu’en https.', {
        tone: 'danger',
      })
      return
    }
    void navigator.clipboard.writeText(rows.map((row) => searchText(row.card)).join('\n')).then(
      () =>
        notify(
          `${plural(rows.length, 'recherche copiée', 'recherches copiées')} : collez-les dans la recherche de Cardmarket.`,
        ),
      () =>
        notify('Copie impossible : le navigateur refuse l’accès au presse-papiers.', {
          tone: 'danger',
        }),
    )
  }

  const download = () => {
    const file = downloadCsv(name, wishlistCsv(rows))
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
