import { ExternalLink } from '@/components/ExternalLink'
import { POKECARDEX } from '@/lib/card-images'

/**
 * D'où viennent les données, et ce que n'est pas le site : le pied de page de la coquille et du
 * Pokédex public (le lien vers Pokécardex, demandé par son accord).
 */
export function SiteCredits() {
  return (
    <>
      Espèces PokéAPI, cartes et images <ExternalLink href={POKECARDEX}>Pokécardex</ExternalLink>,
      prix Cardmarket. Projet personnel, sans lien avec Nintendo, Creatures, Game Freak ou The
      Pokémon Company.
    </>
  )
}
