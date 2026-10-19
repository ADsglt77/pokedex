import { Link } from 'react-router'

/**
 * Le pied de page de chaque page (coquille, Pokédex public, connexion, inscription) : ce que n'est
 * pas le site, et le lien vers ses mentions légales (`LegalPage`).
 */
export function SiteDisclaimer() {
  return (
    <>
      Projet personnel, sans lien avec Nintendo, Creatures, Game Freak ou The Pokémon Company.{' '}
      <Link to="/mentions-legales">Mentions légales et confidentialité</Link>
    </>
  )
}
