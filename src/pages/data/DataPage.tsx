import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'
import { ClassificationSection } from './ClassificationSection'
import { CollectionSection } from './CollectionSection'
import { EraseSection } from './EraseSection'
import { ExportSection } from './ExportSection'
import { ImportSection } from './ImportSection'
import { ReferenceSection } from './ReferenceSection'

export function DataPage() {
  return (
    <div className="container container--narrow">
      <title>{pageTitle('Données')}</title>
      <PageHeader title="Données">
        Sauvegarder, transférer ou effacer votre collection, et régler ce qui compte comme une
        illustration.
      </PageHeader>
      <CollectionSection />
      <ExportSection />
      <ImportSection />
      <ClassificationSection />
      <ReferenceSection />
      <EraseSection />
    </div>
  )
}
