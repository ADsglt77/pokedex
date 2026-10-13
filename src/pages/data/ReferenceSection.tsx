import { ExternalLink } from '@/components/ExternalLink'
import { DataSection } from './DataSection'

/** D'où viennent les données. */
export function ReferenceSection() {
  return (
    <DataSection id="reference" title="Données de référence">
      <p>
        Les espèces viennent de <ExternalLink href="https://pokeapi.co/">PokéAPI</ExternalLink>,
        embarquées dans l’app. Les cartes sont celles que vous ajoutez : l’image est l’adresse que
        vous collez, le prix vient de son id Cardmarket. Les prix sont ceux du guide quotidien de{' '}
        <ExternalLink href="https://www.cardmarket.com/">Cardmarket</ExternalLink>, relu chaque jour
        par le serveur, qui en garde l’historique carte par carte.
      </p>
    </DataSection>
  )
}
