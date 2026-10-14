import { ExternalLink } from '@/components/ExternalLink'
import { DataSection } from './DataSection'

/** D'où viennent les données. */
export function ReferenceSection() {
  return (
    <DataSection id="reference" title="Données de référence">
      <p>
        Les espèces viennent de <ExternalLink href="https://pokeapi.co/">PokéAPI</ExternalLink>,
        gardées par le serveur. Le catalogue des cartes japonaises de chaque Pokémon (toutes les
        séries depuis 1996, decks et promos compris : numéro, nom, id Cardmarket), refait chaque
        jour par le serveur, vient de{' '}
        <ExternalLink href="https://www.pokecardex.com/">Pokécardex</ExternalLink>, avec son aimable
        autorisation, comme les images des cartes, copiées sur notre serveur. Vous y choisissez vos
        cartes, ou les saisissez : l’image est alors retrouvée d’après la référence (le code de la
        série et le numéro), ou c’est celle de l’adresse que vous collez. Leur prix vient de leur id
        Cardmarket : celui du guide quotidien de{' '}
        <ExternalLink href="https://www.cardmarket.com/">Cardmarket</ExternalLink>, relu chaque jour
        par le serveur, qui en garde l’historique carte par carte.
      </p>
    </DataSection>
  )
}
