import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'
import { CollectionSection } from './CollectionSection'
import { EraseSection } from './EraseSection'
import { ExportSection } from './ExportSection'
import { ImportSection } from './ImportSection'
import { ReferenceSection } from './ReferenceSection'
import { VitrineSection } from './VitrineSection'
import styles from './DataPage.module.css'

/** Les sections de la page, dans l'ordre, pour son sommaire. */
const SECTIONS = [
  { id: 'collection', label: 'Ma collection' },
  { id: 'public', label: 'Pokédex public' },
  { id: 'exporter', label: 'Exporter' },
  { id: 'importer', label: 'Importer' },
  { id: 'reference', label: 'Sources' },
  { id: 'effacer', label: 'Effacer' },
]

/**
 * Données : la collection, le Pokédex public, la sauvegarde (export, import), les sources,
 * l'effacement. Un sommaire (collé à gauche sur grand écran) mène à chaque section.
 */
export function DataPage() {
  return (
    <div className="container">
      <title>{pageTitle('Données')}</title>
      <PageHeader title="Données">Sauvegarder, transférer ou effacer votre collection.</PageHeader>
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Sur cette page">
          <ul>
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sections}>
          <CollectionSection />
          <VitrineSection />
          <ExportSection />
          <ImportSection />
          <ReferenceSection />
          <EraseSection />
        </div>
      </div>
    </div>
  )
}
