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

/**
 * Les trois groupes de la page, dans l'ordre : leur titre (et le lien du sommaire), leur phrase et
 * leurs panneaux.
 */
const GROUPS = [
  {
    id: 'compte-partage',
    label: 'Compte & partage',
    description: 'Votre identité et la vitrine publique de votre collection.',
    sections: (
      <>
        <AccountSection />
        <VitrineSection />
      </>
    ),
  },
  {
    id: 'sauvegarde',
    label: 'Sauvegarde',
    description: 'Le contenu enregistré, son export et son import.',
    sections: (
      <>
        <CollectionSection />
        <ExportSection />
        <ImportSection />
      </>
    ),
  },
  {
    id: 'avance',
    label: 'Avancé',
    description: 'Les alertes techniques et les actions irréversibles.',
    sections: (
      <>
        <ReferenceSection />
        <EraseSection />
      </>
    ),
  },
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
          {GROUPS.map(({ id, label, description, sections }) => (
            <section key={id} id={id} className={styles.group} aria-labelledby={`${id}-title`}>
              <header className={styles.groupHead}>
                <h2 id={`${id}-title`}>{label}</h2>
                <p>{description}</p>
              </header>
              <div className={styles.groupGrid}>{sections}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
