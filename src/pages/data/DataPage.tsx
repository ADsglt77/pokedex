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

/** Les trois groupes stables de la page, dans l'ordre, pour son sommaire. */
const GROUPS = [
  { id: 'compte-partage', label: 'Compte & partage' },
  { id: 'sauvegarde', label: 'Sauvegarde' },
  { id: 'avance', label: 'Avancé' },
]

/**
 * Réglages : trois groupes lisibles plutôt qu'une longue liste de fonctions au même niveau.
 */
export function DataPage() {
  return (
    <div className="container">
      <title>{pageTitle('Réglages')}</title>
      <PageHeader title="Réglages">
        Gérez votre compte, le partage de votre Pokédex et les sauvegardes de votre collection.
      </PageHeader>
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Sur cette page">
          <ul>
            {GROUPS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.groups}>
          <section
            id="compte-partage"
            className={styles.group}
            aria-labelledby="compte-partage-title"
          >
            <header className={styles.groupHead}>
              <h2 id="compte-partage-title">Compte & partage</h2>
              <p>Votre identité et la vitrine publique de votre collection.</p>
            </header>
            <div className={styles.groupGrid}>
              <AccountSection />
              <VitrineSection />
            </div>
          </section>

          <section id="sauvegarde" className={styles.group} aria-labelledby="sauvegarde-title">
            <header className={styles.groupHead}>
              <h2 id="sauvegarde-title">Sauvegarde</h2>
              <p>Le contenu enregistré, son export et son import.</p>
            </header>
            <div className={styles.groupGrid}>
              <CollectionSection />
              <ExportSection />
              <ImportSection />
            </div>
          </section>

          <section id="avance" className={styles.group} aria-labelledby="avance-title">
            <header className={styles.groupHead}>
              <h2 id="avance-title">Avancé</h2>
              <p>Les alertes techniques et les actions irréversibles.</p>
            </header>
            <div className={styles.groupGrid}>
              <ReferenceSection />
              <EraseSection />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
