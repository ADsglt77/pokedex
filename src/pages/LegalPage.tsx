import { Button } from '@camply/ui'
import { House } from '@camply/ui/icons'
import { Link } from 'react-router'
import { ExternalLink } from '@/components/ExternalLink'
import { Logo } from '@/components/Logo'
import { PageHeader } from '@/components/PageHeader'
import { SiteDisclaimer } from '@/components/SiteDisclaimer'
import { LEGAL } from '@/config/legal'
import { cx } from '@/lib/cx'
import { pageTitle } from '@/lib/format'
import styles from './LegalPage.module.css'

/** Ce qui manque encore (`config/legal.ts`), à remplir avant la mise en ligne. */
const TO_FILL = 'à compléter avant la mise en ligne'

/**
 * `/mentions-legales` : les mentions légales et la confidentialité, hors de la coquille, pour tous
 * (visiteur ou connecté) : l'éditeur, l'hébergeur et le contact (`config/legal.ts`), les droits
 * sur Pokémon, puis ce que le site garde des comptes, pourquoi, combien de temps, qui le voit, et
 * comment exercer ses droits. Le pied de page de chaque page y mène (`SiteDisclaimer`). À tenir à
 * jour avec ce que le serveur garde vraiment (`docs/compte-et-synchronisation.md`).
 */
export function LegalPage() {
  return (
    <div className={cx('container', styles.page)}>
      <title>{pageTitle('Mentions légales et confidentialité')}</title>
      <header className={styles.header}>
        <Logo>Pokédex</Logo>
        <Button asChild size="sm" variant="ghost" leftIcon={<House size={16} />}>
          <Link to="/">Revenir à l’accueil</Link>
        </Button>
      </header>
      <main className={styles.main}>
        <PageHeader title="Mentions légales et confidentialité">
          Mise à jour le 19 octobre 2026.
        </PageHeader>

        <section className={styles.section} aria-labelledby="editeur">
          <h2 id="editeur">Éditeur et hébergement</h2>
          <p>
            Ce site est un projet personnel, gratuit et sans but commercial, édité par un
            particulier. Comme la loi le permet à un particulier, son identité n’est pas publiée :
            elle est connue de l’hébergeur.
          </p>
          <p>Hébergeur : {LEGAL.host ? `${LEGAL.host.name}, ${LEGAL.host.address}` : TO_FILL}.</p>
          <p>
            Contact :{' '}
            {LEGAL.contact ? <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a> : TO_FILL}.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="droits">
          <h2 id="droits">Propriété intellectuelle</h2>
          <p>
            Pokémon, ainsi que les noms, images et cartes qui s’y rattachent, appartiennent à
            Nintendo, Creatures, Game Freak et The Pokémon Company. Ce site n’a aucun lien avec eux.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="donnees">
          <h2 id="donnees">Vos données</h2>
          <h3>Ce que le site garde</h3>
          <ul>
            <li>
              Votre compte : votre pseudo et votre mot de passe, chiffré (le site n’en garde qu’une
              empreinte, qui ne permet pas de le retrouver). Aucune adresse e-mail ne vous est
              demandée.
            </li>
            <li>Ce que vous y enregistrez : votre collection, vos achats et votre budget.</li>
            <li>
              Votre session : un cookie de connexion et, avec elle, l’adresse IP et le navigateur
              qui l’ont ouverte.
            </li>
            <li>
              Le journal du serveur : les actions sur les comptes (création, connexion, changements
              de la collection…) et les visites des Pokédex publics, avec l’adresse IP. Jamais un
              mot de passe.
            </li>
          </ul>
          <h3>Pourquoi</h3>
          <p>
            Pour vous rendre le service que vous demandez en créant un compte : garder votre
            collection, la retrouver sur vos appareils, montrer votre Pokédex public. Le journal
            sert à la sécurité du site (repérer un abus, une panne). Rien n’est vendu ni partagé, ni
            utilisé pour de la publicité ; pas de mesure d’audience.
          </p>
          <h3>Ce qui est public</h3>
          <p>
            Votre Pokédex public, à l’adresse de votre pseudo, montre à tous votre pseudo, les
            cartes que vous avez choisies et celles que vous possédez (avec leur date d’obtention),
            et leur valeur au prix du jour. Jamais vos prix payés, vos commandes ni votre budget.
          </p>
          <h3>Qui y a accès</h3>
          <p>
            L’éditeur du site, et l’hébergeur qui fait tourner son serveur. Le trafic passe par
            Cloudflare, Inc. (États-Unis), qui l’achemine et le protège, et voit donc les adresses
            IP.
          </p>
          <h3>Combien de temps</h3>
          <p>
            Votre compte et ce que vous y enregistrez, tant que le compte existe ; supprimé, il part
            aussitôt du serveur, et des copies de sauvegarde au bout de 90 jours au plus. Une
            session est fermée 60 jours après votre dernière visite, ou dès que vous vous connectez
            sur un autre appareil. Le journal du serveur, limité à 30 Mo, efface ses plus anciennes
            lignes au fil de l’eau, et repart de zéro à chaque mise à jour du site.
          </p>
          <h3>Vos droits</h3>
          <ul>
            <li>Obtenir vos données : Données › Exporter, un fichier de votre collection.</li>
            <li>
              Les corriger : tout se modifie dans le site, votre pseudo dans Données › Mon compte.
            </li>
            <li>Les effacer : Données › Mon compte › Supprimer mon compte.</li>
            <li>
              Pour toute autre demande, l’adresse de contact plus haut ; et en cas de désaccord, une
              réclamation auprès de la{' '}
              <ExternalLink href="https://www.cnil.fr/fr/plaintes">CNIL</ExternalLink>.
            </li>
          </ul>
          <h3>Cookies et stockage du navigateur</h3>
          <p>
            Un seul cookie, celui de votre session, nécessaire à la connexion : pas de bandeau à
            accepter. Votre navigateur garde aussi une copie de votre collection et votre choix de
            thème, pour que le site marche hors ligne ; se déconnecter efface la copie.
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        <SiteDisclaimer />
      </footer>
    </div>
  )
}
