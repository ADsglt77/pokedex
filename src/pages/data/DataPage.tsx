import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'
import { BookmarkletSection } from './BookmarkletSection'
import { CollectionSection } from './CollectionSection'
import { EraseSection } from './EraseSection'
import { ExportSection } from './ExportSection'
import { ImportSection } from './ImportSection'
import { ReferenceSection } from './ReferenceSection'

/**
 * Données : la collection, le favori Cardmarket, la sauvegarde (export, import), les sources,
 * l'effacement.
 */
export function DataPage() {
  return (
    <div className="container container--narrow">
      <title>{pageTitle('Données')}</title>
      <PageHeader title="Données">
        Installer le favori Cardmarket ; sauvegarder, transférer ou effacer votre collection.
      </PageHeader>
      <CollectionSection />
      <BookmarkletSection />
      <ExportSection />
      <ImportSection />
      <ReferenceSection />
      <EraseSection />
    </div>
  )
}
