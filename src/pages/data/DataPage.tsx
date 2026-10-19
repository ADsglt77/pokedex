import { PageHeader } from '@/components/PageHeader'
import { pageTitle } from '@/lib/format'
import { AccountSection } from './AccountSection'
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
  { id: 'compte', label: 'Mon compte' },
  { id: 'public', label: 'Pokédex public' },
  { id: 'exporter', label: 'Exporter' },
  { id: 'importer', label: 'Importer' },
  { id: 'reference', label: 'Serveur' },
  { id: 'effacer', label: 'Effacer' },
]

/**
 * Données : la collection, le compte (pseudo, mot de passe, suppression), le Pokédex public, la
 * sauvegarde (export, import), les données du serveur, l'effacement. Un sommaire (collé à gauche
 * sur grand écran) mène à chaque section.
 */
export function DataPage() {
  return (
    <div className="container">
      <title>{pageTitle('Données')}</title>
      <PageHeader title="Données">
        Votre collection, votre compte, votre Pokédex public et les données du serveur ;
        sauvegarder, transférer ou effacer votre collection.
      </PageHeader>
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
          <AccountSection />
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
