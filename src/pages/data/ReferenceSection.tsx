import { ExternalLink } from '@/components/ExternalLink'
import { DataSection } from './DataSection'

/** D'où viennent les données. */
export function ReferenceSection() {
  return (
    <DataSection id="reference" title="Données de référence">
      <p>
        Les espèces viennent de <ExternalLink href="https://pokeapi.co/">PokéAPI</ExternalLink>,
        embarquées dans l’app. Le catalogue des cartes japonaises de chaque Pokémon, refait chaque
        jour par le serveur, vient de <ExternalLink href="https://tcgdex.dev/">TCGdex</ExternalLink>{' '}
        (extension, numéro, id Cardmarket), complété par les cartes de TCGplayer que TCGdex n’a pas
        (decks, promos). Vous y choisissez vos cartes, ou les saisissez. Leur image vient de{' '}
        <ExternalLink href="https://www.pokecardex.com/">Pokécardex</ExternalLink>, avec son aimable
        autorisation, retrouvée d’après la référence (le code de l’extension et le numéro) ; quand
        Pokécardex ne l’a pas (vieilles séries, decks), celle du produit chez{' '}
        <ExternalLink href="https://www.tcgplayer.com/">TCGplayer</ExternalLink>, que le catalogue
        relie à la carte ; ou celle de l’adresse que vous collez. Leur prix vient de leur id
        Cardmarket : celui du guide quotidien de{' '}
        <ExternalLink href="https://www.cardmarket.com/">Cardmarket</ExternalLink>, relu chaque jour
        par le serveur, qui en garde l’historique carte par carte.
      </p>
    </DataSection>
  )
}
