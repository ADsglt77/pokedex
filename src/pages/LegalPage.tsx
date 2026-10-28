import { Button } from '@camply/ui'
import { House } from '@camply/ui/icons'
import { Link } from 'react-router'
import { ExternalLink } from '@/components/ExternalLink'
import { PageHeader } from '@/components/PageHeader'
import { StandalonePage } from '@/components/StandalonePage'
import { LEGAL } from '@/config/legal'
import { pageTitle } from '@/lib/format'
import styles from './LegalPage.module.css'

/**
 * `/mentions-legales` : les mentions légales et la confidentialité, hors de la coquille, pour tous
 * (visiteur ou connecté) : le site, l'éditeur, l'hébergeur et où est le serveur, le contact
 * (`config/legal.ts`), les droits sur Pokémon, puis ce que le site garde des comptes, pourquoi
 * (et sur quelle base légale), combien de temps, qui le voit, et comment exercer ses droits. Le
 * pied de page de chaque page y mène (`SiteDisclaimer`). À tenir à jour avec ce que le serveur
 * garde vraiment (`docs/compte-et-synchronisation.md`). Espaces insécables devant « : » (U+00A0,
 * `&nbsp;`), fines devant « ; ! ? » (U+202F, `&#8239;`).
 */
export function LegalPage() {
  return (
    <StandalonePage
      className={styles.main}
      actions={
        <Button asChild size="sm" variant="ghost" leftIcon={<House size={16} />}>
          <Link to="/">Revenir à l’accueil</Link>
        </Button>
      }
    >
      <title>{pageTitle('Mentions légales et confidentialité')}</title>
      <PageHeader title="Mentions légales et confidentialité">
        Mise à jour le 21 octobre 2026.
      </PageHeader>

      <section className={styles.section} aria-labelledby="editeur">
        <h2 id="editeur">Éditeur et hébergement</h2>
        <p>
          {LEGAL.site.name}, {LEGAL.site.domain}, est un projet personnel, gratuit et sans but
          commercial, édité par un particulier. Comme la loi le permet à un particulier, son
          identité n’est pas publiée&nbsp;: elle est connue de l’hébergeur.
        </p>
        <p>
          Hébergeur&nbsp;: {LEGAL.host.name}, {LEGAL.host.address} — téléphone&nbsp;:{' '}
          {LEGAL.host.phone}. Le serveur est à {LEGAL.host.location}.
        </p>
        <p>
          Contact&nbsp;: <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>.
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
        <p>
          Le responsable de leur traitement est l’éditeur du site, joignable à l’adresse de contact.
        </p>
        <h3>Ce que le site garde</h3>
        <ul>
          <li>
            Votre compte&nbsp;: votre pseudo et votre mot de passe, haché (le site n’en garde qu’une
            empreinte, qui ne permet pas de le retrouver). Aucune adresse e-mail ne vous est
            demandée.
          </li>
          <li>Ce que vous y enregistrez&nbsp;: votre collection, vos achats et votre budget.</li>
          <li>
            Votre session&nbsp;: un cookie de connexion et, avec elle, l’adresse IP et le navigateur
            qui l’ont ouverte.
          </li>
          <li>
            Le journal du serveur&nbsp;: les actions sur les comptes (création, connexion,
            changements de la collection…) et les visites des Pokédex publics, avec l’adresse IP.
            Jamais un mot de passe.
          </li>
        </ul>
        <h3>Pourquoi</h3>
        <p>
          Pour vous rendre le service que vous demandez en créant un compte&nbsp;: garder votre
          collection, la retrouver sur vos appareils, montrer votre Pokédex public. Sa base
          légale&nbsp;: l’exécution de ce service. Le journal du serveur sert à la sécurité du site
          (repérer un abus, une panne)&#8239;; sa base légale&nbsp;: l’intérêt légitime de l’éditeur
          à protéger le site et ses comptes. Rien n’est vendu ni partagé, ni utilisé pour de la
          publicité&#8239;; pas de mesure d’audience.
        </p>
        <h3>Ce qui est public</h3>
        <p>
          Votre Pokédex public, à l’adresse de votre pseudo, montre à tous votre pseudo, les cartes
          que vous avez choisies et celles que vous possédez (avec leur date d’obtention), et leur
          valeur au prix du jour. Jamais vos prix payés, vos commandes ni votre budget.
        </p>
        <p>
          Une image que vous collez par son adresse, celle d’un autre site, s’affiche depuis ce
          site&nbsp;: il reçoit l’adresse IP de qui la voit, vous comme les visiteurs de votre
          Pokédex public.
        </p>
        <h3>Qui y a accès</h3>
        <p>
          L’éditeur du site et OVHcloud, qui héberge le serveur à {LEGAL.host.location}. OVHcloud a
          accès aux informations techniques nécessaires à l’hébergement, notamment les adresses IP.
          Vos données sont donc transférées hors de l’Union européenne, au Canada, que la Commission
          européenne reconnaît comme assurant une protection adéquate (décision d’adéquation).
        </p>
        <h3>Combien de temps</h3>
        <p>
          Votre compte et ce que vous y enregistrez, tant que le compte existe&#8239;; supprimé, il
          part aussitôt du serveur, sans copie de sauvegarde (seul votre pseudo reste réservé&nbsp;:
          aucun autre compte ne le reprendra). Une session est fermée 60 jours après votre dernière
          visite, ou dès que vous vous connectez sur un autre appareil. Le journal du serveur n’a
          pas de durée fixe&nbsp;: limité à 30 Mo, il efface ses plus anciennes lignes au fil de
          l’eau, et repart de zéro à chaque mise à jour du site.
        </p>
        <h3>Vos droits</h3>
        <ul>
          <li>Obtenir vos données&nbsp;: Réglages › Sauvegarde › Exporter.</li>
          <li>
            Les corriger&nbsp;: tout se modifie dans le site, votre pseudo dans Réglages › Compte &
            partage › Mon compte.
          </li>
          <li>Les effacer&nbsp;: Réglages › Compte & partage › Mon compte.</li>
          <li>
            Vous opposer à leur traitement, le journal du serveur compris, ou en demander la
            limitation&nbsp;: l’adresse de contact plus haut.
          </li>
          <li>
            Pour toute autre demande, l’adresse de contact plus haut&#8239;; et en cas de désaccord,
            une réclamation auprès de la{' '}
            <ExternalLink href="https://www.cnil.fr/fr/plaintes">CNIL</ExternalLink>.
          </li>
        </ul>
        <h3>Cookies et stockage du navigateur</h3>
        <p>
          Un seul cookie, celui de votre session, nécessaire à la connexion&nbsp;: pas de bandeau à
          accepter. Votre navigateur garde aussi votre choix de thème&#8239;; votre collection,
          elle, n’est gardée que sur le serveur.
        </p>
      </section>
    </StandalonePage>
  )
}
